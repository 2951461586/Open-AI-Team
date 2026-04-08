/**
 * team-tl-runtime.mjs
 *
 * TL-driven Agent Team runtime — P1 refactored.
 *
 * P1 goals:
 *   P1-1: TL decision protocol v2 (workItems / acceptance / deliverables / riskLevel)
 *   P1-2: Each assignment becomes a child task
 *   P1-3: Structured member results + plan/review/decision/artifact persistence
 *   P1-4: Governance runtime plugged into TL path
 *
 * Maintains P0 guarantees:
 *   - Multi-session tracking
 *   - Unified spawn routing
 *   - TL-first follow-up
 *   - Fine-grained states
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateExecutionDag } from './team-parallel-executor.mjs';
import {
  buildExecutionSurfacePrompt,
  buildRoleCapabilityContractPrompt,
  getRoleCapabilityContract,
  normalizeCapabilityList,
  normalizeExecutionSurfaceList,
  validateWorkItemCapabilityContracts,
  validateWorkItemExecutionSurfaceContracts,
} from '@ai-team/team-core/role-capability-contracts';
import { buildSearchEvidenceSafetyPrompt } from '@ai-team/team-core/execution-safety-contracts';
import { createTLPromptHelpers } from './tl-runtime/prompt.mjs';
import { createTLMemoryHelpers } from './tl-runtime/memory.mjs';
import { createTLCompletionHelpers } from './tl-runtime/completion.mjs';
import { createTLStateWritebackHelpers } from './tl-runtime/state-writeback.mjs';
import { createTLExecutionHelpers } from './tl-runtime/execution.mjs';
import { createTLFollowupHelpers } from './tl-runtime/followup.mjs';
import { createTLOrchestrationHelpers } from './tl-runtime/orchestration.mjs';
import { createTLPlanningHelpers } from './tl-runtime/planning.mjs';
import { createTLFailFastHelpers } from './tl-runtime/fail-fast.mjs';
import { createTLSingleFlightHelpers } from './tl-runtime/single-flight.mjs';
import { createTLDecisionHelpers } from '@ai-team/team-core/decision';
import { createTLRuntimeExecutionHarness, isPersistentSessionBinding, isSessionModeUnavailable, isSuccessfulSpawn, normalizeHistoryMessages, shouldFallbackMemberFollowup } from './tl-runtime/runtime-harness.mjs';
import { canFallbackToNativeChatByPolicy, ensureArray, ensureString, normalizeRiskLevel, parseJsonLoose } from '@ai-team/team-core/common';
import { createTLWorkItemHelpers } from '@ai-team/team-core/work-item';
import { createTLArtifactHelpers } from './tl-runtime/artifact.mjs';
import { createEventBus } from './event-bus.mjs';
import { createWorkbenchManager } from './workbench-manager.mjs';
import { createDeliveryContract } from './delivery-contracts.mjs';
import { createLlmExecutionEnvelope, createModelRouter } from '@ai-team/agent-harness';

export function createTLRuntime({
  teamStore,
  nativeChat,
  modelRouter,
  runtimeAdapter,
  executionAdapter,
  governanceRuntime,
  governanceAuditor,
  sessionCompletionBus,
  eventBus,
  traceCollector,
  spawnMemberSession,
  broadcastFn,
  roleConfig = {},
  workspaceRoot = process.env.TEAM_TASK_WORKSPACE_ROOT || path.resolve(process.cwd(), 'task_workspaces'),
  now,
  idgen,
} = {}) {
  const nowFn = typeof now === 'function' ? now : () => Date.now();
  const id = typeof idgen === 'function' ? idgen : (prefix = 'id') => `${prefix}:${randomUUID()}`;
  let runtimeBroadcastFn = typeof broadcastFn === 'function' ? broadcastFn : null;
  const runtimeEventBus = eventBus || createEventBus();

  const ROLE_LABELS = { planner: '规划师', critic: '审查官', judge: '裁决官', executor: '执行者', tl: 'TL', system: '系统' };
  function roleDisplayName(role) {
    const r = String(role || '').trim().toLowerCase();
    const cfg = roleConfig?.roles?.[r];
    return cfg?.displayName || ROLE_LABELS[r] || r;
  }

  async function withTraceSpan(operationName, fn, { parentContext = null, attributes = {} } = {}) {
    if (!traceCollector?.withSpan) return fn(null, parentContext || null);
    return traceCollector.withSpan(operationName, fn, { parentContext, attributes });
  }

  function markTraceError(error) {
    if (!traceCollector?.annotateCurrentSpan) return;
    traceCollector.annotateCurrentSpan('exception', {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: String(error?.stack || ''),
    });
  }

  function currentTraceContext() {
    return traceCollector?.getCurrentSpan?.() || null;
  }

  function broadcast(event) {
    if (typeof runtimeBroadcastFn === 'function') runtimeBroadcastFn(event);
  }
  function setBroadcastFn(fn) {
    runtimeBroadcastFn = typeof fn === 'function' ? fn : null;
  }

  const memberSessionSupport = {
    sessionModeSupported: true,
    checked: false,
    reason: '',
  };

  const llmRouter = modelRouter || createModelRouter({
    auditLogger: async ({ ok, response, error, routeInfo, selectedModel, fallbackUsed }) => {
      await governanceAuditor?.logAgentBehavior?.({
        action: 'llm.call',
        role: 'tl',
        message: ok ? 'model router call completed' : `model router call failed: ${String(error || response?.error || '')}`,
        metadata: {
          routePreset: routeInfo?.preset || '',
          complexity: routeInfo?.complexity || null,
          provider: response?.provider || selectedModel?.provider || '',
          modelId: response?.model || selectedModel?.model || '',
          tokenUsage: response?.tokenUsage || null,
          latencyMs: Number(response?.latencyMs || 0),
          cost: Number(response?.cost || 0),
          fallbackUsed: !!fallbackUsed,
        },
      });
    },
    invoker: async ({ text: requestText = '', history: requestHistory = [], mode = 'chat', systemPrompt = '', model: requestedModel = '' } = {}) => {
      const fn = nativeChat?.generateReply;
      if (!fn) return { ok: false, error: 'native_chat_unavailable', model: requestedModel };
      return fn({ text: requestText, history: requestHistory, mode, systemPrompt, model: requestedModel });
    },
  });

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  function canFallbackToNativeChat(role = '') {
    return canFallbackToNativeChatByPolicy(governanceRuntime, role);
  }

  // ── Build task-state snapshot for TL context injection ────────────
  const tlPromptHelpers = createTLPromptHelpers({
    teamStore,
    roleConfig,
    workspaceRoot,
    ensureArray,
    ensureString,
    getRoleCapabilityContract,
    buildRoleCapabilityContractPrompt,
    buildExecutionSurfacePrompt,
    buildSearchEvidenceSafetyPrompt,
    buildThreeLayerMemorySnapshot: (...args) => buildThreeLayerMemorySnapshot(...args),
  });
  const { buildTaskStateSnapshot, buildTLSystemPrompt, buildCompletionFilePath, buildMemberPrompt } = tlPromptHelpers;

  const tlWorkItemHelpers = createTLWorkItemHelpers({
    roleConfig,
    getRoleCapabilityContract,
    normalizeCapabilityList,
    normalizeExecutionSurfaceList,
    ensureArray,
    ensureString,
    normalizeRiskLevel,
  });
  const { normalizeWorkItem, resolveTimeout } = tlWorkItemHelpers;

  const tlMemoryHelpers = createTLMemoryHelpers({
    teamStore,
    nowFn,
    ensureArray,
    ensureString,
  });
  const {
    buildBlackboardSnapshot,
    buildWorkingMemorySnapshot,
    buildDurableMemorySnapshot,
    buildThreeLayerMemorySnapshot,
    extractAndWriteBlackboard,
    buildUpstreamContext,
  } = tlMemoryHelpers;

  const tlDecisionHelpers = createTLDecisionHelpers({
    parseJsonLoose,
    ensureArray,
    ensureString,
    normalizeRiskLevel,
    normalizeWorkItem,
  });
  const { parseTLDecision } = tlDecisionHelpers;

  const tlCompletionHelpers = createTLCompletionHelpers({ parseJsonLoose, ensureArray, ensureString });
  const { parseStructuredMemberResult } = tlCompletionHelpers;

  const tlStateWritebackHelpers = createTLStateWritebackHelpers({ teamStore, nowFn, id, ensureArray });
  const {
    appendMailbox,
    appendBlackboard,
    readTaskSessions,
    updateTaskFollowupState,
    writeSessionToTask,
  } = tlStateWritebackHelpers;

  const tlArtifactHelpers = createTLArtifactHelpers({ teamStore, nowFn, id });
  const { appendArtifactForMemberResult, appendEvidence } = tlArtifactHelpers;

  const runtimeExecutionHarness = createTLRuntimeExecutionHarness({
    executionAdapter,
    runtimeAdapter,
  });

  const workbenchManager = teamStore ? createWorkbenchManager({ teamStore, randomUUID, now: nowFn }) : null;

  const tlPlanningHelpers = createTLPlanningHelpers({
    teamStore,
    governanceRuntime,
    governanceAuditor,
    roleConfig,
    eventBus: runtimeEventBus,
    appendMailbox,
    appendBlackboard,
    nowFn,
    id,
    ensureArray,
    normalizeRiskLevel,
    normalizeWorkItem,
    parseStructuredMemberResult,
    roleDisplayName,
    createDeliveryContract,
  });
  const {
    createChildTask,
    synthesizeGovernedWorkItems,
    initializeTaskDeliveryContract,
    summarizeMemberResultLine,
  } = tlPlanningHelpers;

  const tlExecutionHelpers = createTLExecutionHelpers({
    runtimeExecutionHarness,
    nativeChat,
    eventBus: runtimeEventBus,
    spawnMemberSession,
    sessionCompletionBus,
    memberSessionSupport,
    buildMemberPrompt,
    roleDisplayName,
    canFallbackToNativeChat,
    isSuccessfulSpawn,
    isSessionModeUnavailable,
    normalizeHistoryMessages,
    parseStructuredMemberResult,
    writeSessionToTask,
    appendMailbox,
    appendBlackboard,
    appendArtifactForMemberResult,
    appendEvidence,
    extractAndWriteBlackboard,
    teamStore,
    broadcast,
    governanceRuntime,
    governanceAuditor,
    workbenchManager,
    nowFn,
    id,
    ensureArray,
  });
  const {
    unifiedSpawnSession,
    unifiedSendToSession,
    unifiedListSessions,
    unifiedGetSessionHistory,
    spawnAgentSession,
    waitForSessionCompletion,
    runMemberWithSession,
  } = tlExecutionHelpers;

  const tlFollowupHelpers = createTLFollowupHelpers({
    teamStore,
    nativeChat,
    runtimeExecutionHarness,
    readTaskSessions,
    updateTaskFollowupState,
    appendMailbox,
    appendBlackboard,
    appendArtifactForMemberResult,
    broadcast,
    nowFn,
    id,
    ensureArray,
    ensureString,
    parseJsonLoose,
    normalizeWorkItem,
    isPersistentSessionBinding,
    shouldFallbackMemberFollowup,
  });
  const { handleTLFollowup, sendToTaskSession } = tlFollowupHelpers;

  const tlSingleFlightHelpers = createTLSingleFlightHelpers({
    teamStore,
    governanceRuntime,
    sendToTaskSession,
    appendMailbox,
    broadcast,
    nowFn,
  });
  const {
    resolveSingleFlightReuse,
    handleSingleFlightReuse,
  } = tlSingleFlightHelpers;

  const tlFailFastHelpers = createTLFailFastHelpers({
    teamStore,
    appendMailbox,
    appendArtifactForMemberResult,
    broadcast,
    nowFn,
    ensureArray,
    ensureString,
  });
  const {
    formatDagValidationErrors,
    formatCapabilityContractErrors,
    formatExecutionSurfaceContractErrors,
    failFastTaskOnExecutionSurfaceContract,
    failFastTaskOnCapabilityContract,
    failFastTaskOnInvalidDag,
  } = tlFailFastHelpers;

  const tlOrchestrationHelpers = createTLOrchestrationHelpers({
    teamStore,
    governanceRuntime,
    governanceAuditor,
    eventBus: runtimeEventBus,
    traceCollector,
    roleConfig,
    ensureArray,
    ensureString,
    normalizeRiskLevel,
    normalizeWorkItem,
    resolveTimeout,
    roleDisplayName,
    buildUpstreamContext,
    runMemberWithSession,
    createChildTask,
    summarizeMemberResultLine,
    appendMailbox,
    appendBlackboard,
    appendArtifactForMemberResult,
    broadcast,
    workbenchManager,
    nowFn,
    validateExecutionDag,
    validateWorkItemCapabilityContracts,
    validateWorkItemExecutionSurfaceContracts,
    failFastTaskOnCapabilityContract,
    failFastTaskOnExecutionSurfaceContract,
    failFastTaskOnInvalidDag,
    formatCapabilityContractErrors,
    formatExecutionSurfaceContractErrors,
    formatDagValidationErrors,
  });
  const { executeDelegatedPlan } = tlOrchestrationHelpers;

  async function handleTeamRun(evt = {}, opts = {}) {
    const text = String(evt.text || '').trim();
    const scopeKey = String(evt.scopeKey || evt.scope_key || 'dashboard').trim();
    const history = Array.isArray(evt.history) ? evt.history : [];
    const onChunk = typeof opts.onChunk === 'function' ? opts.onChunk : null;
    if (!text) return { ok: false, error: 'empty_text' };

    return withTraceSpan('tl.dispatch', async (dispatchSpan, dispatchContext) => {
      const members = Object.entries(roleConfig?.roles || {})
        .filter(([key]) => !['observer', 'monitor', 'output', 'tl'].includes(key))
        .map(([key, cfg]) => ({ role: key, displayName: cfg.displayName || key, description: cfg.description || '', capabilities: cfg.capabilities || [] }));

      const systemPrompt = buildTLSystemPrompt(members);
      let tlFullText = '';
      const tlOnChunk = (delta, fullText) => {
        tlFullText = String(fullText || delta || '');
        if (onChunk) onChunk(delta, fullText);
      };

      const decision = await withTraceSpan('tl.planning', async () => {
        const preferredModel = llmRouter.route(text).primary?.model || '';
        const tlReply = nativeChat?.generateReplyStream && onChunk
          ? await nativeChat.generateReplyStream({ text, history, mode: 'chat', systemPrompt, onChunk: tlOnChunk, model: preferredModel })
          : await llmRouter.execute({ text, history, mode: 'chat', systemPrompt });

        const llmExecution = tlReply?.execution || createLlmExecutionEnvelope({
          request: { text, history, mode: 'chat', systemPrompt, model: preferredModel },
          response: tlReply,
          selectedModel: { provider: tlReply?.provider || 'native-chat', model: tlReply?.model || preferredModel || '' },
          routeInfo: tlReply?.routeInfo || { preset: 'chat' },
          fallbackUsed: !!tlReply?.fallbackUsed,
          metadata: {
            source: nativeChat?.generateReplyStream && onChunk ? 'native_chat.generateReplyStream' : 'llm_router.execute',
          },
          trace: currentTraceContext(),
        });

        let tlResponseText = String(tlReply?.reply || tlFullText || '').trim();
        if (!tlResponseText && nativeChat?.generateReply) {
          const fallbackReply = await nativeChat.generateReply({ text, history, mode: 'chat', systemPrompt, model: preferredModel });
          tlResponseText = String(fallbackReply?.reply || '').trim();
        }
        if (!tlResponseText) {
          tlResponseText = '我这边已经收到消息，但 TL 本轮没有产出可用回复。请重试一次；如果还是复现，我会继续沿着 TL/runtime 日志往里查。';
        }

        const initialDecision = parseTLDecision(tlResponseText);
        const synthesizedWorkItems = synthesizeGovernedWorkItems(initialDecision);
        return {
          ...initialDecision,
          workItems: synthesizedWorkItems,
          governanceExpanded: synthesizedWorkItems.length !== ensureArray(initialDecision.workItems).length,
          planningEvidence: {
            evidenceType: 'tl.llm.decision',
            sourceType: 'llm',
            sourceId: llmExecution.executionId,
            title: 'TL planning response',
            detail: {
              execution: llmExecution,
              responseText: tlResponseText,
            },
            severity: tlReply?.ok === false ? 'warn' : 'info',
          },
          _initialDecision: initialDecision,
        };
      }, {
        parentContext: dispatchContext,
        attributes: { scopeKey, input: text.slice(0, 500) },
      });

      if (decision.type === 'direct') {
        return { ok: true, action: 'tl_direct', reply: decision.directReply, decision };
      }

      const singleFlightCandidate = resolveSingleFlightReuse({ scopeKey, decision, text });
      if (singleFlightCandidate) {
        const reused = await handleSingleFlightReuse({
          candidate: singleFlightCandidate,
          decision,
          text,
          scopeKey,
          history,
        });
        if (reused?.ok) return reused;
      }

      broadcast({
        type: 'orchestration_event',
        eventKind: 'role.started',
        role: 'tl',
        lane: 'tl',
        title: 'TL 开始分析',
        content: text.slice(0, 200),
        scopeKey,
        timestamp: nowFn(),
      });

      broadcast({
        type: 'orchestration_event',
        eventKind: 'tl.analyzed',
        role: 'tl',
        lane: 'tl',
        title: 'TL 分析完成',
        content: `决策：分配给 ${[...new Set((decision._initialDecision?.workItems || []).map((a) => roleDisplayName(a.role)))].join('、')}`,
        scopeKey,
        timestamp: nowFn(),
      });

      const teamId = id('team');
      const taskId = id('task');
      const nowTs = nowFn();

      teamStore?.createTeam?.({
        teamId,
        scopeKey,
        mode: 'tl_runtime',
        status: 'active',
        metadata: { taskMode: decision.taskMode, riskLevel: decision.riskLevel, traceId: dispatchSpan?.traceId || '' },
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      const parentTask = teamStore?.createTask?.({
        taskId,
        teamId,
        parentTaskId: '',
        title: text.slice(0, 120),
        description: text,
        state: 'planning',
        ownerMemberId: '',
        priority: decision.riskLevel === 'high' ? 20 : 10,
        dependencies: [],
        metadata: {
          taskMode: decision.taskMode,
          riskLevel: decision.riskLevel,
          assignmentIds: decision.workItems.map((a) => a.id),
          sessionsByRole: {},
          sessionsByAssignment: {},
          primarySessionKey: '',
          tlSessionKey: '',
          followupRoute: 'tl',
          traceId: dispatchSpan?.traceId || '',
          rootSpanId: dispatchSpan?.spanId || '',
        },
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      appendMailbox({
        teamId,
        taskId,
        kind: 'tl.decision',
        fromMemberId: 'member:tl',
        payload: {
          type: decision.type,
          summary: decision.summary,
          taskMode: decision.taskMode,
          riskLevel: decision.riskLevel,
          workItemIds: decision.workItems.map((x) => x.id),
          governanceExpanded: !!decision.governanceExpanded,
          traceId: dispatchSpan?.traceId || '',
        },
      });

      try {
        initializeTaskDeliveryContract?.({ task: parentTask, decision });
      } catch {}

      if (decision.planningEvidence) {
        appendEvidence({
          teamId,
          taskId,
          ...decision.planningEvidence,
        });
      }

      const finalDecision = { ...decision };
      delete finalDecision._initialDecision;
      delete finalDecision.planningEvidence;

      return withTraceSpan('tl.orchestration', async () => executeDelegatedPlan({
        teamId,
        taskId,
        parentTask,
        decision: finalDecision,
        scopeKey,
      }), {
        parentContext: dispatchContext,
        attributes: { teamId, taskId, scopeKey, workItemCount: finalDecision.workItems.length },
      });
    });
  }

  async function handleTaskChat({ taskId, text, target, intent, targetRole, assignmentId, childTaskId } = {}) {
    const task = teamStore?.getTaskById?.(String(taskId || ''));
    if (!task) return { ok: false, error: 'task_not_found' };
    return sendToTaskSession({
      taskId,
      text,
      target,
      intent,
      targetRole,
      assignmentId,
      childTaskId,
      timeoutSeconds: 90,
    });
  }

  async function createTeamRunFromEvent(evt = {}) {
    const scopeKey = String(evt.scopeKey || evt.scope_key || evt.scope || 'dashboard').trim();
    const text = String(evt.text || '').trim();
    const nowTs = nowFn();
    const teamId = id('team');
    const taskId = id('task');
    const taskMode = String(evt.taskMode || evt.task_mode || 'general').trim() || 'general';
    const riskLevel = normalizeRiskLevel(evt.riskLevel || evt.risk_level || 'medium');
    const sourceEventId = String(evt.sourceEventId || evt.messageId || evt.message_id || evt.msg_id || evt.id || '').trim();
    const ingressKind = String(evt.ingressKind || evt.kind || '').trim();
    const source = String(evt.source || 'async_ingress').trim() || 'async_ingress';
    const originNode = String(evt.originNode || evt.origin_node || evt.relayNode || evt.bridgeNode || '').trim();
    const deliveryTarget = String(evt.deliveryTarget || evt.delivery_target || evt.room || evt.chat_id || evt.target_id || '').trim();
    const recipientId = String(evt.recipientId || evt.recipient_id || deliveryTarget || '').trim();
    const recipientType = String(evt.recipientType || evt.recipient_type || '').trim();
    const deliveryMode = String(evt.deliveryMode || evt.delivery_mode || '').trim();
    const channel = String(evt.channel || evt.surface || '').trim();
    const ingressMeta = {
      source,
      ingressKind,
      sourceEventId,
      originNode,
      deliveryTarget,
      recipientId,
      recipientType,
      deliveryMode,
      channel,
      scopeKey,
      taskMode,
      riskLevel,
    };

    const team = teamStore?.createTeam?.({
      teamId,
      scopeKey,
      mode: ingressKind ? 'async_ingress' : 'tl_runtime',
      status: 'active',
      metadata: ingressMeta,
      createdAt: nowTs,
      updatedAt: nowTs,
    }) || { teamId, scopeKey, metadata: ingressMeta };

    const task = teamStore?.createTask?.({
      taskId,
      teamId,
      parentTaskId: '',
      title: text.slice(0, 120) || '新任务',
      description: text,
      state: 'pending',
      ownerMemberId: '',
      priority: riskLevel === 'high' ? 20 : 10,
      dependencies: [],
      metadata: {
        ...ingressMeta,
        assignmentIds: [],
        childTaskIds: [],
        sessionsByRole: {},
        sessionsByAssignment: {},
        primarySessionKey: '',
        tlSessionKey: '',
        followupRoute: 'tl',
      },
      createdAt: nowTs,
      updatedAt: nowTs,
    }) || { taskId, teamId, title: text.slice(0, 120) || '新任务', description: text, state: 'pending', metadata: ingressMeta };

    if (ingressKind || sourceEventId) {
      appendMailbox({
        teamId,
        taskId,
        kind: 'async_ingress.accepted',
        fromMemberId: 'member:system',
        payload: {
          source,
          ingressKind,
          sourceEventId,
          originNode,
          deliveryTarget,
          recipientId,
          recipientType,
          deliveryMode,
          channel,
        },
      });
      appendBlackboard({
        teamId,
        taskId,
        section: 'ingress',
        entryKey: 'async_ingress',
        value: {
          accepted: true,
          source,
          ingressKind,
          sourceEventId,
          originNode,
          deliveryTarget,
          recipientId,
          recipientType,
          deliveryMode,
          channel,
        },
      });
      teamStore?.insertEvidence?.({
        evidenceId: id('evidence'),
        taskId,
        teamId,
        evidenceType: 'async_ingress.accepted',
        sourceType: 'ingress',
        sourceId: sourceEventId || taskId,
        title: 'async ingress accepted',
        detail: {
          source,
          ingressKind,
          sourceEventId,
          originNode,
          deliveryTarget,
          recipientId,
          recipientType,
          deliveryMode,
          channel,
        },
        severity: 'info',
        createdAt: nowTs,
      });
    }

    broadcast({
      type: 'task_created',
      taskId,
      teamId,
      title: String(task?.title || ''),
      scopeKey,
      timestamp: nowTs,
    });

    return {
      team,
      members: [],
      task,
      childTasks: [],
      entry: {
        mode: ingressKind ? 'tl_ingress_accepted' : 'tl_driven',
        scopeKey,
        source,
        ingressKind,
        sourceEventId,
        originNode,
        deliveryTarget,
        recipientId,
        recipientType,
        deliveryMode,
        channel,
      },
      tlReply: '',
      tlAction: 'accepted',
      memberResults: [],
      escalation: null,
    };
  }

  return {
    handleTeamRun,
    handleTaskChat,
    sendToTaskSession,
    createTeamRunFromEvent,
    setBroadcastFn,
    eventBus: runtimeEventBus,
    _buildTLSystemPrompt: buildTLSystemPrompt,
    _parseTLDecision: parseTLDecision,
    _parseStructuredMemberResult: parseStructuredMemberResult,
    _readTaskSessions: readTaskSessions,
    _normalizeWorkItem: normalizeWorkItem,
    _runMemberWithSession: runMemberWithSession,
  };
}

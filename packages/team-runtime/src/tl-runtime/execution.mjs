import { TEAM_EVENT_TYPES } from '../event-types.mjs';

export function createTLExecutionHelpers({
  runtimeExecutionHarness,
  nativeChat,
  eventBus,
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
} = {}) {
  function publishEvent(type, payload = {}, meta = {}) {
    if (!eventBus?.publish) return;
    void eventBus.publish({
      type,
      teamId: String(meta?.teamId || payload?.teamId || ''),
      source: 'tl-runtime',
      payload,
      meta,
    }).catch(() => {});
  }

  async function unifiedSpawnSession({ role, ...spawnArgs } = {}) {
    try {
      const result = await runtimeExecutionHarness.spawnForRole({ role, ...spawnArgs });
      return result || { ok: false, error: 'no_spawn_backend_available' };
    } catch (err) {
      console.warn(`[tl-runtime] runtimeExecutionHarness spawn error for ${role}:`, err?.message || err);
      return { ok: false, error: String(err?.message || err || 'no_spawn_backend_available') };
    }
  }

  async function unifiedSendToSession(args = {}) {
    try {
      return await runtimeExecutionHarness.sendToSession(args);
    } catch (err) {
      console.warn(`[tl-runtime] runtimeExecutionHarness send error:`, err?.message || err);
      return { ok: false, error: String(err?.message || err || 'send_not_available') };
    }
  }

  async function unifiedListSessions({ sessionKey = '', ...args } = {}) {
    try {
      return await runtimeExecutionHarness.listSessionsForSession({ sessionKey, ...args });
    } catch (err) {
      console.warn(`[tl-runtime] runtimeExecutionHarness list error:`, err?.message || err);
      return { ok: false, error: String(err?.message || err || 'list_not_available'), sessions: [] };
    }
  }

  async function unifiedGetSessionHistory({ sessionKey = '', ...args } = {}) {
    try {
      return await runtimeExecutionHarness.getSessionHistory({ sessionKey, ...args });
    } catch (err) {
      console.warn(`[tl-runtime] runtimeExecutionHarness history error:`, err?.message || err);
      return { ok: false, error: String(err?.message || err || 'history_not_available') };
    }
  }

  async function spawnAgentSession({ role, task, taskId, childTaskId, assignmentId, scopeKey, objective, acceptance, deliverables, context = '', timeoutMs, workItem, resultsByAssignment = {} } = {}) {
    const { memberPrompt, taskWorkspace, completionFilePath, memberConfig } = buildMemberPrompt({
      role, task, taskId, childTaskId, assignmentId, objective, acceptance, deliverables, context, workItem, resultsByAssignment,
    });

    if (sessionCompletionBus?.ensureParentDir) {
      try { await sessionCompletionBus.ensureParentDir(completionFilePath); } catch {}
    }

    const timeoutSeconds = Math.max(30, Math.ceil(Number(timeoutMs || memberConfig.timeoutMs || 120000) / 1000));
    let spawnResult = null;
    let sessionMode = 'run';
    let sessionPersistent = false;
    let sessionFallbackReason = '';

    if (memberSessionSupport.sessionModeSupported !== false) {
      const sessionAttempt = await unifiedSpawnSession({
        role,
        task: memberPrompt,
        runtime: 'subagent',
        mode: 'session',
        thread: true,
        cleanup: 'keep',
        sandbox: 'inherit',
        label: `team:${role}:${taskId}${assignmentId ? `:${assignmentId}` : ''}`,
        cwd: taskWorkspace,
        timeoutSeconds,
      });
      if (isSuccessfulSpawn(sessionAttempt)) {
        spawnResult = sessionAttempt;
        sessionMode = 'session';
        sessionPersistent = true;
        memberSessionSupport.checked = true;
        memberSessionSupport.sessionModeSupported = true;
        memberSessionSupport.reason = '';
      } else {
        sessionFallbackReason = String(sessionAttempt?.error || sessionAttempt?.status || 'session_mode_unavailable');
        if (isSessionModeUnavailable(sessionAttempt)) {
          memberSessionSupport.checked = true;
          memberSessionSupport.sessionModeSupported = false;
          memberSessionSupport.reason = sessionFallbackReason;
        }
      }
    } else {
      sessionFallbackReason = memberSessionSupport.reason || 'session_mode_unavailable';
    }

    if (!spawnResult) {
      const runAttempt = await unifiedSpawnSession({
        role,
        task: memberPrompt,
        runtime: 'subagent',
        mode: 'run',
        label: `team:${role}:${taskId}${assignmentId ? `:${assignmentId}` : ''}`,
        cwd: taskWorkspace,
        runTimeoutSeconds: timeoutSeconds,
      });
      if (isSuccessfulSpawn(runAttempt)) {
        spawnResult = runAttempt;
        sessionMode = 'run';
        sessionPersistent = false;
      } else if (!sessionFallbackReason) {
        sessionFallbackReason = String(runAttempt?.error || runAttempt?.status || 'spawn_failed');
      }
    }

    if (isSuccessfulSpawn(spawnResult)) {
      return {
        ok: true,
        sessionKey: spawnResult.childSessionKey || spawnResult.sessionKey,
        runId: spawnResult.runId || '',
        routedNode: spawnResult._routedNode || '',
        requestedNode: spawnResult.requestedNode || '',
        degraded: !!spawnResult.degraded,
        degradedReason: spawnResult.degradedReason || '',
        sessionMode,
        sessionPersistent,
        sessionFallbackReason,
        completionFilePath,
        via: 'unified_spawn',
      };
    }

    if (typeof spawnMemberSession === 'function') {
      try {
        const result = await spawnMemberSession({ role, task: memberPrompt, taskId, scopeKey, context, memberConfig, completionFilePath });
        return { ok: true, reply: result?.reply || result?.output || String(result || ''), sessionMode: 'legacy', sessionPersistent: false, sessionFallbackReason, completionFilePath, via: 'legacy_spawn' };
      } catch (err) {
        console.warn(`[tl-runtime] legacy spawn error for ${role}:`, err?.message || err);
      }
    }

    if (!canFallbackToNativeChat(role)) {
      return {
        ok: false,
        error: `${String(role || 'member').toLowerCase()}_native_chat_fallback_blocked`,
        sessionMode,
        sessionPersistent,
        sessionFallbackReason: sessionFallbackReason || 'native_chat_fallback_blocked',
        via: 'native_chat_blocked',
      };
    }

    try {
      const reply = await nativeChat?.generateReply?.({ text: memberPrompt, mode: 'chat', history: [] });
      return { ok: !!reply?.ok, reply: reply?.reply || '', sessionMode: 'native_chat', sessionPersistent: false, sessionFallbackReason, via: 'native_chat_fallback' };
    } catch (err) {
      return { ok: false, error: String(err?.message || err), sessionMode, sessionPersistent, sessionFallbackReason, via: 'error' };
    }
  }

  async function waitForSessionCompletion({ sessionKey, completionFilePath = '', timeoutMs = 120000, role = '', taskId = '', childTaskId = '', scopeKey = '', sessionMode = 'run' } = {}) {
    if (!sessionKey && !completionFilePath) return null;
    const startedAt = Date.now();

    if (completionFilePath && sessionCompletionBus?.waitForCompletion) {
      const eventResult = await sessionCompletionBus.waitForCompletion({
        filePath: completionFilePath,
        timeoutMs: Number(timeoutMs || 120000),
      });
      if (eventResult?.ok) {
        const reply = String(eventResult?.raw || '').trim();
        broadcast({
          type: 'orchestration_event',
          eventKind: 'member.completed',
          role,
          lane: role,
          title: `${roleDisplayName(role)} 完成`,
          content: 'completion 事件已送达',
          taskId,
          childTaskId,
          scopeKey,
          timestamp: nowFn(),
        });
        return { ok: true, reply, status: 'done', mode: 'file_event', payload: eventResult.payload };
      }
      if (String(eventResult?.error || '') === 'timeout') {
        broadcast({
          type: 'orchestration_event',
          eventKind: 'member.timeout',
          role,
          lane: role,
          title: `${roleDisplayName(role)} 超时`,
          content: `等待 ${Math.round((Date.now() - startedAt) / 1000)} 秒未收到 completion 事件`,
          taskId,
          childTaskId,
          scopeKey,
          timestamp: nowFn(),
        });
        return { ok: false, error: 'timeout', mode: 'file_event' };
      }
    }

    const normalizedSessionMode = String(sessionMode || 'run').trim().toLowerCase();
    if (!sessionKey) return null;

    const deadline = Date.now() + timeoutMs;
    const pollInterval = 3000;
    let lastBroadcastLen = 0;

    while (Date.now() < deadline) {
      try {
        if (normalizedSessionMode === 'session') {
          const historyData = await unifiedGetSessionHistory({ sessionKey, limit: 40, includeTools: false });
          const historyError = String(historyData?.error || historyData?.details?.error || historyData?.result?.details?.error || '').trim().toLowerCase();
          const history = normalizeHistoryMessages(historyData);
          if (history.length > lastBroadcastLen) {
            const delta = history.slice(lastBroadcastLen);
            for (const msg of delta) {
              broadcast({
                type: 'orchestration_event',
                eventKind: 'execution.progress',
                role,
                lane: role,
                title: `${roleDisplayName(role)} 进展`,
                content: String(msg?.content || '').slice(0, 500),
                taskId,
                childTaskId,
                scopeKey,
                timestamp: nowFn(),
              });
            }
            lastBroadcastLen = history.length;
          }
          const assistantReply = history
            .filter((msg) => String(msg?.role || '').toLowerCase() === 'assistant')
            .map((msg) => String(msg?.content || '').trim())
            .filter(Boolean)
            .join('\n\n')
            .trim();
          if (assistantReply) {
            return { ok: true, reply: assistantReply, status: 'active', mode: 'poll_fallback' };
          }
          if (historyError && !historyError.includes('forbidden') && !historyError.includes('visibility')) {
            return { ok: false, error: historyError || 'session_history_failed', status: 'failed', mode: 'poll_fallback' };
          }
        }

        {
          const data = await unifiedListSessions({ sessionKey });
          const sessions = ensureArray(data?.sessions || data?.result?.details?.sessions || []);
          const current = sessions.find((s) => String(s?.sessionKey || s?.key || '') === String(sessionKey));
          if (current) {
            const history = ensureArray(current?.messages || current?.history || []);
            const text = history.map((m) => `${m.role || 'assistant'}: ${m.content || ''}`).join('\n').trim();

            if (history.length > lastBroadcastLen) {
              const delta = history.slice(lastBroadcastLen);
              for (const msg of delta) {
                broadcast({
                  type: 'orchestration_event',
                  eventKind: 'execution.progress',
                  role,
                  lane: role,
                  title: `${roleDisplayName(role)} 进展`,
                  content: String(msg?.content || '').slice(0, 500),
                  taskId,
                  childTaskId,
                  scopeKey,
                  timestamp: nowFn(),
                });
              }
              lastBroadcastLen = history.length;
            }

            if (['completed', 'done', 'finished', 'succeeded'].includes(String(current?.status || '').toLowerCase())) {
              return { ok: true, reply: text, status: 'done', mode: 'poll_fallback' };
            }
            if (['failed', 'error', 'cancelled'].includes(String(current?.status || '').toLowerCase())) {
              return { ok: false, error: 'session_failed', status: current.status, reply: text, mode: 'poll_fallback' };
            }
          }
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    broadcast({
      type: 'orchestration_event',
      eventKind: 'member.timeout',
      role,
      lane: role,
      title: `${roleDisplayName(role)} 超时`,
      content: `等待 ${Math.round((Date.now() - startedAt) / 1000)} 秒未完成`,
      taskId,
      childTaskId,
      scopeKey,
      timestamp: nowFn(),
    });
    return { ok: false, error: 'timeout', mode: 'poll_fallback' };
  }

  async function runMemberWithSession({ role, task, objective, acceptance, deliverables, assignmentId, teamId, parentTask, childTask, scopeKey, context = '', timeoutMs, workItem, resultsByAssignment = {} } = {}) {
    const startedAt = nowFn();
    const governanceCheck = governanceRuntime?.checkExecutionPermission?.({
      taskMode: 'execution',
      role,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      riskLevel: workItem?.riskLevel,
      executionSurfaces: workItem?.executionSurfaces || workItem?.tools || [],
      operationType: Array.isArray(workItem?.executionSurfaces) && workItem.executionSurfaces.length === 1
        ? String(workItem.executionSurfaces[0]?.type || workItem.executionSurfaces[0] || '').toLowerCase()
        : '',
      command: workItem?.command || '',
      path: workItem?.path || '',
      url: workItem?.url || '',
      method: workItem?.method || '',
    }) || { decision: 'allow', risk: { level: workItem?.riskLevel || 'low' }, policy: { decision: 'allow' } };

    await governanceRuntime?.auditTaskEvent?.({
      action: 'execute',
      status: governanceCheck.decision === 'allow' ? 'started' : governanceCheck.decision,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      teamId,
      role,
      agentId: `member:${role}`,
      scopeKey,
      message: `preflight:${governanceCheck.decision}`,
      risk: governanceCheck.risk,
      policy: governanceCheck.policy,
      metadata: { title: workItem?.title || childTask?.title || '', objective },
    });

    if (governanceCheck.decision === 'deny') {
      const errorText = 'governance_policy_denied';
      await governanceRuntime?.auditAgentBehavior?.({
        action: 'execution_denied',
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        assignmentId,
        teamId,
        role,
        agentId: `member:${role}`,
        message: errorText,
        overreach: true,
        sensitiveOperation: true,
        categories: ['policy-deny', 'preflight'],
        risk: governanceCheck.risk,
        policy: governanceCheck.policy,
        metadata: { workItem },
      });
      teamStore?.updateTaskState?.({ taskId: childTask?.taskId, state: 'blocked', updatedAt: nowFn() });
      return { ok: false, role, assignmentId, childTaskId: childTask?.taskId, error: errorText, result: errorText, summary: errorText, routedNode: '', degraded: false, degradedReason: '', via: 'governance_deny', governance: governanceCheck };
    }

    if (governanceCheck.decision === 'require-approval') {
      const errorText = 'governance_approval_required';
      await governanceRuntime?.auditAgentBehavior?.({
        action: 'approval_required',
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        assignmentId,
        teamId,
        role,
        agentId: `member:${role}`,
        message: errorText,
        overreach: false,
        sensitiveOperation: true,
        categories: ['approval-gate', 'preflight'],
        risk: governanceCheck.risk,
        policy: governanceCheck.policy,
        metadata: { workItem },
      });
      teamStore?.updateTaskState?.({ taskId: childTask?.taskId, state: 'blocked', updatedAt: nowFn() });
      return { ok: false, role, assignmentId, childTaskId: childTask?.taskId, error: errorText, result: errorText, summary: errorText, routedNode: '', degraded: false, degradedReason: '', via: 'governance_approval_required', governance: governanceCheck };
    }

    appendMailbox({
      teamId,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      kind: 'workitem.started',
      fromMemberId: `member:${role}`,
      payload: { assignmentId, childTaskId: childTask?.taskId, role, title: workItem?.title || childTask?.title || '' },
    });

    broadcast({
      type: 'orchestration_event',
      eventKind: 'member.started',
      role,
      lane: role,
      title: `${roleDisplayName(role)} 开始执行`,
      content: workItem?.title || task,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      scopeKey,
      timestamp: startedAt,
    });

    publishEvent(TEAM_EVENT_TYPES.TASK_EXECUTION_STARTED, {
      taskId: parentTask?.taskId || '',
      childTaskId: childTask?.taskId || '',
      assignmentId: assignmentId || '',
      teamId: teamId || '',
      role: role || '',
      scope: scopeKey || '',
      timestamp: startedAt,
      state: 'started',
      title: workItem?.title || childTask?.title || '',
      objective: objective || workItem?.objective || '',
      riskLevel: workItem?.riskLevel || governanceCheck?.risk?.level || 'low',
    }, {
      scopeKey,
      phase: 'execution',
      event: 'started',
      teamId,
      governanceDecision: governanceCheck?.decision || 'allow',
    });

    const spawn = await spawnAgentSession({
      role,
      task,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      scopeKey,
      objective,
      acceptance,
      deliverables,
      context,
      timeoutMs,
      workItem,
      resultsByAssignment,
    });

    if (!spawn?.ok) {
      const errorText = String(spawn?.error || 'spawn_failed');
      await governanceAuditor?.logAgentBehavior?.({
        action: 'spawn_failed',
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        assignmentId,
        teamId,
        role,
        agentId: `member:${role}`,
        message: errorText,
        overreach: false,
        sensitiveOperation: false,
        categories: ['execution', 'spawn'],
        risk: governanceCheck.risk,
        policy: governanceCheck.policy,
        metadata: { via: spawn?.via || 'spawn_failed', scopeKey },
      });
      const result = {
        ok: false,
        role,
        assignmentId,
        childTaskId: childTask?.taskId,
        error: errorText,
        result: errorText,
        summary: errorText,
        routedNode: '',
        degraded: false,
        degradedReason: '',
        via: spawn?.via || 'spawn_failed',
      };

      appendMailbox({
        teamId,
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        kind: 'workitem.failed',
        fromMemberId: `member:${role}`,
        payload: { assignmentId, childTaskId: childTask?.taskId, error: errorText },
      });

      teamStore?.updateTaskState?.({ taskId: childTask?.taskId, state: 'blocked', updatedAt: nowFn() });
      return result;
    }

    if (spawn.sessionKey) {
      await governanceAuditor?.logTaskLifecycle?.({
        action: 'session_bound',
        status: 'active',
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        assignmentId,
        teamId,
        role,
        agentId: `member:${role}`,
        scopeKey,
        message: `session:${spawn.sessionKey}`,
        risk: governanceCheck.risk,
        policy: governanceCheck.policy,
        metadata: {
          sessionKey: spawn.sessionKey,
          runId: spawn.runId || '',
          via: spawn.via || 'unknown',
          routedNode: spawn.routedNode || '',
          sessionMode: spawn.sessionMode || 'run',
        },
      });
      writeSessionToTask({
        taskId: parentTask?.taskId,
        role,
        assignmentId,
        childTaskId: childTask?.taskId,
        sessionKey: spawn.sessionKey,
        runId: spawn.runId,
        spawnedAt: startedAt,
        requestedNode: spawn.requestedNode || '',
        actualNode: spawn.routedNode || '',
        degradedReason: spawn.degradedReason || '',
        sessionMode: spawn.sessionMode || 'run',
        sessionPersistent: !!spawn.sessionPersistent,
        sessionFallbackReason: spawn.sessionFallbackReason || '',
      });

      if (childTask?.taskId) {
        teamStore?.updateTaskMetadata?.({
          taskId: childTask.taskId,
          metadata: {
            requestedNode: spawn.requestedNode || '',
            actualNode: spawn.routedNode || '',
            degradedReason: spawn.degradedReason || '',
            sessionMode: spawn.sessionMode || 'run',
            sessionPersistent: !!spawn.sessionPersistent,
            sessionFallbackReason: spawn.sessionFallbackReason || '',
          },
        });
      }
    }

    let waitResult = null;
    if (spawn.sessionKey || spawn.completionFilePath) {
      waitResult = await waitForSessionCompletion({
        sessionKey: spawn.sessionKey,
        completionFilePath: spawn.completionFilePath || '',
        timeoutMs: Number(timeoutMs || 120000),
        role,
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        scopeKey,
        sessionMode: spawn.sessionMode || 'run',
      });
    }

    const rawResultText = waitResult?.reply || spawn.reply || '';
    const structured = parseStructuredMemberResult(rawResultText, { ok: waitResult?.ok !== false, summary: rawResultText, error: waitResult?.error || '' });
    const ok = structured.ok !== false && waitResult?.ok !== false;

    teamStore?.updateTaskState?.({
      taskId: childTask?.taskId,
      state: ok ? 'done' : 'blocked',
      updatedAt: nowFn(),
    });

    appendArtifactForMemberResult({
      teamId,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      role,
      assignmentId,
      title: `${roleDisplayName(role)} 执行结果`,
      body: {
        summary: structured.summary,
        deliverables: structured.deliverables,
        issues: structured.issues,
        raw: structured.raw,
      },
      metadata: {
        assignmentId,
        childTaskId: childTask?.taskId,
        outputType: structured.outputType,
        contractVersion: structured.contractVersion,
      },
      artifactType: role === 'critic' ? 'review' : role === 'judge' ? 'decision' : 'member_result',
    });

    if (parentTask?.taskId && workbenchManager?.collectArtifacts) {
      try {
        const submission = await workbenchManager.collectArtifacts(parentTask.taskId, {
          source: `tl_runtime:${role}`,
          notes: structured.summary || rawResultText || '',
        });
        const task = teamStore?.getTaskById?.(parentTask.taskId);
        const workbench = task?.metadata?.workbench || {};
        teamStore?.updateTaskMetadata?.({
          taskId: parentTask.taskId,
          metadata: {
            ...(task?.metadata || {}),
            workbench: {
              ...workbench,
              artifacts: ensureArray(submission?.artifacts),
              latestArtifactCollectionAt: nowFn(),
              latestArtifactCollectionBy: role,
              latestArtifactCollectionAssignmentId: assignmentId || '',
              latestArtifactCollectionChildTaskId: childTask?.taskId || '',
            },
          },
          updatedAt: nowFn(),
        });
      } catch {}
    }

    appendMailbox({
      teamId,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      kind: 'workitem.result',
      fromMemberId: `member:${role}`,
      payload: {
        assignmentId,
        childTaskId: childTask?.taskId,
        ok,
        summary: structured.summary,
        needsReplan: structured.needsReplan,
        needsHuman: structured.needsHuman,
      },
    });

    appendBlackboard({
      teamId,
      taskId: parentTask?.taskId,
      section: 'tl_runtime',
      entryKey: `result:${assignmentId || childTask?.taskId || id('result')}`,
      value: {
        role,
        assignmentId,
        childTaskId: childTask?.taskId,
        ok,
        summary: structured.summary,
        needsReplan: structured.needsReplan,
        needsHuman: structured.needsHuman,
      },
      metadata: { role, assignmentId, childTaskId: childTask?.taskId },
    });

    extractAndWriteBlackboard({
      teamId,
      taskId: parentTask?.taskId,
      assignmentId,
      role,
      result: { ok, structured, summary: structured.summary, result: rawResultText },
    });

    if (role === 'critic') {
      teamStore?.insertReview?.({
        reviewId: id('review'),
        taskId: parentTask?.taskId,
        targetType: 'child_task',
        targetId: childTask?.taskId || '',
        reviewerMemberId: `member:${role}`,
        memberKey: role,
        contractVersion: structured.contractVersion || 'tl-runtime-v1',
        outputType: structured.outputType || 'review',
        score: ok ? 0.85 : 0.45,
        verdict: ok ? 'approve_with_notes' : 'revise',
        issues: structured.issues,
        createdAt: nowFn(),
      });
    }

    if (role === 'judge') {
      teamStore?.insertDecision?.({
        decisionId: id('decision'),
        taskId: parentTask?.taskId,
        judgeMemberId: `member:${role}`,
        memberKey: role,
        contractVersion: structured.contractVersion || 'tl-runtime-v1',
        outputType: structured.outputType || 'decision',
        decisionType: structured.needsHuman ? 'escalate_human' : (ok ? 'approve' : 'revise'),
        reason: structured.summary || '',
        payload: {
          assignmentId,
          childTaskId: childTask?.taskId,
          issues: structured.issues,
        },
        createdAt: nowFn(),
      });
    }

    await governanceAuditor?.logAgentBehavior?.({
      action: ok ? 'execution_completed' : 'execution_failed',
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      teamId,
      role,
      agentId: `member:${role}`,
      message: structured.summary || rawResultText || '',
      overreach: false,
      sensitiveOperation: !!governanceCheck?.requiresApproval || !!workItem?.requiresApproval,
      categories: ['execution', ok ? 'completed' : 'failed'],
      target: { childTaskId: childTask?.taskId || '', sessionKey: spawn.sessionKey || '' },
      risk: governanceCheck.risk,
      policy: governanceCheck.policy,
      metadata: { via: spawn.via || 'unknown', routedNode: spawn.routedNode || '', scopeKey },
    });

    const execution = {
      kind: 'execution_envelope',
      contractVersion: 'team-runtime-member-execution.v1',
      executionId: id('exec'),
      executionType: 'member.execution',
      ok,
      status: ok ? 'ok' : 'error',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(nowFn()).toISOString(),
      durationMs: Math.max(0, Number(nowFn() - startedAt)),
      source: 'tl-runtime',
      actor: { id: `member:${role}`, role, sessionKey: spawn.sessionKey || '' },
      target: { teamId, taskId: parentTask?.taskId || '', childTaskId: childTask?.taskId || '', assignmentId: assignmentId || '' },
      request: {
        objective,
        acceptance,
        deliverables,
        workItem,
      },
      response: {
        rawResultText,
        structured,
        routedNode: spawn.routedNode || '',
        via: spawn.via || 'unknown',
      },
      metadata: {
        degraded: !!spawn.degraded,
        degradedReason: spawn.degradedReason || '',
        governance: governanceCheck,
      },
      trace: null,
      error: ok ? null : { message: String(waitResult?.error || structured.error || rawResultText || 'execution_failed') },
    };

    const result = {
      ok,
      role,
      assignmentId,
      childTaskId: childTask?.taskId,
      result: rawResultText,
      summary: structured.summary,
      routedNode: spawn.routedNode || '',
      degraded: !!spawn.degraded,
      degradedReason: spawn.degradedReason || '',
      via: spawn.via || 'unknown',
      governance: governanceCheck,
      structured,
      execution,
    };

    await governanceRuntime?.auditTaskEvent?.({
      action: ok ? 'complete' : 'fail',
      status: ok ? 'done' : 'failed',
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      teamId,
      role,
      agentId: `member:${role}`,
      scopeKey,
      message: structured.summary || rawResultText || '',
      risk: governanceCheck.risk,
      policy: governanceCheck.policy,
      metadata: { via: spawn.via || 'unknown', routedNode: spawn.routedNode || '' },
    });

    appendEvidence?.({
      teamId,
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      evidenceType: ok ? 'member.execution.completed' : 'member.execution.failed',
      sourceType: 'member_execution',
      sourceId: execution.executionId,
      title: `${roleDisplayName(role)} execution ${ok ? 'completed' : 'failed'}`,
      detail: execution,
      severity: ok ? 'info' : 'warn',
    });

    publishEvent(ok ? TEAM_EVENT_TYPES.TASK_EXECUTION_COMPLETED : TEAM_EVENT_TYPES.TASK_EXECUTION_FAILED, {
      taskId: parentTask?.taskId || '',
      childTaskId: childTask?.taskId || '',
      assignmentId: assignmentId || '',
      teamId: teamId || '',
      role: role || '',
      scope: scopeKey || '',
      timestamp: nowFn(),
      state: ok ? 'done' : 'failed',
      summary: structured.summary || '',
      error: ok ? '' : String(waitResult?.error || structured.error || rawResultText || 'execution_failed'),
      outputType: structured.outputType || '',
      contractVersion: structured.contractVersion || '',
      routedNode: spawn.routedNode || '',
      via: spawn.via || 'unknown',
    }, {
      scopeKey,
      phase: 'execution',
      event: ok ? 'completed' : 'failed',
      teamId,
      assignmentId,
      childTaskId: childTask?.taskId || '',
    });

    broadcast({
      type: 'orchestration_event',
      eventKind: ok ? 'member.completed' : 'member.failed',
      role,
      lane: role,
      title: ok ? `${roleDisplayName(role)} 完成` : `${roleDisplayName(role)} 失败`,
      content: structured.summary || rawResultText || '',
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      assignmentId,
      scopeKey,
      timestamp: nowFn(),
      status: ok ? 'done' : 'failed',
    });

    broadcast({
      type: 'orchestration_event',
      eventKind: 'role.completed',
      role,
      lane: role,
      title: `${roleDisplayName(role)} ${ok ? '完成' : '失败'}`,
      content: '',
      taskId: parentTask?.taskId,
      childTaskId: childTask?.taskId,
      scopeKey,
      timestamp: nowFn(),
    });

    if (ok && structured.summary) {
      const deliverableLines = ensureArray(structured.deliverables).map((d) => `- ${typeof d === 'string' ? d : (d?.title || d?.name || JSON.stringify(d))}`).join('\n');
      const markdownBody = [
        `**${roleDisplayName(role)}** 已完成`,
        '',
        structured.summary,
        deliverableLines ? `\n**交付物：**\n${deliverableLines}` : '',
      ].filter((s) => s !== undefined).join('\n').trim();

      broadcast({
        type: 'visible_output',
        role,
        title: `${roleDisplayName(role)} 执行结果`,
        text: structured.summary,
        markdown: markdownBody,
        taskId: parentTask?.taskId,
        childTaskId: childTask?.taskId,
        assignmentId,
        scopeKey,
        timestamp: nowFn(),
      });
    }

    return result;
  }

  return {
    unifiedSpawnSession,
    unifiedSendToSession,
    unifiedListSessions,
    unifiedGetSessionHistory,
    spawnAgentSession,
    waitForSessionCompletion,
    runMemberWithSession,
  };
}

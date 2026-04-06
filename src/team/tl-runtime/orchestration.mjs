import { TEAM_EVENT_TYPES } from '../event-types.mjs';

export function createTLOrchestrationHelpers({
  teamStore,
  governanceRuntime,
  governanceAuditor,
  eventBus,
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

  async function executeDelegatedPlan({ teamId, taskId, parentTask, decision, scopeKey } = {}) {
    const orchestrationContext = traceCollector?.getCurrentSpan?.() || null;
    await governanceAuditor?.logTaskLifecycle?.({
      action: 'orchestration_started',
      status: 'running',
      taskId,
      teamId,
      role: 'tl',
      agentId: 'member:tl',
      scopeKey,
      message: `orchestrating ${ensureArray(decision?.workItems).length} work items`,
      risk: { level: decision?.riskLevel || 'medium' },
      policy: { decision: 'allow', ruleId: 'tl_orchestration' },
      metadata: { taskMode: decision?.taskMode || 'general' },
    });
    const planSteps = decision.workItems.map((workItem) => ({
      id: workItem.id,
      role: workItem.role,
      dependsOn: workItem.dependencies,
      payload: { workItem, childTask: null },
    }));
    const capabilityValidation = validateWorkItemCapabilityContracts(decision.workItems, roleConfig);
    if (!capabilityValidation.ok) {
      return failFastTaskOnCapabilityContract({
        teamId,
        taskId,
        parentTask,
        decision,
        scopeKey,
        validation: capabilityValidation,
        phase: 'plan',
      });
    }

    const executionSurfaceValidation = validateWorkItemExecutionSurfaceContracts(decision.workItems, roleConfig);
    if (!executionSurfaceValidation.ok) {
      return failFastTaskOnExecutionSurfaceContract({
        teamId,
        taskId,
        parentTask,
        decision,
        scopeKey,
        validation: executionSurfaceValidation,
        phase: 'plan',
      });
    }

    const dagValidation = validateExecutionDag(planSteps);
    if (!dagValidation.ok) {
      return failFastTaskOnInvalidDag({
        teamId,
        taskId,
        parentTask,
        decision,
        scopeKey,
        validation: dagValidation,
        phase: 'plan',
      });
    }

    const childTasks = decision.workItems.map((workItem) => createChildTask({ parentTask, workItem, teamId, scopeKey }));

    teamStore?.updateTaskMetadata?.({
      taskId,
      metadata: {
        childTaskIds: childTasks.map((t) => t.taskId),
        workItemToChildTask: Object.fromEntries(childTasks.map((t, i) => [decision.workItems[i].id, t.taskId])),
      },
    });

    const layers = dagValidation.layers.map((layer) => layer.map((item) => ({
      ...item,
      payload: {
        ...item.payload,
        childTask: childTasks[decision.workItems.findIndex((workItem) => workItem.id === item.id)],
      },
    })));

    const memberResults = [];
    const resultsByAssignment = {};

    const recoveryConfig = governanceRuntime?.getErrorRecoveryConfig?.() || {
      autoRetry: { enabled: false, maxRetries: 0, retryableErrors: [], backoffMs: 5000 },
      partialSuccess: { enabled: true, preserveCompletedResults: true, retryFailedOnly: true },
    };
    const reviewLoopConfig = governanceRuntime?.getReviewLoopConfig?.() || {
      enabled: false, maxRevisions: 0, triggerOnVerdict: [], skipOnVerdict: ['approve'],
    };
    const dynamicReplanConfig = governanceRuntime?.getDynamicReplanConfig?.() || {
      enabled: true, maxDynamicLayers: 3, maxDynamicWorkItems: 8, allowedRoles: ['executor'], requireTLApproval: false,
    };
    let totalDynamicLayersAdded = 0;
    let totalDynamicWorkItemsAdded = 0;
    let fatalDagFailure = null;

    async function runWithRetry({ payload }) {
      const workItem = payload.workItem;
      const upstreamContext = buildUpstreamContext(workItem, resultsByAssignment, taskId);
      const effectiveTimeout = resolveTimeout(workItem);

      const maxAttempts = recoveryConfig.autoRetry.enabled
        ? Math.max(1, (governanceRuntime?.getStageRetry?.(workItem.role)?.maxAttempts || recoveryConfig.autoRetry.maxRetries || 1))
        : 1;

      let lastResult = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
          const backoffMs = recoveryConfig.autoRetry.backoffMs || 5000;
          broadcast({
            type: 'orchestration_event',
            eventKind: 'member.retry',
            role: workItem.role,
            lane: workItem.role,
            title: `${roleDisplayName(workItem.role)} 重试 (${attempt + 1}/${maxAttempts})`,
            content: `上次错误：${lastResult?.error || lastResult?.summary || 'unknown'}`,
            taskId,
            scopeKey,
            timestamp: nowFn(),
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }

        lastResult = await runMemberWithSession({
          role: workItem.role,
          task: workItem.task,
          objective: workItem.objective,
          acceptance: workItem.acceptance,
          deliverables: workItem.deliverables,
          assignmentId: workItem.id,
          teamId,
          parentTask,
          childTask: payload.childTask,
          scopeKey,
          context: upstreamContext || workItem.context,
          timeoutMs: effectiveTimeout,
          workItem,
          resultsByAssignment,
        });

        if (lastResult?.ok) break;

        const errorText = String(lastResult?.error || lastResult?.summary || '');
        const isRetryable = governanceRuntime?.isRetryableError?.(errorText)
          ?? recoveryConfig.autoRetry.retryableErrors.some((p) => errorText.toLowerCase().includes(p));
        if (!isRetryable) break;
      }

      return lastResult;
    }

    async function runReviewLoop({ executorResult, executorPayload, criticResult, criticPayload }) {
      if (!reviewLoopConfig.enabled || !criticResult) return { executorResult, criticResult, revisionsRun: 0 };

      let currentExecutorResult = executorResult;
      let currentCriticResult = criticResult;
      let revisionsRun = 0;

      for (let rev = 0; rev < reviewLoopConfig.maxRevisions; rev += 1) {
        const structured = currentCriticResult?.structured || {};
        const verdict = String(structured.verdict || (structured.ok ? 'approve' : 'revise')).toLowerCase();
        const resolution = governanceRuntime?.resolveReviewVerdict?.(verdict)
          || { action: verdict === 'revise' ? 'revise' : 'approve', reason: verdict };

        if (resolution.action === 'approve') break;
        if (resolution.action === 'escalate') {
          broadcast({
            type: 'orchestration_event',
            eventKind: 'review.escalate',
            role: 'critic',
            lane: 'critic',
            title: '审查升级到人工',
            content: `verdict=${verdict}, reason=${resolution.reason}`,
            taskId,
            scopeKey,
            timestamp: nowFn(),
          });
          break;
        }

        revisionsRun += 1;
        const criticFeedback = ensureString(structured.summary || currentCriticResult?.result || '');
        const issues = ensureArray(structured.issues)
          .map((i) => `- [${i.severity || 'info'}] ${i.title || ''}: ${i.detail || i.description || ''}`)
          .join('\n');

        broadcast({
          type: 'orchestration_event',
          eventKind: 'review.revision_started',
          role: 'executor',
          lane: 'executor',
          title: `修订执行 (${revisionsRun}/${reviewLoopConfig.maxRevisions})`,
          content: `Critic 要求修订：${criticFeedback.slice(0, 300)}`,
          taskId,
          scopeKey,
          timestamp: nowFn(),
        });

        const revisionWorkItem = {
          ...executorPayload.workItem,
          context: [
            executorPayload.workItem.context || '',
            `## Critic 修订反馈 (第 ${revisionsRun} 次)\n${criticFeedback}`,
            issues ? `### 具体问题\n${issues}` : '',
            `## 你之前的输出摘要\n${ensureString(currentExecutorResult?.summary || currentExecutorResult?.result || '').slice(0, 1500)}`,
            '\n**请根据以上反馈修订你的输出，重点解决标注的问题。**',
          ].filter(Boolean).join('\n\n'),
        };

        currentExecutorResult = await runMemberWithSession({
          role: revisionWorkItem.role,
          task: revisionWorkItem.task,
          objective: revisionWorkItem.objective,
          acceptance: revisionWorkItem.acceptance,
          deliverables: revisionWorkItem.deliverables,
          assignmentId: `${revisionWorkItem.id}:rev${revisionsRun}`,
          teamId,
          parentTask,
          childTask: executorPayload.childTask,
          scopeKey,
          context: revisionWorkItem.context,
          timeoutMs: Number(reviewLoopConfig.revisionTimeoutMs || 300000),
          workItem: revisionWorkItem,
          resultsByAssignment,
        });

        if (!currentExecutorResult?.ok) break;

        if (executorPayload.workItem.id) {
          resultsByAssignment[executorPayload.workItem.id] = currentExecutorResult;
        }

        if (criticPayload) {
          const criticUpstream = buildUpstreamContext(criticPayload.workItem, resultsByAssignment, taskId);
          currentCriticResult = await runMemberWithSession({
            role: 'critic',
            task: criticPayload.workItem.task,
            objective: criticPayload.workItem.objective,
            acceptance: criticPayload.workItem.acceptance,
            deliverables: criticPayload.workItem.deliverables,
            assignmentId: `${criticPayload.workItem.id}:rev${revisionsRun}`,
            teamId,
            parentTask,
            childTask: criticPayload.childTask,
            scopeKey,
            context: criticUpstream || criticPayload.workItem.context,
            timeoutMs: resolveTimeout(criticPayload.workItem),
            workItem: criticPayload.workItem,
            resultsByAssignment,
          });

          if (criticPayload.workItem.id) {
            resultsByAssignment[criticPayload.workItem.id] = currentCriticResult;
          }
        } else {
          break;
        }
      }

      appendMailbox({
        teamId,
        taskId,
        kind: 'review.loop.completed',
        fromMemberId: 'member:tl',
        payload: { revisionsRun, maxRevisions: reviewLoopConfig.maxRevisions },
      });

      return { executorResult: currentExecutorResult, criticResult: currentCriticResult, revisionsRun };
    }

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const layer = layers[layerIndex];
      broadcast({
        type: 'orchestration_event',
        eventKind: 'execution.layer.started',
        role: 'system',
        lane: 'layer',
        title: `执行层 ${layerIndex + 1} 开始`,
        content: layer.map((x) => `${roleDisplayName(x.payload.workItem.role)}（${String(x.payload.workItem.title || x.payload.workItem.objective || '').slice(0, 40)}）`).join('、'),
        taskId,
        scopeKey,
        timestamp: nowFn(),
      });

      const results = await Promise.all(layer.map((item) => {
        const role = String(item?.payload?.workItem?.role || 'member');
        const assignmentId = String(item?.payload?.workItem?.id || '');
        return traceCollector?.withSpan
          ? traceCollector.withSpan(`tl.delegation.${role}`, async () => traceCollector.withSpan(`tl.execution.${role}`, async () => runWithRetry({ payload: item.payload }), { attributes: { assignmentId, role, taskId, teamId } }), { parentContext: orchestrationContext, attributes: { assignmentId, role, taskId, teamId } })
          : runWithRetry({ payload: item.payload });
      }));

      for (const r of results) {
        if (r.assignmentId) resultsByAssignment[r.assignmentId] = r;
      }

      if (reviewLoopConfig.enabled) {
        for (let i = 0; i < layer.length; i += 1) {
          const item = layer[i];
          const result = results[i];
          if (!result?.ok || item.payload.workItem.role !== 'executor') continue;

          const criticId = `${item.payload.workItem.id}:critic`;
          const criticResult = resultsByAssignment[criticId];
          if (!criticResult) continue;

          let criticPayload = null;
          for (const laterLayer of layers.slice(layerIndex + 1)) {
            const found = laterLayer.find((x) => x.payload.workItem.id === criticId);
            if (found) {
              criticPayload = found;
              break;
            }
          }

          const loopResult = await runReviewLoop({
            executorResult: result,
            executorPayload: item,
            criticResult,
            criticPayload,
          });

          if (loopResult.executorResult && item.payload.workItem.id) {
            resultsByAssignment[item.payload.workItem.id] = loopResult.executorResult;
            const idx = memberResults.findIndex((r) => r.assignmentId === item.payload.workItem.id);
            if (idx >= 0) memberResults[idx] = loopResult.executorResult;
          }
          if (loopResult.criticResult && criticId) {
            resultsByAssignment[criticId] = loopResult.criticResult;
            const idx = memberResults.findIndex((r) => r.assignmentId === criticId);
            if (idx >= 0) memberResults[idx] = loopResult.criticResult;
          }
        }
      }

      memberResults.push(...results);

      const dynamicWorkItems = [];
      const replanEnabled = dynamicReplanConfig.enabled && totalDynamicLayersAdded < dynamicReplanConfig.maxDynamicLayers;

      if (replanEnabled) {
        for (const r of results) {
          if (!r?.ok) continue;
          const structured = r.structured || {};
          const proposed = ensureArray(structured.additionalWorkItems);
          if (proposed.length === 0) continue;
          if (!dynamicReplanConfig.allowedRoles.includes(r.role || 'executor')) continue;

          const remaining = dynamicReplanConfig.maxDynamicWorkItems - totalDynamicWorkItemsAdded;
          if (remaining <= 0) break;
          const capped = proposed.slice(0, remaining);

          broadcast({
            type: 'orchestration_event',
            eventKind: 'replan.member_proposed',
            role: r.role,
            lane: r.role,
            title: `${roleDisplayName(r.role)} 提议新增 ${capped.length} 个步骤`,
            content: capped.map((w) => w.title || w.task || '(无标题)').join('、'),
            taskId,
            scopeKey,
            timestamp: nowFn(),
          });

          for (let pi = 0; pi < capped.length; pi += 1) {
            const pw = capped[pi];
            const dynId = `dyn:${r.assignmentId || r.role}:${pi}`;
            dynamicWorkItems.push(normalizeWorkItem({
              id: dynId,
              role: ensureString(pw.role || 'executor'),
              title: ensureString(pw.title || `动态追加任务 ${pi + 1}`),
              objective: ensureString(pw.objective || pw.task || ''),
              task: ensureString(pw.task || pw.objective || ''),
              acceptance: ensureString(pw.acceptance || '完成任务并返回结果'),
              deliverables: ensureArray(pw.deliverables),
              dependencies: ensureArray(pw.dependencies || [r.assignmentId]),
              riskLevel: normalizeRiskLevel(pw.riskLevel || decision.riskLevel),
              needsReview: !!pw.needsReview,
              needsDecision: !!pw.needsDecision,
              requiredCapabilities: ensureArray(pw.requiredCapabilities || pw.capabilitiesNeeded),
              requiredSkills: ensureArray(pw.requiredSkills || pw.skillsNeeded),
              requiredTools: ensureArray(pw.requiredTools || pw.toolsNeeded),
              requiredMcpServers: ensureArray(pw.requiredMcpServers || pw.mcpServersNeeded),
              expectedContractVersion: ensureString(pw.expectedContractVersion || ''),
              expectedOutputType: ensureString(pw.expectedOutputType || pw.outputType || ''),
              context: ensureString(pw.context || `由 ${r.assignmentId || r.role} 在执行中发现需要追加`),
            }, decision.workItems.length + dynamicWorkItems.length));
          }
        }
      }

      if (dynamicWorkItems.length > 0) {
        const dynamicSteps = dynamicWorkItems.map((workItem) => ({
          id: workItem.id,
          role: workItem.role,
          dependsOn: workItem.dependencies,
          payload: { workItem, childTask: null },
        }));
        const dynamicCapabilityValidation = validateWorkItemCapabilityContracts(dynamicWorkItems, roleConfig);
        if (!dynamicCapabilityValidation.ok) {
          fatalDagFailure = {
            phase: 'dynamic_replan_capability',
            validation: dynamicCapabilityValidation,
            kind: 'capability_contract',
          };
        }

        const dynamicExecutionSurfaceValidation = validateWorkItemExecutionSurfaceContracts(dynamicWorkItems, roleConfig);
        if (!fatalDagFailure && !dynamicExecutionSurfaceValidation.ok) {
          fatalDagFailure = {
            phase: 'dynamic_replan_execution_surface',
            validation: dynamicExecutionSurfaceValidation,
            kind: 'execution_surface_contract',
          };
        }

        const dynamicDagValidation = validateExecutionDag(dynamicSteps, {
          allowExternalDeps: Object.keys(resultsByAssignment),
        });

        if (!fatalDagFailure && !dynamicDagValidation.ok) {
          fatalDagFailure = {
            phase: 'dynamic_replan',
            validation: dynamicDagValidation,
            kind: 'dag',
          };
        } else if (!fatalDagFailure) {
          const dynamicLayers = dynamicDagValidation.layers;

          for (const dw of dynamicWorkItems) {
            const dynChildTask = createChildTask({ parentTask, workItem: dw, teamId });
            for (const dynLayer of dynamicLayers) {
              for (const item of dynLayer) {
                if (item.payload.workItem.id === dw.id) {
                  item.payload.childTask = dynChildTask;
                  childTasks.push(dynChildTask);
                }
              }
            }
          }

          layers.push(...dynamicLayers);
          totalDynamicLayersAdded += dynamicLayers.length;
          totalDynamicWorkItemsAdded += dynamicWorkItems.length;

          broadcast({
            type: 'orchestration_event',
            eventKind: 'replan.dynamic_layers_added',
            role: 'system',
            lane: 'replan',
            title: `动态追加 ${dynamicLayers.length} 个执行层（${dynamicWorkItems.length} 个任务）`,
            content: dynamicWorkItems.map((w) => `${roleDisplayName(w.role)}：${w.title}`).join('、'),
            taskId,
            scopeKey,
            timestamp: nowFn(),
          });

          appendMailbox({
            teamId,
            taskId,
            kind: 'replan.dynamic',
            fromMemberId: 'member:tl',
            payload: {
              addedWorkItems: dynamicWorkItems.map((w) => ({ id: w.id, role: w.role, title: w.title })),
              addedLayers: dynamicLayers.length,
              triggeredBy: results.filter((r) => ensureArray(r.structured?.additionalWorkItems).length > 0).map((r) => r.assignmentId),
            },
          });

          appendBlackboard({
            teamId,
            taskId,
            section: 'replan',
            entryKey: `dynamic:layer${layerIndex}`,
            value: {
              addedCount: dynamicWorkItems.length,
              items: dynamicWorkItems.map((w) => ({ id: w.id, role: w.role, title: w.title })),
              timestamp: nowFn(),
            },
          });

          publishEvent(TEAM_EVENT_TYPES.TASK_REPLANNED, {
            taskId: taskId || '',
            teamId: teamId || '',
            scope: scopeKey || '',
            timestamp: nowFn(),
            state: 'replanned',
            addedLayerCount: dynamicLayers.length,
            addedWorkItemCount: dynamicWorkItems.length,
            addedWorkItemIds: dynamicWorkItems.map((w) => w.id),
            triggeredByAssignmentIds: results.filter((r) => ensureArray(r.structured?.additionalWorkItems).length > 0).map((r) => r.assignmentId),
          }, {
            scopeKey,
            phase: 'orchestration',
            event: 'replanned',
            teamId,
          });
        }
      }

      if (fatalDagFailure) break;

      broadcast({
        type: 'orchestration_event',
        eventKind: 'execution.layer.completed',
        role: 'system',
        lane: 'layer',
        title: `执行层 ${layerIndex + 1} 完成`,
        content: results.map((r) => `${roleDisplayName(r.role)}：${r.ok ? '✅ 完成' : '❌ 失败'}`).join('、'),
        taskId,
        scopeKey,
        timestamp: nowFn(),
      });
    }

    const dagFailed = !!fatalDagFailure;
    const anyFailed = dagFailed || memberResults.some((r) => !r.ok);
    const anyNeedsHuman = memberResults.some((r) => r.structured?.needsHuman);

    const successCount = memberResults.filter((r) => r.ok).length;
    const failCount = memberResults.filter((r) => !r.ok).length + (dagFailed ? 1 : 0);
    const partialSuccess = !dagFailed && recoveryConfig.partialSuccess.enabled && successCount > 0 && failCount > 0;
    const escalation = governanceRuntime?.shouldEscalateToHuman?.({
      taskMode: decision.taskMode,
      riskLevel: decision.riskLevel,
      anyFailed,
      anyNeedsHuman,
    }) || { escalate: false };

    const finalReplyParts = [];
    if (decision.type === 'partial_delegate' && decision.directReply) finalReplyParts.push(decision.directReply);
    finalReplyParts.push('TL_FINAL_SUMMARY');
    if (memberResults.length > 0) finalReplyParts.push(...memberResults.map(summarizeMemberResultLine));
    if (dagFailed) {
      if (fatalDagFailure?.kind === 'capability_contract') {
        finalReplyParts.push(formatCapabilityContractErrors(fatalDagFailure.validation, {
          title: fatalDagFailure.phase === 'dynamic_replan_capability'
            ? '动态追加角色能力合同异常（fail fast）'
            : '角色能力合同异常（fail fast）',
        }));
      } else if (fatalDagFailure?.kind === 'execution_surface_contract') {
        finalReplyParts.push(formatExecutionSurfaceContractErrors(fatalDagFailure.validation, {
          title: fatalDagFailure.phase === 'dynamic_replan_execution_surface'
            ? '动态追加 Skill / Tool / MCP 执行面合同异常（fail fast）'
            : 'Skill / Tool / MCP 执行面合同异常（fail fast）',
        }));
      } else {
        finalReplyParts.push(formatDagValidationErrors(fatalDagFailure.validation, {
          title: fatalDagFailure.phase === 'dynamic_replan'
            ? '动态追加 DAG 依赖异常（fail fast）'
            : '规划 DAG 依赖异常（fail fast）',
        }));
      }
    }
    if (partialSuccess) finalReplyParts.push(`### ⚠️ 部分成功\n- 成功：${successCount} / 失败：${failCount}\n- 失败的任务已标记，成功结果已保留`);
    if (escalation?.escalate) finalReplyParts.push(`### escalate_human\n- action: ${escalation.action || 'notify'}\n- reason: ${escalation.reason || ''}`);
    const finalReply = finalReplyParts.join('\n\n');

    if (taskId && workbenchManager?.runReviewPipeline && memberResults.some((r) => ['critic', 'judge'].includes(String(r?.role || '').toLowerCase()))) {
      try { workbenchManager.runReviewPipeline(taskId, { reason: 'tl_runtime_review_stage' }); } catch {}
    }

    const finalState = dagFailed ? 'blocked' : (partialSuccess ? 'partial' : (anyFailed ? 'blocked' : 'done'));
    teamStore?.updateTaskState?.({ taskId, state: finalState, updatedAt: nowFn() });
    teamStore?.updateTeamStatus?.({ teamId, status: anyFailed ? 'needs_attention' : 'done', updatedAt: nowFn() });

    appendArtifactForMemberResult({
      teamId,
      taskId,
      childTaskId: '',
      role: 'tl',
      assignmentId: '',
      title: 'TL 最终总结',
      body: { markdown: finalReply, memberResults },
      metadata: { escalation, partialSuccess, successCount, failCount },
      artifactType: 'tl_summary',
    });

    appendMailbox({
      teamId,
      taskId,
      kind: 'tl.finalized',
      fromMemberId: 'member:tl',
      payload: {
        anyFailed,
        anyNeedsHuman,
        escalation,
        partialSuccess,
        successCount,
        failCount,
        memberResults: memberResults.map((r) => ({
          role: r.role,
          ok: r.ok,
          assignmentId: r.assignmentId,
          childTaskId: r.childTaskId,
        })),
      },
    });

    publishEvent(TEAM_EVENT_TYPES.TASK_COMPLETED, {
      taskId: taskId || '',
      teamId: teamId || '',
      scope: scopeKey || '',
      timestamp: nowFn(),
      state: finalState,
      anyFailed,
      anyNeedsHuman,
      partialSuccess,
      successCount,
      failCount,
      escalation: escalation?.escalate ? escalation : null,
    }, {
      scopeKey,
      phase: 'orchestration',
      event: 'completed',
      teamId,
    });

    if (taskId && workbenchManager) {
      try {
        if (finalState === 'done' && workbenchManager.deliver) {
          workbenchManager.deliver(taskId, 'tl_runtime_finalized');
        }
      } catch {}
    }

    await governanceAuditor?.logTaskLifecycle?.({
      action: 'orchestration_completed',
      status: finalState,
      taskId,
      teamId,
      role: 'tl',
      agentId: 'member:tl',
      scopeKey,
      message: `success=${successCount}, fail=${failCount}`,
      risk: { level: decision?.riskLevel || 'medium' },
      policy: { decision: anyFailed ? 'partial' : 'allow', ruleId: 'tl_orchestration' },
      metadata: {
        anyFailed,
        anyNeedsHuman,
        partialSuccess,
        successCount,
        failCount,
        escalation: escalation?.escalate ? escalation : null,
      },
    });

    return {
      ok: true,
      action: 'tl_delegate',
      reply: finalReply,
      task: teamStore.getTaskById?.(taskId) || parentTask,
      decision,
      taskId,
      teamId,
      childTasks,
      memberResults,
      escalation,
      partialSuccess,
      successCount,
      failCount,
    };
  }

  return {
    executeDelegatedPlan,
  };
}

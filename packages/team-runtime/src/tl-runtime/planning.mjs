import { TEAM_EVENT_TYPES } from '../event-types.mjs';

export function createTLPlanningHelpers({
  teamStore,
  governanceRuntime,
  governanceAuditor,
  roleConfig,
  eventBus,
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

  function createChildTask({ parentTask, workItem, teamId, scopeKey = '' } = {}) {
    const childTaskId = id('task');
    const meta = {
      parentTaskId: parentTask?.taskId || '',
      workItemId: workItem.id,
      workItemRole: workItem.role,
      acceptance: workItem.acceptance,
      deliverables: workItem.deliverables,
      riskLevel: workItem.riskLevel,
      preferredNode: workItem.preferredNode || '',
      taskMode: workItem.role === 'critic' ? 'review' : workItem.role === 'judge' ? 'decision' : 'execution',
      dependencies: workItem.dependencies,
      requiredCapabilities: ensureArray(workItem.requiredCapabilities),
      requiredSkills: ensureArray(workItem.requiredSkills),
      requiredTools: ensureArray(workItem.requiredTools),
      requiredMcpServers: ensureArray(workItem.requiredMcpServers),
      rawWorkItem: workItem.raw,
    };

    const childTask = teamStore?.createTask?.({
      taskId: childTaskId,
      teamId,
      parentTaskId: parentTask?.taskId || '',
      title: workItem.title,
      description: workItem.task,
      state: 'approved',
      ownerMemberId: '',
      priority: parentTask?.priority || 0,
      dependencies: workItem.dependencies,
      metadata: meta,
      createdAt: nowFn(),
      updatedAt: nowFn(),
    });

    appendMailbox({
      teamId,
      taskId: parentTask?.taskId,
      childTaskId,
      kind: 'workitem.created',
      fromMemberId: 'member:tl',
      payload: {
        workItemId: workItem.id,
        childTaskId,
        role: workItem.role,
        title: workItem.title,
        dependencies: workItem.dependencies,
        riskLevel: workItem.riskLevel,
      },
    });

    appendBlackboard({
      teamId,
      taskId: parentTask?.taskId,
      section: 'tl_runtime',
      entryKey: `workitem:${workItem.id}`,
      value: {
        childTaskId,
        role: workItem.role,
        title: workItem.title,
        objective: workItem.objective,
        acceptance: workItem.acceptance,
      },
      metadata: { childTaskId, workItemId: workItem.id },
    });

    teamStore?.updateTaskMetadata?.({
      taskId: childTaskId,
      metadata: {
        lineage: {
          parentTaskId: parentTask?.taskId || '',
          rootTaskId: parentTask?.taskId || '',
          workItemId: workItem.id,
        },
      },
    });

    void governanceRuntime?.auditTaskEvent?.({
      action: 'create',
      status: 'approved',
      taskId: parentTask?.taskId,
      childTaskId,
      assignmentId: workItem.id,
      teamId,
      role: workItem.role,
      agentId: 'member:tl',
      scopeKey,
      message: `create_child_task:${workItem.title || workItem.id}`,
      risk: { level: workItem.riskLevel || 'low' },
      policy: { decision: 'allow', ruleId: 'tl_delegate' },
      metadata: { dependencies: workItem.dependencies, taskMode: meta.taskMode },
    });

    void governanceRuntime?.auditTaskEvent?.({
      action: 'delegate',
      status: 'queued',
      taskId: parentTask?.taskId,
      childTaskId,
      assignmentId: workItem.id,
      teamId,
      role: workItem.role,
      agentId: 'member:tl',
      scopeKey,
      message: `delegate:${workItem.title || workItem.id}`,
      risk: { level: workItem.riskLevel || 'low' },
      policy: { decision: 'allow', ruleId: 'tl_delegate' },
      metadata: { objective: workItem.objective, acceptance: workItem.acceptance },
    });

    void governanceAuditor?.logAgentBehavior?.({
      action: 'task_delegated',
      taskId: parentTask?.taskId,
      childTaskId,
      assignmentId: workItem.id,
      teamId,
      role: workItem.role,
      agentId: 'member:tl',
      message: `tl delegated work item ${workItem.id}`,
      overreach: false,
      sensitiveOperation: normalizeRiskLevel(workItem.riskLevel) === 'high',
      categories: ['delegation', 'planning'],
      target: { childTaskId, title: workItem.title || '' },
      risk: { level: workItem.riskLevel || 'low' },
      policy: { decision: 'allow', ruleId: 'tl_delegate' },
      metadata: { scopeKey, dependencies: ensureArray(workItem.dependencies) },
    });

    const basePayload = {
      taskId: parentTask?.taskId || '',
      childTaskId,
      assignmentId: workItem.id,
      teamId: teamId || '',
      role: workItem.role || '',
      scope: scopeKey || '',
      timestamp: nowFn(),
      state: 'approved',
      title: workItem.title || '',
      objective: workItem.objective || '',
      dependencies: ensureArray(workItem.dependencies),
      riskLevel: workItem.riskLevel || 'low',
    };
    publishEvent(TEAM_EVENT_TYPES.TASK_CHILD_CREATED, basePayload, { scopeKey, phase: 'planning', event: 'child_created', teamId });
    publishEvent(TEAM_EVENT_TYPES.TASK_DELEGATED, basePayload, { scopeKey, phase: 'planning', event: 'delegated', teamId });

    return childTask;
  }

  function workItemNeedsAutoCritic(workItem = {}) {
    if (String(workItem.role || '') !== 'executor') return false;
    const skip = governanceRuntime?.shouldSkipStage?.('critic', { riskLevel: workItem.riskLevel, taskMode: 'execution' });
    if (skip?.skip) return false;
    return true;
  }

  function workItemNeedsAutoJudge(workItem = {}) {
    const skip = governanceRuntime?.shouldSkipStage?.('judge', { riskLevel: workItem.riskLevel, taskMode: 'execution' });
    if (skip?.skip) return false;
    return workItem.needsDecision || normalizeRiskLevel(workItem.riskLevel) === 'high' || String(workItem.role || '') === 'critic';
  }

  function synthesizeGovernedWorkItems(decision = {}) {
    const initial = ensureArray(decision.workItems).map((w, index) => normalizeWorkItem(w, index));
    const out = [];

    for (const workItem of initial) {
      out.push(workItem);

      if (workItemNeedsAutoCritic(workItem)) {
        out.push(normalizeWorkItem({
          id: `${workItem.id}:critic`,
          role: 'critic',
          title: `评审 ${workItem.title}`,
          objective: `评审 workItem ${workItem.id} 的结果质量与风险`,
          task: `请对 ${workItem.id}（${workItem.title}）的输出做 review，指出问题、风险、建议。`,
          acceptance: '给出结构化 review 结论',
          deliverables: [`review:${workItem.id}`],
          dependencies: [workItem.id],
          riskLevel: workItem.riskLevel,
          needsDecision: normalizeRiskLevel(workItem.riskLevel) === 'high',
          context: `上游 workItem=${workItem.id}`,
        }, out.length));
      }

      if (workItemNeedsAutoJudge(workItem)) {
        out.push(normalizeWorkItem({
          id: `${workItem.id}:judge`,
          role: 'judge',
          title: `裁决 ${workItem.title}`,
          objective: `对 ${workItem.id} 做最终判断`,
          task: `请对 ${workItem.id} 的结果进行 judge，决定 approve / revise / escalate_human。`,
          acceptance: '给出结构化 decision 结果',
          deliverables: [`decision:${workItem.id}`],
          dependencies: workItemNeedsAutoCritic(workItem) ? [`${workItem.id}:critic`] : [workItem.id],
          riskLevel: 'high',
          needsDecision: true,
          context: `上游 workItem=${workItem.id}`,
        }, out.length));
      }
    }

    return out;
  }

  function initializeTaskDeliveryContract({ task, decision } = {}) {
    if (!task?.taskId || !teamStore?.updateTaskMetadata || typeof createDeliveryContract !== 'function') return null;

    const rawDecision = decision?.raw && typeof decision.raw === 'object' ? decision.raw : {};
    const expectedDeliverables = ensureArray(
      rawDecision.expectedDeliverables
      || rawDecision.delivery?.expectedDeliverables
      || rawDecision.deliveryExpectations
    );
    const inferredDeliverables = expectedDeliverables.length > 0
      ? expectedDeliverables
      : ensureArray(decision?.workItems)
        .flatMap((item, index) => ensureArray(item?.deliverables).map((deliverable, dIndex) => ({
          id: `${item?.id || `workitem:${index + 1}`}:deliverable:${dIndex + 1}`,
          title: typeof deliverable === 'string' ? deliverable : (deliverable?.title || deliverable?.name || `Deliverable ${dIndex + 1}`),
          artifactType: typeof deliverable === 'object' ? deliverable?.artifactType : undefined,
          required: typeof deliverable === 'object' ? deliverable?.required : true,
          acceptanceCriteria: ensureArray(typeof deliverable === 'object' ? deliverable?.acceptanceCriteria : []),
          qualityCriteria: ensureArray(typeof deliverable === 'object' ? deliverable?.qualityCriteria : []),
          sourceStepIds: [item?.id || `workitem:${index + 1}`],
        })));

    if (inferredDeliverables.length === 0) return null;

    const contract = createDeliveryContract({
      taskId: task.taskId,
      title: task.title,
      summary: decision?.summary || task.description || task.title,
      expectedDeliverables: inferredDeliverables,
      metadata: {
        source: 'tl_runtime_plan',
        taskMode: decision?.taskMode || task?.metadata?.taskMode || 'general',
        riskLevel: decision?.riskLevel || task?.metadata?.riskLevel || 'medium',
      },
    });

    const currentMetadata = task?.metadata || {};
    const currentWorkbench = currentMetadata.workbench || {};
    teamStore.updateTaskMetadata({
      taskId: task.taskId,
      metadata: {
        ...currentMetadata,
        workbench: {
          ...currentWorkbench,
          deliveryContract: contract,
          updatedAt: nowFn(),
        },
      },
      updatedAt: nowFn(),
    });
    return contract;
  }

  function summarizeMemberResultLine(r = {}) {
    const s = r.structured || parseStructuredMemberResult(r.result || '', { ok: r.ok !== false, summary: r.summary || r.result || r.error || '' });
    return `### ${roleDisplayName(r.role)} ${r.ok ? '✅' : '❌'}${r.routedNode ? ` [${r.routedNode}]` : ''}\n- 摘要：${s.summary || r.result || r.error || ''}\n- 交付物：${ensureArray(s.deliverables).length} 个`;
  }

  return {
    createChildTask,
    synthesizeGovernedWorkItems,
    initializeTaskDeliveryContract,
    summarizeMemberResultLine,
  };
}

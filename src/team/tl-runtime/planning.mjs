export function createTLPlanningHelpers({
  teamStore,
  governanceRuntime,
  roleConfig,
  appendMailbox,
  appendBlackboard,
  nowFn,
  id,
  ensureArray,
  normalizeRiskLevel,
  normalizeWorkItem,
  parseStructuredMemberResult,
  roleDisplayName,
} = {}) {
  function createChildTask({ parentTask, workItem, teamId } = {}) {
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

  function summarizeMemberResultLine(r = {}) {
    const s = r.structured || parseStructuredMemberResult(r.result || '', { ok: r.ok !== false, summary: r.summary || r.result || r.error || '' });
    return `### ${roleDisplayName(r.role)} ${r.ok ? '✅' : '❌'}${r.routedNode ? ` [${r.routedNode}]` : ''}\n- 摘要：${s.summary || r.result || r.error || ''}\n- 交付物：${ensureArray(s.deliverables).length} 个`;
  }

  return {
    createChildTask,
    synthesizeGovernedWorkItems,
    summarizeMemberResultLine,
  };
}

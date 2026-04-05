import { randomUUID } from 'node:crypto';

export function buildCanonicalPlannerPlan({
  summary = '生成一版可执行且可验证的团队计划。',
  steps = ['确认上下文', '执行关键动作', '验证结果'],
  risks = ['回调或状态落库与预期不一致'],
  source = 'planner_canonical_helper',
} = {}) {
  return {
    ok: true,
    type: 'team.plan.v2',
    contractVersion: 'planner.plan.v2',
    summary,
    steps,
    risks,
    successCriteria: ['plan_is_actionable', 'steps_are_ordered', 'risks_are_explicit'],
    evidenceRequirements: ['task_context_cited', 'steps_have_exit_criteria', 'risks_have_mitigation'],
    source,
  };
}

export function buildCanonicalPlannerCompletion({
  runId,
  childSessionKey,
  plan,
} = {}) {
  const resolvedPlan = plan || buildCanonicalPlannerPlan();
  return {
    runId: String(runId || `run:planner:${randomUUID()}`),
    childSessionKey: String(childSessionKey || ''),
    text: JSON.stringify(resolvedPlan),
  };
}

export function buildPlannerCompletionPayload({
  taskId,
  plannerMemberId,
  runId,
  childSessionKey,
  plan,
} = {}) {
  return {
    taskId,
    plannerMemberId,
    completion: buildCanonicalPlannerCompletion({
      runId,
      childSessionKey,
      plan,
    }),
  };
}

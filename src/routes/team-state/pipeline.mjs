import { buildTaskObservability } from './task-observability-shared.mjs';

export function tryHandleTeamPipelineRoute(req, res, ctx = {}) {
  const { sendJson, buildStableEnvelope, parseUrlParam, teamStore, snapshotTask, helpers } = ctx;
  if (!(req.method === 'GET' && req.url?.startsWith('/state/team/pipeline'))) return false;
  const taskId = parseUrlParam(req.url, 'taskId');
  const s = snapshotTask(teamStore, taskId);
  if (!s.task) {
    sendJson(res, 404, { ok: false, error: 'task_not_found' });
    return true;
  }
  const state = String(s.task.state || '');
  let phase = 'unknown';
  let phaseProgress = 0;
  if (state === 'pending') { phase = 'pending'; phaseProgress = 0; }
  else if (state === 'planning' || state === 'plan_requested') { phase = 'planning'; phaseProgress = 10; }
  else if (state === 'plan_review') { phase = 'review'; phaseProgress = 30; }
  else if (state === 'approved') { phase = 'approved'; phaseProgress = 60; }
  else if (state === 'revision_requested') { phase = 'revision'; phaseProgress = 25; }
  else if (state === 'done') { phase = 'done'; phaseProgress = 100; }
  else if (state === 'blocked') { phase = 'blocked'; phaseProgress = -1; }
  else if (state === 'cancelled') { phase = 'cancelled'; phaseProgress = -1; }

  const hasPlan = !!s.plan || s.blackboard.some((e) => String(e?.entryKey || '').startsWith('plan:'));
  const hasReview = s.reviews.length > 0;
  const hasDecision = s.decisions.length > 0;
  const latestVerdict = s.latestReview ? String(s.latestReview.verdict || '') : null;
  const latestDecisionType = s.latestDecision ? String(s.latestDecision.decisionType || '') : null;
  const revisionCount = s.reviews.filter((r) => String(r?.verdict || '').toLowerCase() === 'revise').length;
  const allIssues = s.reviews.flatMap((r) => Array.isArray(r?.issues) ? r.issues : []);
  const issueStats = {
    total: allIssues.length,
    critical: allIssues.filter((i) => i?.severity === 'critical').length,
    major: allIssues.filter((i) => i?.severity === 'major').length,
    minor: allIssues.filter((i) => i?.severity === 'minor').length,
    suggestion: allIssues.filter((i) => i?.severity === 'suggestion').length,
  };
  let estimatedCompletion = 'unknown';
  if (phase === 'done') estimatedCompletion = 'complete';
  else if (phase === 'blocked') estimatedCompletion = 'requires_human_intervention';
  else if (phase === 'cancelled') estimatedCompletion = 'cancelled';
  else if (hasDecision && latestDecisionType === 'approve') estimatedCompletion = 'imminent';
  else if (hasReview && latestVerdict === 'approve') estimatedCompletion = 'pending_judge';
  else if (revisionCount >= 3) estimatedCompletion = 'likely_escalation';
  else if (hasPlan && !hasReview) estimatedCompletion = 'pending_review';
  else if (!hasPlan) estimatedCompletion = 'pending_plan';
  const obs = buildTaskObservability(s, helpers);

  sendJson(res, 200, buildStableEnvelope({
    route: 'pipeline',
    resourceKind: 'task_pipeline',
    resource: {
      kind: 'task_pipeline',
      taskId,
      teamId: s.task.teamId,
      batchId: String(s.task.metadata?.batchId || ''),
      state,
    },
    query: { taskId },
    payload: {
      ok: true,
      pipeline: {
        taskId,
        teamId: s.task.teamId,
        title: s.task.title || '',
        state,
        phase,
        phaseProgress,
        estimatedCompletion,
        currentMemberKey: s.currentMemberKey,
        protocolSource: obs.protocolSource,
      },
      roles: {
        planner: { completed: hasPlan, status: hasPlan ? 'done' : (state === 'planning' ? 'in_progress' : 'pending'), ...s.protocol.planner },
        critic: { completed: hasReview, reviewCount: s.reviews.length, lastVerdict: latestVerdict, ...s.protocol.critic },
        judge: { completed: hasDecision, decisionCount: s.decisions.length, lastDecisionType: latestDecisionType, ...s.protocol.judge },
      },
      revisions: {
        count: revisionCount,
        maxAllowed: 3,
        nearLimit: revisionCount >= 2,
        exceeded: revisionCount >= 3,
      },
      issues: issueStats,
      timeline: {
        createdAt: s.task.createdAt,
        updatedAt: s.task.updatedAt,
        lastReviewAt: s.latestReview?.createdAt || null,
        lastDecisionAt: s.latestDecision?.createdAt || null,
      },
      childTasks: s.childTasks.slice(0, 48).map((child) => ({
        taskId: String(child.taskId || ''),
        parentTaskId: String(child.parentTaskId || ''),
        title: String(child.title || ''),
        state: String(child.state || ''),
        role: String(child.metadata?.workItemRole || ''),
        assignmentId: String(child.metadata?.workItemId || ''),
        acceptance: String(child.metadata?.acceptance || ''),
        deliverables: Array.isArray(child.metadata?.deliverables) ? child.metadata.deliverables.slice(0, 8) : [],
        dependencies: Array.isArray(child.metadata?.dependencies) ? child.metadata.dependencies.slice(0, 8) : [],
        executionSurface: child.executionSurface || { requiredCapabilities: [], requiredSkills: [], requiredTools: [], requiredMcpServers: [], allowedSkills: [], allowedTools: [], allowedMcpServers: [] },
      })),
      executionSurface: {
        childTaskCount: s.childTasks.length,
        skillBoundCount: s.childTasks.filter((child) => (child.executionSurface?.requiredSkills || []).length > 0).length,
        toolBoundCount: s.childTasks.filter((child) => (child.executionSurface?.requiredTools || []).length > 0).length,
        mcpBoundCount: s.childTasks.filter((child) => (child.executionSurface?.requiredMcpServers || []).length > 0).length,
      },
      memoryLayers: obs.memoryLayers,
      artifacts: {
        total: s.artifacts.length,
        latest: s.artifacts.slice(0, 5),
      },
      evidence: {
        total: s.evidence.length,
        latest: s.evidence.slice(0, 5),
      },
    },
  }));
  return true;
}

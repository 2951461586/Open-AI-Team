import { buildTaskObservability } from './task-observability-shared.mjs';

export function tryHandleTeamSummaryRoute(req, res, ctx = {}) {
  const { sendJson, buildStableEnvelope, parseUrlParam, rejectDashboardUnauthorized, isDashboardAuthorized, teamStore, snapshotTask, helpers } = ctx;
  if (!(req.method === 'GET' && req.url?.startsWith('/state/team/summary'))) return false;
  if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
  const taskId = parseUrlParam(req.url, 'taskId');
  const s = snapshotTask(teamStore, taskId);
  if (!s.task) {
    sendJson(res, 404, { ok: false, error: 'task_not_found' });
    return true;
  }
  const obs = buildTaskObservability(s, helpers);
  sendJson(res, 200, buildStableEnvelope({
    route: 'summary',
    resourceKind: 'task_summary',
    resource: {
      kind: 'task_summary',
      taskId,
      teamId: s.task.teamId,
      state: s.task.state || '',
    },
    query: { taskId },
    payload: {
      ok: true,
      taskId,
      title: s.task.title || '',
      state: s.task.state || '',
      requestedNode: s.requestedNode,
      actualNode: s.actualNode,
      degradedReason: s.degradedReason,
      sessionMode: String(s.task?.metadata?.sessionMode || ''),
      sessionPersistent: !!s.task?.metadata?.sessionPersistent,
      sessionFallbackReason: String(s.task?.metadata?.sessionFallbackReason || ''),
      sessionKey: String(s.task?.metadata?.sessionKey || s.task?.metadata?.primarySessionKey || ''),
      sessionsByRole: s.task?.metadata?.sessionsByRole || {},
      followupRoute: String(s.task?.metadata?.followupRoute || ''),
      deliveryStatus: obs.deliveryStatus,
      interventionStatus: obs.interventionStatus,
      nextBestAction: obs.nextBestAction,
      executiveSummary: obs.executiveSummary,
      currentMemberKey: s.currentMemberKey,
      protocolSource: obs.protocolSource,
      protocol: {
        plan: s.protocol.planner,
        review: s.protocol.critic,
        decision: s.protocol.judge,
      },
      deliverableReady: obs.deliveryStatus === 'deliverable_ready',
      humanInterventionReady: obs.interventionStatus !== 'no_intervention_needed',
      counters: {
        artifactCount: s.artifacts.length,
        evidenceCount: s.evidence.length,
        issueCount: obs.issueCount,
        revisionCount: obs.revisionCount,
      },
      memoryLayers: obs.memoryLayers,
    },
  }));
  return true;
}

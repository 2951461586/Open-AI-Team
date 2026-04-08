import { buildTaskObservability } from './task-observability-shared.mjs';

export function tryHandleTeamControlRoute(req, res, ctx = {}) {
  const { sendJson, buildStableEnvelope, parseUrlParam, teamStore, snapshotTask, helpers } = ctx;
  if (!(req.method === 'GET' && req.url?.startsWith('/state/team/control'))) return false;
  const taskId = parseUrlParam(req.url, 'taskId');
  const s = snapshotTask(teamStore, taskId);
  if (!s.task) {
    sendJson(res, 404, { ok: false, error: 'task_not_found' });
    return true;
  }
  const obs = buildTaskObservability(s, helpers);
  sendJson(res, 200, buildStableEnvelope({
    route: 'control',
    resourceKind: 'task_control',
    resource: {
      kind: 'task_control',
      taskId,
      teamId: s.task.teamId,
      state: s.task.state || '',
    },
    query: { taskId },
    payload: {
      ok: true,
      taskId,
      state: s.task.state || '',
      manualActions: obs.manualActions,
      controlEndpoint: '/internal/team/control',
      examples: obs.manualActions.map((action) => ({ action, taskId })),
    },
  }));
  return true;
}

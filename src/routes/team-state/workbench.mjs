import { buildTaskObservability } from './task-observability-shared.mjs';

export function tryHandleTeamWorkbenchRoute(req, res, ctx = {}) {
  const {
    sendJson,
    buildStableEnvelope,
    parseUrlParam,
    rejectDashboardUnauthorized,
    isDashboardAuthorized,
    teamStore,
    snapshotTask,
    helpers,
  } = ctx;
  if (!(req.method === 'GET' && req.url?.startsWith('/state/team/workbench'))) return false;
  if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
  const taskId = parseUrlParam(req.url, 'taskId');
  const s = snapshotTask(teamStore, taskId);
  if (!s.task) {
    sendJson(res, 404, { ok: false, error: 'task_not_found' });
    return true;
  }
  const obs = buildTaskObservability(s, helpers);
  sendJson(res, 200, buildStableEnvelope({
    route: 'workbench',
    resourceKind: 'task_workbench',
    resource: {
      kind: 'task_workbench',
      taskId,
      teamId: s.task.teamId,
      state: s.task.state || '',
      requestedNode: s.requestedNode,
      actualNode: s.actualNode,
      degradedReason: s.degradedReason,
      sessionMode: String(s.task?.metadata?.sessionMode || ''),
      sessionPersistent: !!s.task?.metadata?.sessionPersistent,
      sessionFallbackReason: String(s.task?.metadata?.sessionFallbackReason || ''),
    },
    query: { taskId },
    api: { access: 'dashboard_token', sensitivity: 'medium' },
    payload: {
      ok: true,
      board: {
        plan: helpers.redactPlan(s.plan),
        latestReview: helpers.redactReview(s.latestReview),
        latestDecision: helpers.redactDecision(s.latestDecision),
        artifactCount: s.artifacts.length,
        evidenceCount: s.evidence.length,
        blackboardCount: s.blackboard.length,
        mailboxCount: s.mailbox.length,
        mailbox: s.mailbox.slice(0, 20).map(helpers.sanitizeMailboxEntry),
        latestReplanMap: helpers.buildLatestReplanMap(s),
        memoryLayers: obs.memoryLayers,
        childTasks: s.childTasks.slice(0, 32).map((child) => ({
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
      },
      summary: {
        artifactCount: s.artifacts.length,
        evidenceCount: s.evidence.length,
        issueCount: obs.issueCount,
        hasPlan: !!s.plan,
        hasReview: s.reviews.length > 0,
        hasDecision: s.decisions.length > 0,
        deliverableReady: obs.deliveryStatus === 'deliverable_ready',
        humanInterventionReady: obs.interventionStatus !== 'no_intervention_needed',
        deliveryStatus: obs.deliveryStatus,
        interventionStatus: obs.interventionStatus,
        currentDriver: obs.currentDriver,
        nextBestAction: obs.nextBestAction,
        executiveSummary: obs.executiveSummary,
        manualActions: obs.manualActions,
        requestedNode: s.requestedNode,
        actualNode: s.actualNode,
        degradedReason: s.degradedReason,
        sessionMode: String(s.task?.metadata?.sessionMode || ''),
        sessionPersistent: !!s.task?.metadata?.sessionPersistent,
        sessionFallbackReason: String(s.task?.metadata?.sessionFallbackReason || ''),
        currentMemberKey: s.currentMemberKey,
        protocolSource: obs.protocolSource,
        executionSurface: {
          childTaskCount: s.childTasks.length,
          skillBoundCount: s.childTasks.filter((child) => (child.executionSurface?.requiredSkills || []).length > 0).length,
          toolBoundCount: s.childTasks.filter((child) => (child.executionSurface?.requiredTools || []).length > 0).length,
          mcpBoundCount: s.childTasks.filter((child) => (child.executionSurface?.requiredMcpServers || []).length > 0).length,
        },
        memoryLayers: obs.memoryLayers,
        protocol: {
          plan: helpers.summarizeProtocol(s.protocol.planner),
          review: helpers.summarizeProtocol(s.protocol.critic),
          decision: helpers.summarizeProtocol(s.protocol.judge),
        },
      },
      summaryLinks: {
        governance: `/state/team/governance?taskId=${encodeURIComponent(String(taskId || ''))}`,
        pipeline: `/state/team/pipeline?taskId=${encodeURIComponent(String(taskId || ''))}`,
        control: `/state/team/control?taskId=${encodeURIComponent(String(taskId || ''))}`,
        archive: `/state/team/archive?limit=200`,
      },
      currentMemberKey: s.currentMemberKey,
      boundary: {
        access: 'dashboard_token',
        sensitivity: 'medium',
        redaction: 'workbench_compact',
      },
    },
  }));
  return true;
}

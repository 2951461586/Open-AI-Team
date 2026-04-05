export const TEAM_QUERY_API_CONTRACT = 'team.governance.query.v1';
export const TEAM_QUERY_API_VERSION = 'v1';
export const TEAM_QUERY_STABLE_ENVELOPE_FIELDS = ['api', 'resource', 'query', 'links'];
export const TEAM_PUBLISHED_ROUTE_KEYS = ['summary', 'workbenchPayload', 'pipeline', 'control', 'residents', 'dashboard'];

export const TEAM_QUERY_ROUTE_CATALOG = {
  root: { path: '/state/team', resourceKind: 'team_collection', requiredTopLevel: ['api', 'resource', 'query', 'links', 'governance'] },
  contracts: { path: '/state/team/contracts', resourceKind: 'contract_catalog', requiredTopLevel: ['api', 'resource', 'query', 'links', 'contracts', 'queryContracts'] },
  summary: { path: '/state/team/summary', resourceKind: 'task_summary', requiredTopLevel: ['api', 'resource', 'query', 'links', 'currentMemberKey', 'protocol'] },
  workbench: { path: '/state/team/workbench', resourceKind: 'task_workbench', requiredTopLevel: ['api', 'resource', 'query', 'links', 'board', 'summary'] },
  governance: { path: '/state/team/governance', resourceKind: 'task_governance', requiredTopLevel: ['api', 'resource', 'query', 'links', 'protocol', 'timeline'] },
  pipeline: { path: '/state/team/pipeline', resourceKind: 'task_pipeline', requiredTopLevel: ['api', 'resource', 'query', 'links', 'pipeline', 'roles'] },
  board: { path: '/state/team/board', resourceKind: 'task_board', requiredTopLevel: ['api', 'resource', 'query', 'links', 'board'] },
  dashboard: { path: '/state/team/dashboard', resourceKind: 'task_dashboard', requiredTopLevel: ['api', 'resource', 'query', 'links', 'dashboard'] },
  threads: { path: '/state/team/threads', resourceKind: 'thread_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  threadSummary: { path: '/state/team/thread-summary', resourceKind: 'thread_summary', requiredTopLevel: ['api', 'resource', 'query', 'links', 'thread'] },
  queue: { path: '/state/team/queue', resourceKind: 'task_queue', requiredTopLevel: ['api', 'resource', 'query', 'links', 'queue'] },
  archive: { path: '/state/team/archive', resourceKind: 'task_archive', requiredTopLevel: ['api', 'resource', 'query', 'links', 'archive'] },
  tasks: { path: '/state/team/tasks', resourceKind: 'task_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  mailbox: { path: '/state/team/mailbox', resourceKind: 'mailbox_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  blackboard: { path: '/state/team/blackboard', resourceKind: 'blackboard_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  artifacts: { path: '/state/team/artifacts', resourceKind: 'artifact_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  evidence: { path: '/state/team/evidence', resourceKind: 'evidence_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  control: { path: '/state/team/control', resourceKind: 'task_control', requiredTopLevel: ['api', 'resource', 'query', 'links', 'manualActions'] },
  workbenchPayload: { path: '/state/team/workbench', resourceKind: 'task_workbench', requiredTopLevel: ['api', 'resource', 'query', 'links', 'board', 'summary'] },
  residents: { path: '/state/team/residents', resourceKind: 'resident_registry', requiredTopLevel: ['api', 'resource', 'query', 'links', 'residents', 'counts'] },
  nodes: { path: '/state/team/nodes', resourceKind: 'node_status', requiredTopLevel: ['api', 'resource', 'query', 'links', 'nodes'] },
  observer: { path: '/state/team/observer', resourceKind: 'observer_state', requiredTopLevel: ['api', 'resource', 'query', 'links', 'observer'] },
  ingress: { path: '/state/team/ingress', resourceKind: 'ingress_list', requiredTopLevel: ['api', 'resource', 'query', 'links', 'items'] },
  config: { path: '/state/team/config', resourceKind: 'team_config', requiredTopLevel: ['api', 'resource', 'query', 'links', 'config', 'configStatus'] },
  outputInvestigate: { path: '/state/team/output-investigate', resourceKind: 'output_investigation', requiredTopLevel: ['api', 'resource', 'query', 'links'] },
};

export function buildStateQueryContracts() {
  const routes = { ...TEAM_QUERY_ROUTE_CATALOG };
  const featuredRoutes = Object.fromEntries(
    TEAM_PUBLISHED_ROUTE_KEYS.map((key) => [key, routes[key] || null]),
  );
  return {
    contract: TEAM_QUERY_API_CONTRACT,
    version: TEAM_QUERY_API_VERSION,
    stableEnvelopeFields: TEAM_QUERY_STABLE_ENVELOPE_FIELDS.slice(),
    featuredRouteKeys: TEAM_PUBLISHED_ROUTE_KEYS.slice(),
    featuredRoutes,
    routes,
  };
}

export function buildStableApiMeta({ route = '', resourceKind = '', stable = true, access = 'public', sensitivity = 'low' } = {}) {
  return {
    namespace: 'team.governance.query',
    contract: TEAM_QUERY_API_CONTRACT,
    version: TEAM_QUERY_API_VERSION,
    route: String(route || ''),
    resourceKind: String(resourceKind || ''),
    stable: stable !== false,
    access: String(access || 'public'),
    sensitivity: String(sensitivity || 'low'),
  };
}

export function buildStableLinks({ route = '', taskId = '', query = {} } = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v == null || v === '') continue;
    q.set(k, String(v));
  }
  const normalizedRoute = String(route || '').replace(/^\/+/, '');
  const basePath = !normalizedRoute || normalizedRoute === 'root'
    ? '/state/team'
    : `/state/team/${normalizedRoute}`;
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const taskQuery = taskId ? `?taskId=${encodeURIComponent(String(taskId || ''))}` : '';
  return {
    self: `${basePath}${suffix}`,
    root: '/state/team',
    contracts: '/state/team/contracts',
    ...(taskId ? {
      summary: `/state/team/summary${taskQuery}`,
      workbench: `/state/team/workbench${taskQuery}`,
      governance: `/state/team/governance${taskQuery}`,
      pipeline: `/state/team/pipeline${taskQuery}`,
      control: `/state/team/control${taskQuery}`,
      threads: `/state/team/threads${taskQuery}`,
    } : {}),
    ...(route === 'thread-summary' && query?.threadId ? {
      threadSummary: `/state/team/thread-summary?threadId=${encodeURIComponent(String(query.threadId || ''))}`,
    } : {}),
  };
}

export function buildStableEnvelope({ route = '', resourceKind = '', resource = null, query = {}, links = {}, payload = {}, api = {} } = {}) {
  return {
    api: buildStableApiMeta({ route, resourceKind, ...(api || {}) }),
    resource: resource || null,
    query: query || {},
    links: {
      ...buildStableLinks({ route, taskId: resource?.taskId || '', query }),
      ...(links || {}),
    },
    ...(payload || {}),
  };
}

export function tryHandleTeamAgentsRoute(req, res, ctx = {}) {
  const { sendJson, buildStableEnvelope, parseUrlParam, agentLifecycle } = ctx;
  if (!(req.method === 'GET' && req.url?.startsWith('/state/team/agents'))) return false;
  const role = String(parseUrlParam(req.url, 'role') || '').trim();
  const node = String(parseUrlParam(req.url, 'node') || '').trim();
  const activeOnly = String(parseUrlParam(req.url, 'activeOnly') || 'false') === 'true';
  const config = agentLifecycle?.getConfig?.() || {};
  const allAgents = activeOnly
    ? (agentLifecycle?.getActiveAgents?.({ role, node }) || [])
    : (agentLifecycle?.snapshot?.() || []).filter((item) => {
        if (role && String(item?.role || '') !== role) return false;
        if (node && String(item?.node || '') !== node) return false;
        return true;
      });
  const stats = agentLifecycle?.stats?.() || {
    count: allAgents.length,
    activeCount: allAgents.filter((item) => String(item?.status || '') === 'active').length,
    drainingCount: allAgents.filter((item) => String(item?.status || '') === 'draining').length,
    byRole: {},
    byNode: {},
  };

  sendJson(res, 200, buildStableEnvelope({
    route: 'agents',
    resourceKind: 'agent_lifecycle',
    resource: {
      kind: 'agent_lifecycle',
      count: Number(allAgents.length || 0),
    },
    query: { role, node, activeOnly },
    payload: {
      ok: true,
      agents: allAgents,
      stats,
      config,
      observedAt: Date.now(),
    },
  }));
  return true;
}

import { loadTeamRolesConfig } from '../../team/team-roles-config.mjs';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID } from '../../team/team-node-ids.mjs';

export function tryHandleTeamNodesRoute(req, res, ctx = {}) {
  const { sendJson, buildStableEnvelope, teamNodeHealth, TEAM_ROLE_DEPLOYMENT } = ctx;
  if (!(req.method === 'GET' && req.url === '/state/team/nodes')) return false;
  const status = teamNodeHealth?.getNodeStatusSync ? teamNodeHealth.getNodeStatusSync() : { ts: Date.now(), [DEFAULT_NODE_ID]: null, [OBSERVER_NODE_ID]: null };
  const weights = teamNodeHealth?.computeNodeWeights ? teamNodeHealth.computeNodeWeights() : {};
  const recommendation = teamNodeHealth?.selectBestNode ? teamNodeHealth.selectBestNode(OBSERVER_NODE_ID, DEFAULT_NODE_ID, 0) : null;
  const deploymentList = TEAM_ROLE_DEPLOYMENT?.list ? TEAM_ROLE_DEPLOYMENT.list() : null;
  const deploymentConfig = loadTeamRolesConfig();
  const nodeMap = deploymentConfig?.nodeMap || {};
  const enrichedNodes = Object.fromEntries(
    Object.entries(status || {}).map(([key, value]) => {
      if (key === 'ts' || !value || typeof value !== 'object') return [key, value];
      const nodeInfo = nodeMap?.[key] || {};
      const weightInfo = weights?.[key] || {};
      return [key, {
        ...value,
        weight: Number(weightInfo?.weight || 0),
        pressureReason: String(weightInfo?.reason || ''),
        recommended: String(recommendation?.selectedNode || '') === String(key),
        connectivity: {
          mode: String(nodeInfo?.connectivity || ''),
          controlBaseUrl: String(nodeInfo?.controlBaseUrl || ''),
          controlHost: String(nodeInfo?.host || ''),
          controlPort: Number(nodeInfo?.controlPort || 0) || undefined,
          tailnetHost: String(nodeInfo?.host || ''),
          tailnetIp: String(nodeInfo?.tailnetIp || ''),
          note: String(nodeInfo?.note || nodeInfo?.description || ''),
        },
      }];
    })
  );
  sendJson(res, 200, buildStableEnvelope({
    route: 'nodes',
    resourceKind: 'node_status',
    resource: {
      kind: 'node_status',
      count: Object.keys(status || {}).length,
    },
    query: {},
    payload: {
      ok: true,
      nodes: enrichedNodes,
      recommendation: recommendation ? {
        selectedNode: String(recommendation.selectedNode || ''),
        degraded: !!recommendation.degraded,
        degradedReason: String(recommendation.degradedReason || ''),
        weights,
      } : null,
      deployment: deploymentList,
    },
  }));
  return true;
}

import { DEFAULT_NODE_ID, canonicalNodeId } from '../team/team-node-ids.mjs';

function createControlClient({
  baseUrl = '',
  token = '',
  fetchImpl = globalThis.fetch,
  toolNames = {},
} = {}) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  const resolvedToolNames = {
    spawnSession: String(toolNames?.spawnSession || 'sessions_spawn'),
    sendToSession: String(toolNames?.sendToSession || 'sessions_send'),
    listSessions: String(toolNames?.listSessions || 'sessions_list'),
    getSessionHistory: String(toolNames?.getSessionHistory || 'sessions_history'),
  };

  async function invoke(tool, args = {}) {
    const res = await fetchImpl(`${cleanBase}/tools/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tool, args }),
    });

    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data,
      details: data?.result?.details || {},
      error: data?.error?.message || data?.result?.error || '',
    };
  }

  return {
    async spawnSessionImpl(args = {}) {
      const out = await invoke(resolvedToolNames.spawnSession, args);
      return {
        ...out,
        ...((out.details && typeof out.details === 'object') ? out.details : {}),
      };
    },
    async sendToSessionImpl(args = {}) {
      const out = await invoke(resolvedToolNames.sendToSession, args);
      return {
        ...out,
        ...((out.details && typeof out.details === 'object') ? out.details : {}),
      };
    },
    async listSessionsImpl(args = {}) {
      const out = await invoke(resolvedToolNames.listSessions, args);
      return {
        ...out,
        sessions: out?.details?.sessions || [],
      };
    },
    async getSessionHistoryImpl(args = {}) {
      const out = await invoke(resolvedToolNames.getSessionHistory, args);
      return {
        ...out,
        ...((out.details && typeof out.details === 'object') ? out.details : {}),
      };
    },
  };
}

export function createRemoteSessionControlPlane({
  nodeControls = {},
  roleDeployment,
  fetchImpl = globalThis.fetch,
  provider = 'control-plane-client',
  toolNames = {},
} = {}) {
  const controls = {};
  for (const [nodeId, cfg] of Object.entries(nodeControls)) {
    if (!cfg?.url) continue;
    controls[nodeId] = createControlClient({
      baseUrl: String(cfg.url),
      token: String(cfg.token || ''),
      fetchImpl,
      toolNames: cfg.toolNames || toolNames,
    });
  }

  function resolveControlForRole(role = '', opts = {}) {
    const deployment = roleDeployment?.resolve?.(role, opts);
    const selectedNode = canonicalNodeId(String(deployment?.selectedNode || DEFAULT_NODE_ID), DEFAULT_NODE_ID);
    const control = controls[selectedNode] || controls[DEFAULT_NODE_ID] || null;
    if (!control) {
      return { ok: false, error: `no_control_for_node:${selectedNode}`, selectedNode, deployment };
    }
    return { ok: true, control, selectedNode, deployment };
  }

  function inferNodeFromSessionKey(sessionKey = '') {
    const raw = String(sessionKey || '').trim();
    const match = raw.match(/^agent:([^:]+):/i);
    return String(match?.[1] || '').trim().toLowerCase();
  }

  function resolveControlForSession(sessionKey = '') {
    const nodeId = canonicalNodeId(inferNodeFromSessionKey(sessionKey) || DEFAULT_NODE_ID, DEFAULT_NODE_ID);
    const control = controls[nodeId] || controls[DEFAULT_NODE_ID] || null;
    if (!control) {
      return { ok: false, error: `no_control_for_session:${nodeId || 'unknown'}`, selectedNode: nodeId || DEFAULT_NODE_ID };
    }
    return { ok: true, control, selectedNode: nodeId || DEFAULT_NODE_ID };
  }

  async function spawnSessionForRole({ role = '', ...spawnArgs } = {}) {
    const resolved = resolveControlForRole(role);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error, selectedNode: resolved.selectedNode };
    }

    const result = await resolved.control.spawnSessionImpl(spawnArgs);
    const fallbackNode = canonicalNodeId(String(resolved?.deployment?.fallbackNode || DEFAULT_NODE_ID), DEFAULT_NODE_ID);
    const status = String(result?.status || result?.details?.status || '').toLowerCase();
    const errMsg = String(result?.error || '').toLowerCase();
    const shouldFallback = resolved.selectedNode !== fallbackNode
      && controls[fallbackNode]
      && (
        !result?.ok
        || status === 'forbidden'
        || status === 'not_found'
        || errMsg.includes('forbidden')
        || errMsg.includes('not_found')
        || errMsg.includes('not available')
      );

    if (shouldFallback) {
      const fallbackResult = await controls[fallbackNode].spawnSessionImpl(spawnArgs);
      return {
        ...fallbackResult,
        degraded: true,
        degradedReason: `control_spawn_fallback:${resolved.selectedNode}:${errMsg || status || 'unknown'}`,
        requestedNode: resolved.selectedNode,
        _routedNode: fallbackNode,
        _deployment: {
          ...resolved.deployment,
          selectedNode: fallbackNode,
          degraded: true,
        },
      };
    }

    return {
      ...result,
      requestedNode: resolved.selectedNode,
      _routedNode: resolved.selectedNode,
      _deployment: resolved.deployment,
    };
  }

  async function sendToSession({ sessionKey = '', ...args } = {}) {
    const resolved = resolveControlForSession(sessionKey);
    if (!resolved.ok) return { ok: false, error: resolved.error, sessionKey };
    const result = await resolved.control.sendToSessionImpl({ sessionKey, ...args });
    return {
      ...result,
      sessionKey,
      _routedNode: resolved.selectedNode,
    };
  }

  async function listSessionsForSession({ sessionKey = '', ...args } = {}) {
    const resolved = resolveControlForSession(sessionKey);
    if (!resolved.ok) return { ok: false, error: resolved.error, sessionKey, sessions: [] };
    const result = await resolved.control.listSessionsImpl(args);
    return {
      ...result,
      sessionKey,
      _routedNode: resolved.selectedNode,
    };
  }

  async function getSessionHistory({ sessionKey = '', ...args } = {}) {
    const resolved = resolveControlForSession(sessionKey);
    if (!resolved.ok) return { ok: false, error: resolved.error, sessionKey };
    const result = await resolved.control.getSessionHistoryImpl({ sessionKey, ...args });
    return {
      ...result,
      sessionKey,
      _routedNode: resolved.selectedNode,
    };
  }

  return {
    provider,
    kind: 'control_plane_client',
    resolveControlForRole,
    resolveControlForSession,
    inferNodeFromSessionKey,
    spawnSessionForRole,
    sendToSession,
    listSessionsForSession,
    getSessionHistory,
    controls,
  };
}

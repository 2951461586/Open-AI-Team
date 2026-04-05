export function createSessionRuntimeAdapter({
  provider = 'session-substrate',
  roleDeployment,
  resolveRole,
  resolveSession,
  probeRoleImpl,
  spawnForRoleImpl,
  sendToSessionImpl,
  listSessionsForSessionImpl,
  getSessionHistoryImpl,
} = {}) {
  function fallbackResolveRole(role = '', opts = {}) {
    const deployment = roleDeployment?.resolve?.(role, opts) || null;
    return {
      ok: false,
      error: 'session_substrate_unavailable',
      selectedNode: String(deployment?.selectedNode || ''),
      deployment,
    };
  }

  function fallbackResolveSession(sessionKey = '') {
    return {
      ok: false,
      error: 'session_substrate_unavailable',
      selectedNode: String(sessionKey || '').trim() ? 'unknown' : '',
    };
  }

  async function probeRole(role = '', opts = {}) {
    if (typeof probeRoleImpl === 'function') {
      try {
        return await probeRoleImpl(role, opts);
      } catch (err) {
        return {
          ok: false,
          provider,
          role,
          selectedNode: '',
          error: String(err?.message || err || 'probe_failed'),
        };
      }
    }

    const resolved = typeof resolveRole === 'function'
      ? resolveRole(role, opts)
      : fallbackResolveRole(role, opts);

    return {
      ok: false,
      provider,
      role,
      selectedNode: String(resolved?.selectedNode || ''),
      deployment: resolved?.deployment || null,
      error: String(resolved?.error || 'probe_unavailable'),
    };
  }

  async function spawnForRole({ role = '', ...args } = {}) {
    if (typeof spawnForRoleImpl === 'function') {
      try {
        return await spawnForRoleImpl({ role, ...args });
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'spawn_failed'), role, provider, via: 'session_runtime_adapter' };
      }
    }
    return { ok: false, error: 'spawn_unavailable', role, provider };
  }

  async function sendToSession(args = {}) {
    if (typeof sendToSessionImpl === 'function') {
      try {
        return await sendToSessionImpl(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'send_failed'), via: 'session_runtime_adapter' };
      }
    }
    return { ok: false, error: 'send_unavailable' };
  }

  async function listSessionsForSession(args = {}) {
    if (typeof listSessionsForSessionImpl === 'function') {
      try {
        return await listSessionsForSessionImpl(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'list_failed'), sessions: [], via: 'session_runtime_adapter' };
      }
    }
    return { ok: false, error: 'list_unavailable', sessions: [] };
  }

  async function getSessionHistory(args = {}) {
    if (typeof getSessionHistoryImpl === 'function') {
      try {
        return await getSessionHistoryImpl(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'history_failed'), via: 'session_runtime_adapter' };
      }
    }
    return { ok: false, error: 'history_unavailable' };
  }

  return {
    provider,
    kind: 'session_runtime_adapter',
    resolveRole: typeof resolveRole === 'function' ? resolveRole : fallbackResolveRole,
    resolveSession: typeof resolveSession === 'function' ? resolveSession : fallbackResolveSession,
    probeRole,
    spawnForRole,
    sendToSession,
    listSessionsForSession,
    getSessionHistory,
  };
}

export function createNoopSessionRuntimeAdapter({ provider = 'session-substrate' } = {}) {
  return createSessionRuntimeAdapter({ provider });
}

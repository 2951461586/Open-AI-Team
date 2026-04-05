import { createSessionRuntimeAdapter } from './session-runtime-adapter.mjs';

export function createRemoteSessionRuntimeAdapter({ sessionControlPlane, roleDeployment, provider = 'remote-session' } = {}) {
  function resolveRole(role = '', opts = {}) {
    if (sessionControlPlane?.resolveControlForRole) {
      return sessionControlPlane.resolveControlForRole(role, opts);
    }
    const deployment = roleDeployment?.resolve?.(role, opts) || null;
    return {
      ok: false,
      error: 'control_unavailable',
      selectedNode: String(deployment?.selectedNode || ''),
      deployment,
    };
  }

  function resolveSession(sessionKey = '') {
    if (sessionControlPlane?.resolveControlForSession) {
      return sessionControlPlane.resolveControlForSession(sessionKey);
    }
    return { ok: false, error: 'control_unavailable', selectedNode: '' };
  }

  return createSessionRuntimeAdapter({
    provider,
    roleDeployment,
    resolveRole,
    resolveSession,
    probeRoleImpl: async (role = '', opts = {}) => {
      const resolved = resolveRole(role, opts);
      if (!resolved?.ok || !resolved?.control) {
        return {
          ok: false,
          provider,
          role,
          selectedNode: String(resolved?.selectedNode || ''),
          error: String(resolved?.error || 'control_unavailable'),
        };
      }

      const resolvedControl = resolved.control;
      try {
        if (typeof resolvedControl.listSessionsImpl === 'function') {
          const out = await resolvedControl.listSessionsImpl({ activeMinutes: 5, messageLimit: 0 });
          return {
            ok: !!out?.ok,
            provider,
            role,
            selectedNode: String(resolved?.selectedNode || ''),
            deployment: resolved?.deployment || null,
            sessionCount: Array.isArray(out?.sessions) ? out.sessions.length : 0,
            status: Number(out?.status || 0),
            error: String(out?.error || ''),
          };
        }
        return {
          ok: true,
          provider,
          role,
          selectedNode: String(resolved?.selectedNode || ''),
          deployment: resolved?.deployment || null,
          sessionCount: 0,
          status: 0,
          error: '',
        };
      } catch (err) {
        return {
          ok: false,
          provider,
          role,
          selectedNode: String(resolved?.selectedNode || ''),
          deployment: resolved?.deployment || null,
          error: String(err?.message || err || 'probe_failed'),
        };
      }
    },
    spawnForRoleImpl: async ({ role = '', ...args } = {}) => {
      if (typeof sessionControlPlane?.spawnSessionForRole === 'function') {
        try {
          const out = await sessionControlPlane.spawnSessionForRole({ role, ...args });
          return { provider, role, ...out, via: out?.via || 'remote_session_control_plane' };
        } catch (err) {
          return { ok: false, error: String(err?.message || err || 'spawn_failed'), role, provider, via: 'remote_session_control_plane' };
        }
      }
      return { ok: false, error: 'spawn_unavailable', role, provider };
    },
    sendToSessionImpl: async (args = {}) => {
      if (typeof sessionControlPlane?.sendToSession === 'function') {
        try {
          return await sessionControlPlane.sendToSession(args);
        } catch (err) {
          return { ok: false, error: String(err?.message || err || 'send_failed'), via: 'remote_session_control_plane' };
        }
      }
      return { ok: false, error: 'send_unavailable' };
    },
    listSessionsForSessionImpl: async (args = {}) => {
      if (typeof sessionControlPlane?.listSessionsForSession === 'function') {
        try {
          return await sessionControlPlane.listSessionsForSession(args);
        } catch (err) {
          return { ok: false, error: String(err?.message || err || 'list_failed'), sessions: [], via: 'remote_session_control_plane' };
        }
      }
      return { ok: false, error: 'list_unavailable', sessions: [] };
    },
    getSessionHistoryImpl: async (args = {}) => {
      if (typeof sessionControlPlane?.getSessionHistory === 'function') {
        try {
          return await sessionControlPlane.getSessionHistory(args);
        } catch (err) {
          return { ok: false, error: String(err?.message || err || 'history_failed'), via: 'remote_session_control_plane' };
        }
      }
      return { ok: false, error: 'history_unavailable' };
    },
  });
}

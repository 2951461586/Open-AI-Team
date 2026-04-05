export function createRuntimeExecutionAdapter({ runtimeAdapter } = {}) {
  async function spawnForRole({ role = '', ...args } = {}) {
    if (runtimeAdapter && typeof runtimeAdapter.spawnForRole === 'function') {
      try {
        return await runtimeAdapter.spawnForRole({ role, ...args });
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'spawn_failed'), role, via: 'runtime_adapter' };
      }
    }
    return { ok: false, error: 'spawn_unavailable' };
  }

  async function sendToSession(args = {}) {
    if (runtimeAdapter && typeof runtimeAdapter.sendToSession === 'function') {
      try {
        return await runtimeAdapter.sendToSession(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'send_failed'), via: 'runtime_adapter' };
      }
    }
    return { ok: false, error: 'send_unavailable' };
  }

  async function listSessionsForSession(args = {}) {
    if (runtimeAdapter && typeof runtimeAdapter.listSessionsForSession === 'function') {
      try {
        return await runtimeAdapter.listSessionsForSession(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'list_failed'), sessions: [], via: 'runtime_adapter' };
      }
    }
    return { ok: false, error: 'list_unavailable', sessions: [] };
  }

  async function getSessionHistory(args = {}) {
    if (runtimeAdapter && typeof runtimeAdapter.getSessionHistory === 'function') {
      try {
        return await runtimeAdapter.getSessionHistory(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err || 'history_failed'), via: 'runtime_adapter' };
      }
    }
    return { ok: false, error: 'history_unavailable' };
  }

  function hasSend() {
    return runtimeAdapter && typeof runtimeAdapter.sendToSession === 'function';
  }

  return {
    kind: 'execution_adapter',
    spawnForRole,
    sendToSession,
    listSessionsForSession,
    getSessionHistory,
    hasSend,
  };
}

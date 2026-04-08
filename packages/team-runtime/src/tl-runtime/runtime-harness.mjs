import { ensureArray } from '@ai-team/team-core/common';

export function createTLRuntimeExecutionHarness({ executionAdapter, runtimeAdapter } = {}) {
  if (executionAdapter) return executionAdapter;

  return {
    spawnForRole: async ({ role, ...args } = {}) => {
      if (runtimeAdapter && typeof runtimeAdapter.spawnForRole === 'function') return runtimeAdapter.spawnForRole({ role, ...args });
      return { ok: false, error: 'spawn_unavailable' };
    },
    sendToSession: async (args = {}) => {
      if (runtimeAdapter && typeof runtimeAdapter.sendToSession === 'function') return runtimeAdapter.sendToSession(args);
      return { ok: false, error: 'send_unavailable' };
    },
    listSessionsForSession: async ({ sessionKey = '', ...args } = {}) => {
      if (runtimeAdapter && typeof runtimeAdapter.listSessionsForSession === 'function') return runtimeAdapter.listSessionsForSession({ sessionKey, ...args });
      return { ok: false, error: 'list_unavailable', sessions: [] };
    },
    getSessionHistory: async ({ sessionKey = '', ...args } = {}) => {
      if (runtimeAdapter && typeof runtimeAdapter.getSessionHistory === 'function') return runtimeAdapter.getSessionHistory({ sessionKey, ...args });
      return { ok: false, error: 'history_unavailable' };
    },
    hasSend: () => (runtimeAdapter && typeof runtimeAdapter.sendToSession === 'function'),
  };
}

export function isSuccessfulSpawn(result = {}) {
  const sessionKey = String(result?.childSessionKey || result?.sessionKey || '').trim();
  const status = String(result?.status || result?.details?.status || '').trim().toLowerCase();
  if (!sessionKey) return false;
  if (['error', 'failed', 'forbidden', 'cancelled'].includes(status)) return false;
  return true;
}

export function isSessionModeUnavailable(result = {}) {
  const text = `${String(result?.status || result?.details?.status || '')} ${String(result?.error || result?.details?.error || '')}`.toLowerCase();
  return text.includes('thread=true is unavailable')
    || text.includes('mode="session" requires thread=true')
    || text.includes('subagent_spawning hooks')
    || text.includes('no channel plugin');
}

export function isPersistentSessionBinding(info = {}) {
  return !!info && (
    info.sessionPersistent === true
    || String(info.sessionMode || '').trim().toLowerCase() === 'session'
  );
}

export function shouldFallbackMemberFollowup(result = {}) {
  const reply = String(result?.reply || '').trim();
  const status = String(result?.status || result?.details?.status || '').trim().toLowerCase();
  const error = String(result?.error || result?.details?.error || '').trim().toLowerCase();
  return !reply
    || ['error', 'failed', 'forbidden', 'cancelled'].includes(status)
    || error.includes('forbidden')
    || error.includes('visibility')
    || error.includes('not_found')
    || error.includes('not available');
}

export function normalizeHistoryMessages(data = {}) {
  const rawMessages = ensureArray(
    data?.messages
    || data?.history
    || data?.result?.details?.messages
    || data?.result?.details?.history,
  );
  return rawMessages.map((msg = {}) => {
    const role = String(msg?.role || msg?.author || msg?.from || 'assistant');
    const content = typeof msg?.content === 'string'
      ? msg.content
      : Array.isArray(msg?.content)
        ? msg.content.map((part) => typeof part === 'string' ? part : (part?.text || '')).join('\n')
        : String(msg?.text || msg?.message || '');
    return { role, content: String(content || '').trim() };
  }).filter((msg) => msg.content);
}

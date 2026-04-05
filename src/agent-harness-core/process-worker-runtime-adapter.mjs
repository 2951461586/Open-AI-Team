import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

function parseJsonLine(line = '') {
  try {
    return JSON.parse(String(line || '').trim());
  } catch {
    return null;
  }
}

function normalizeSessionKey(value = '') {
  return String(value || '').trim();
}

function pickSessionKey(record = {}) {
  return normalizeSessionKey(record?.sessionKey || record?.childSessionKey || record?.payload?.sessionKey || record?.payload?.childSessionKey || '');
}

function toHistoryMessage(record = {}) {
  const payload = record?.payload || {};
  const text = String(payload?.text || payload?.reply || payload?.summary || payload?.message || '');
  return {
    id: String(record?.id || payload?.id || ''),
    role: String(payload?.role || (record?.direction === 'outbox' ? 'assistant' : 'user') || 'assistant'),
    text,
    content: text,
    createdAt: String(record?.createdAt || payload?.createdAt || ''),
    direction: String(record?.direction || ''),
    channel: String(record?.channel || ''),
    payload,
  };
}

export function createProcessWorkerRuntimeAdapter({ manifestPath = '', workerEntryPath = '', paths = {}, state = {}, eventBus = null, backendProvider = null, hostLayer = null } = {}) {
  async function probeRole(role = '') {
    return {
      ok: true,
      provider: 'local-demo-worker',
      role,
      selectedNode: 'local',
      deployment: {
        selectedNode: 'local',
        executionMode: 'process_worker_transport',
        outwardIdentity: `demo-worker:${role}`,
      },
      sessionCount: 0,
      status: 200,
      error: '',
    };
  }

  async function spawnForRole({ role = '', onChunk = null, ...request } = {}) {
    const payloadPath = path.join(paths.runtimeDir || process.cwd(), `worker-input-${Date.now()}-${String(role || 'worker').replace(/[^a-z0-9_-]/gi, '_')}.json`);
    const payload = {
      manifestPath,
      paths,
      stateSnapshot: {
        blackboard: state.blackboard || {},
        durableArtifacts: state.durableArtifacts || [],
      },
      request: {
        role,
        ...request,
      },
    };

    await fs.writeFile(payloadPath, JSON.stringify(payload, null, 2));

    return new Promise((resolve) => {
      const child = spawn(process.execPath, [workerEntryPath, payloadPath], {
        cwd: path.dirname(workerEntryPath),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (eventBus?.emit) {
        eventBus.emit({
          type: 'transport.worker.spawned',
          role,
          pid: child.pid,
          transportKind: 'process_worker',
        });
      }

      let stdoutBuffer = '';
      let stderr = '';
      let finalPayload = null;
      let explicitError = '';

      const handleLine = (line) => {
        const msg = parseJsonLine(line);
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'stream.chunk' && msg.payload) {
          if (typeof onChunk === 'function') {
            Promise.resolve(onChunk(msg.payload)).catch(() => {});
          }
          return;
        }
        if (msg.type === 'result' && msg.payload) {
          finalPayload = msg.payload;
          return;
        }
        if (msg.type === 'error') {
          explicitError = String(msg.error || 'worker_error');
        }
      };

      child.stdout.on('data', (chunk) => {
        stdoutBuffer += String(chunk || '');
        let index = stdoutBuffer.indexOf('\n');
        while (index >= 0) {
          const line = stdoutBuffer.slice(0, index);
          stdoutBuffer = stdoutBuffer.slice(index + 1);
          handleLine(line);
          index = stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      child.on('close', async (code) => {
        try { await fs.unlink(payloadPath); } catch {}
        if (stdoutBuffer.trim()) handleLine(stdoutBuffer.trim());

        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.worker.completed',
            role,
            pid: child.pid,
            exitCode: Number(code || 0),
            transportKind: 'process_worker',
          });
        }

        if (Number(code || 0) === 0 && finalPayload?.run) {
          resolve({
            ...finalPayload.run,
            provider: 'local-demo-worker',
            via: 'process_worker_transport',
            workerPid: child.pid,
            workerEventLog: Array.isArray(finalPayload.eventLog) ? finalPayload.eventLog : [],
            workerToolRuns: Array.isArray(finalPayload.toolRuns) ? finalPayload.toolRuns : [],
          });
          return;
        }

        resolve({
          ok: false,
          error: explicitError || stderr.trim() || `worker_exit_${Number(code || 1)}`,
          via: 'process_worker_transport',
          workerPid: child.pid,
          workerEventLog: [],
          workerToolRuns: [],
        });
      });
    });
  }

  async function sendToSession({ sessionKey = '', text = '', role = 'user', message = '', payload = {}, channel = 'session-bus' } = {}) {
    const normalizedSessionKey = normalizeSessionKey(sessionKey);
    const normalizedText = String(text || message || payload?.text || '');
    if (!normalizedSessionKey) {
      return { ok: false, error: 'session_key_required', via: 'process_worker_transport' };
    }
    const entry = {
      sessionKey: normalizedSessionKey,
      role: String(role || payload?.role || 'user'),
      text: normalizedText,
      message: normalizedText,
      createdAt: new Date().toISOString(),
      channel: String(channel || 'session-bus'),
      ...payload,
    };
    if (hostLayer?.sessionBus?.appendMessage) {
      await hostLayer.sessionBus.appendMessage(entry);
    } else if (backendProvider?.appendHostMessage) {
      await backendProvider.appendHostMessage({ direction: 'session', channel: String(channel || 'session-bus'), payload: entry });
    } else {
      return { ok: false, error: 'session_bus_unavailable', via: 'process_worker_transport' };
    }
    if (hostLayer?.desk?.enqueueInbox) {
      await hostLayer.desk.enqueueInbox({ sessionKey: normalizedSessionKey, role: entry.role, text: normalizedText, channel: entry.channel });
    }
    if (hostLayer?.persistHostState) {
      await hostLayer.persistHostState({ lastSessionMessageAt: new Date().toISOString() });
    }
    return { ok: true, via: 'process_worker_transport', sessionKey: normalizedSessionKey, entry };
  }

  async function listSessionsForSession({ sessionKey = '', limit = 100 } = {}) {
    if (!backendProvider?.listHostMessages) {
      return { ok: false, error: 'list_unavailable', sessions: [], via: 'process_worker_transport' };
    }
    const records = await backendProvider.listHostMessages({ direction: 'session', channel: 'session-bus', limit: Math.max(10, Number(limit || 100) * 4) });
    const target = normalizeSessionKey(sessionKey);
    const grouped = new Map();
    for (const record of records) {
      const key = pickSessionKey(record);
      if (!key) continue;
      if (target && key !== target) continue;
      const current = grouped.get(key) || {
        sessionKey: key,
        messageCount: 0,
        lastMessageAt: '',
        lastMessage: '',
        channels: new Set(),
      };
      current.messageCount += 1;
      current.lastMessageAt = String(record.createdAt || current.lastMessageAt || '');
      current.lastMessage = String(record?.payload?.text || record?.payload?.reply || record?.payload?.message || current.lastMessage || '');
      current.channels.add(String(record.channel || 'session-bus'));
      grouped.set(key, current);
    }
    const sessions = Array.from(grouped.values())
      .sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')))
      .slice(0, Math.max(1, Number(limit || 100)))
      .map((entry) => ({
        sessionKey: entry.sessionKey,
        childSessionKey: entry.sessionKey,
        messageCount: entry.messageCount,
        lastMessageAt: entry.lastMessageAt,
        lastMessage: entry.lastMessage,
        channels: Array.from(entry.channels.values()),
      }));
    return { ok: true, via: 'process_worker_transport', sessions };
  }

  async function getSessionHistory({ sessionKey = '', limit = 50 } = {}) {
    const normalizedSessionKey = normalizeSessionKey(sessionKey);
    if (!normalizedSessionKey) {
      return { ok: false, error: 'session_key_required', via: 'process_worker_transport' };
    }
    if (!backendProvider?.listHostMessages) {
      return { ok: false, error: 'history_unavailable', via: 'process_worker_transport' };
    }
    const records = await backendProvider.listHostMessages({ direction: 'session', channel: 'session-bus', limit: Math.max(20, Number(limit || 50) * 6) });
    const messages = records
      .filter((record) => pickSessionKey(record) === normalizedSessionKey)
      .map((record) => toHistoryMessage(record))
      .slice(-Math.max(1, Number(limit || 50)));
    return { ok: true, via: 'process_worker_transport', sessionKey: normalizedSessionKey, messages };
  }

  return {
    provider: 'local-demo-worker',
    kind: 'runtime_adapter',
    transportKind: 'process_worker',
    probeRole,
    spawnForRole,
    sendToSession,
    listSessionsForSession,
    getSessionHistory,
  };
}

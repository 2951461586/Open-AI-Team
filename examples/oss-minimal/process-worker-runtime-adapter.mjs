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

export function createProcessWorkerRuntimeAdapter({ manifestPath = '', workerEntryPath = '', paths = {}, state = {}, eventBus = null } = {}) {
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

  async function sendToSession() {
    return { ok: false, error: 'send_unavailable', via: 'process_worker_transport' };
  }

  async function listSessionsForSession() {
    return { ok: false, error: 'list_unavailable', sessions: [], via: 'process_worker_transport' };
  }

  async function getSessionHistory() {
    return { ok: false, error: 'history_unavailable', via: 'process_worker_transport' };
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

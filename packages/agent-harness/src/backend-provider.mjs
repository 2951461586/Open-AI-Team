import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_SERVER_ENTRY = path.join(__dirname, 'external-state-store.mjs');

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeRunId(runId = '') {
  return String(runId || 'run:unknown').trim() || 'run:unknown';
}

async function httpJson(method = 'GET', url = '', payload = undefined, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(200, Number(timeoutMs || 5000)));
  try {
    const res = await fetch(url, {
      method,
      headers: payload === undefined ? {} : { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function createSqliteStateBackend({ paths = {}, runId = '' } = {}) {
  const normalizedRunId = normalizeRunId(runId);
  const dbPath = String(paths.backendDbPath || path.join(paths.runtimeDir || '.', 'harness-state.sqlite'));
  const backendMetaPath = String(paths.backendMetaPath || path.join(paths.runtimeDir || '.', 'backend-meta.json'));
  let db = null;

  function getDb() {
    if (!db) db = new DatabaseSync(dbPath);
    return db;
  }

  function docKey(filePath = '') {
    const root = String(paths.runDir || path.dirname(dbPath) || '.');
    const rel = path.relative(root, String(filePath || '')).trim();
    return rel || path.basename(String(filePath || 'document.json'));
  }

  function initSchema() {
    const conn = getDb();
    conn.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS documents (
        key TEXT PRIMARY KEY,
        format TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS run_snapshots (
        run_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tool_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        tool TEXT NOT NULL,
        ok INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scheduler_jobs (
        job_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS host_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        channel TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  function upsertMeta(key = '', value = '') {
    getDb().prepare(`
      INSERT INTO meta (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(String(key || ''), String(value || ''), nowIso());
  }

  function upsertDocument(key = '', format = 'json', content = '') {
    getDb().prepare(`
      INSERT INTO documents (key, format, content, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET format=excluded.format, content=excluded.content, updated_at=excluded.updated_at
    `).run(String(key || ''), String(format || 'json'), String(content || ''), nowIso());
  }

  async function init() {
    await ensureDir(path.dirname(dbPath));
    await ensureDir(paths.runtimeDir);
    initSchema();
    upsertMeta('contractVersion', 'agent-harness-backend.v1');
    upsertMeta('backendId', 'sqlite-state-backend');
    upsertMeta('driver', 'sqlite');
    upsertMeta('runId', normalizedRunId);
    upsertMeta('topology', 'external_service_ready');
    const meta = {
      contractVersion: 'agent-harness-backend.v1',
      kind: 'state_backend',
      backendId: 'sqlite-state-backend',
      driver: 'sqlite',
      durability: 'sqlite-wal',
      topology: 'external_service_ready',
      initializedAt: nowIso(),
      dbPath,
      statePath: String(paths.statePath || ''),
      queueStatePath: String(paths.queueStatePath || ''),
      eventLogPath: String(paths.eventLogPath || ''),
      swappableTargets: ['sqlite', 'redis', 'postgres'],
    };
    await writeJson(backendMetaPath, meta);
    return { backendMetaPath, backendDbPath: dbPath };
  }

  async function writeJson(filePath = '', value = {}) {
    await ensureDir(path.dirname(filePath));
    const body = JSON.stringify(value, null, 2);
    await fs.writeFile(filePath, body, 'utf8');
    upsertDocument(docKey(filePath), 'json', body);
    return filePath;
  }

  async function writeJsonLines(filePath = '', items = []) {
    await ensureDir(path.dirname(filePath));
    const body = (Array.isArray(items) ? items : []).map((item) => JSON.stringify(item)).join('\n');
    await fs.writeFile(filePath, body + (body ? '\n' : ''), 'utf8');
    upsertDocument(docKey(filePath), 'jsonl', body);
    return filePath;
  }

  async function readJson(filePath = '', fallback = null) {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      try {
        const row = getDb().prepare('SELECT content FROM documents WHERE key = ?').get(docKey(filePath));
        return row?.content ? JSON.parse(String(row.content)) : fallback;
      } catch {
        return fallback;
      }
    }
  }

  function persistRunState(state = {}) {
    getDb().prepare(`
      INSERT INTO run_snapshots (run_id, status, content, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET status=excluded.status, content=excluded.content, updated_at=excluded.updated_at
    `).run(normalizedRunId, String(state.status || ''), JSON.stringify(state), nowIso());
  }

  function persistEventLog(events = []) {
    const conn = getDb();
    conn.prepare('DELETE FROM event_log WHERE run_id = ?').run(normalizedRunId);
    const stmt = conn.prepare('INSERT INTO event_log (run_id, seq, event_type, content, created_at) VALUES (?, ?, ?, ?, ?)');
    (Array.isArray(events) ? events : []).forEach((event, index) => {
      stmt.run(normalizedRunId, index + 1, String(event?.type || 'event'), JSON.stringify(event), nowIso());
    });
  }

  function persistToolRuns(runs = []) {
    const conn = getDb();
    conn.prepare('DELETE FROM tool_runs WHERE run_id = ?').run(normalizedRunId);
    const stmt = conn.prepare('INSERT INTO tool_runs (run_id, seq, tool, ok, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    (Array.isArray(runs) ? runs : []).forEach((entry, index) => {
      stmt.run(normalizedRunId, index + 1, String(entry?.tool || ''), entry?.ok === false ? 0 : 1, JSON.stringify(entry), nowIso());
    });
  }

  function appendHostMessage({ direction = 'session', channel = 'default', payload = {} } = {}) {
    getDb().prepare('INSERT INTO host_messages (run_id, direction, channel, payload, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(normalizedRunId, String(direction || 'session'), String(channel || 'default'), JSON.stringify(payload || {}), nowIso());
  }

  function listHostMessages({ direction = '', channel = '', limit = 100 } = {}) {
    const clauses = ['run_id = ?'];
    const args = [normalizedRunId];
    if (String(direction || '').trim()) {
      clauses.push('direction = ?');
      args.push(String(direction || '').trim());
    }
    if (String(channel || '').trim()) {
      clauses.push('channel = ?');
      args.push(String(channel || '').trim());
    }
    const capped = Math.max(1, Math.min(500, Number(limit || 100)));
    const rows = getDb().prepare(`
      SELECT id, direction, channel, payload, created_at
      FROM host_messages
      WHERE ${clauses.join(' AND ')}
      ORDER BY id DESC
      LIMIT ?
    `).all(...args, capped);
    return rows.map((row) => {
      let payload = null;
      try {
        payload = JSON.parse(String(row.payload || '{}'));
      } catch {
        payload = row.payload;
      }
      return {
        id: Number(row.id || 0),
        direction: String(row.direction || ''),
        channel: String(row.channel || ''),
        payload,
        createdAt: String(row.created_at || ''),
      };
    }).reverse();
  }

  function upsertSchedulerJob(job = {}) {
    const jobId = String(job?.jobId || job?.id || '').trim();
    if (!jobId) return null;
    const normalized = {
      jobId,
      runId: normalizedRunId,
      status: String(job?.status || 'pending'),
      kind: String(job?.kind || 'generic'),
      payload: job?.payload || {},
      updatedAt: nowIso(),
    };
    getDb().prepare(`
      INSERT INTO scheduler_jobs (job_id, run_id, status, payload, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET status=excluded.status, payload=excluded.payload, updated_at=excluded.updated_at
    `).run(normalized.jobId, normalized.runId, normalized.status, JSON.stringify(normalized), normalized.updatedAt);
    return normalized;
  }

  function listSchedulerJobs() {
    const rows = getDb().prepare('SELECT payload FROM scheduler_jobs WHERE run_id = ? ORDER BY updated_at DESC').all(normalizedRunId);
    return rows.map((row) => {
      try {
        return JSON.parse(String(row.payload || '{}'));
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  function getStats() {
    const conn = getDb();
    const eventCount = Number(conn.prepare('SELECT COUNT(*) AS count FROM event_log WHERE run_id = ?').get(normalizedRunId)?.count || 0);
    const toolRunCount = Number(conn.prepare('SELECT COUNT(*) AS count FROM tool_runs WHERE run_id = ?').get(normalizedRunId)?.count || 0);
    const hostMessageCount = Number(conn.prepare('SELECT COUNT(*) AS count FROM host_messages WHERE run_id = ?').get(normalizedRunId)?.count || 0);
    const schedulerJobCount = Number(conn.prepare('SELECT COUNT(*) AS count FROM scheduler_jobs WHERE run_id = ?').get(normalizedRunId)?.count || 0);
    return { eventCount, toolRunCount, hostMessageCount, schedulerJobCount, dbPath };
  }

  return {
    kind: 'state_backend',
    backendId: 'sqlite-state-backend',
    driver: 'sqlite',
    durability: 'sqlite-wal',
    dbPath,
    paths: {
      backendMetaPath,
      backendDbPath: dbPath,
    },
    init,
    readJson,
    writeJson,
    writeJsonLines,
    persistRunState,
    persistEventLog,
    persistToolRuns,
    appendHostMessage,
    listHostMessages,
    upsertSchedulerJob,
    listSchedulerJobs,
    getStats,
  };
}

export function createExternalStateBackend({ paths = {}, runId = '' } = {}) {
  const normalizedRunId = normalizeRunId(runId);
  const dbPath = String(paths.backendDbPath || path.join(paths.runtimeDir || '.', 'external-state-store.sqlite'));
  const backendMetaPath = String(paths.backendMetaPath || path.join(paths.runtimeDir || '.', 'backend-meta.json'));
  const statePath = String(paths.externalStoreStatePath || path.join(paths.runtimeDir || '.', 'external-state-store.json'));

  let server = null;
  let readyPromise = null;
  let baseUrl = '';
  let lastStats = {
    eventCount: 0,
    toolRunCount: 0,
    hostMessageCount: 0,
    schedulerJobCount: 0,
    dbPath,
  };

  function updateStats(data = null) {
    if (data?.stats && typeof data.stats === 'object') {
      lastStats = { ...lastStats, ...data.stats };
    }
    return lastStats;
  }

  async function refreshStats() {
    if (!baseUrl) return lastStats;
    const data = await httpJson('GET', `${baseUrl}/health`, undefined, 3000);
    updateStats(data);
    return lastStats;
  }

  async function ensureServer() {
    if (baseUrl) return { baseUrl, statePath, dbPath };
    if (readyPromise) return readyPromise;

    readyPromise = new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        STORE_SERVER_ENTRY,
        '--db-path', dbPath,
        '--meta-path', backendMetaPath,
        '--state-path', statePath,
        '--run-id', normalizedRunId,
        '--runtime-dir', String(paths.runtimeDir || path.dirname(dbPath)),
      ], {
        cwd: __dirname,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      server = {
        child,
        statePath,
        dbPath,
      };

      let stdoutBuffer = '';
      let stderr = '';
      let settled = false;

      child.stdout.on('data', (chunk) => {
        stdoutBuffer += String(chunk || '');
        let index = stdoutBuffer.indexOf('\n');
        while (index >= 0) {
          const line = stdoutBuffer.slice(0, index).trim();
          stdoutBuffer = stdoutBuffer.slice(index + 1);
          if (line) {
            try {
              const msg = JSON.parse(line);
              if (msg?.type === 'ready' && msg.port && !settled) {
                settled = true;
                baseUrl = `http://127.0.0.1:${Number(msg.port)}`;
                server.baseUrl = baseUrl;
                resolve({ baseUrl, statePath, dbPath });
              }
            } catch {}
          }
          index = stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      child.on('close', (code) => {
        if (!settled) reject(new Error(stderr.trim() || `external_store_exit_${Number(code || 1)}`));
        baseUrl = '';
        server = null;
        readyPromise = null;
      });
    });

    const ready = await readyPromise;
    await refreshStats();
    return ready;
  }

  async function call(method = 'GET', pathname = '/', payload = undefined, timeoutMs = 5000) {
    await ensureServer();
    const data = await httpJson(method, `${baseUrl}${pathname}`, payload, timeoutMs);
    updateStats(data);
    return data;
  }

  return {
    kind: 'state_backend',
    backendId: 'sqlite-state-backend',
    driver: 'sqlite',
    durability: 'external-sqlite-service',
    topology: 'external_service',
    dbPath,
    statePath,
    contractVersion: 'agent-harness-backend.v1',
    serviceContractVersion: 'agent-harness-external-store.v1',
    paths: {
      backendMetaPath,
      backendDbPath: dbPath,
      externalStoreStatePath: statePath,
    },
    get serviceInfo() {
      return {
        contractVersion: 'agent-harness-external-store.v1',
        baseUrl,
        statePath,
        dbPath,
      };
    },
    async init() {
      await ensureDir(path.dirname(dbPath));
      await ensureDir(String(paths.runtimeDir || path.dirname(dbPath)));
      const ready = await ensureServer();
      await call('POST', '/init', {
        backendMetaPath,
        statePath,
      }, 5000);
      return {
        backendMetaPath,
        backendDbPath: dbPath,
        externalStoreStatePath: statePath,
        baseUrl: ready.baseUrl,
      };
    },
    async refreshStats() {
      return refreshStats();
    },
    getStats() {
      return { ...lastStats, dbPath };
    },
    async readJson(filePath = '', fallback = null) {
      const data = await call('POST', '/json/read', { filePath, fallback }, 5000);
      return data?.value ?? fallback;
    },
    async writeJson(filePath = '', value = {}) {
      const data = await call('POST', '/json/write', { filePath, value }, 5000);
      return data?.filePath || filePath;
    },
    async writeJsonLines(filePath = '', items = []) {
      const data = await call('POST', '/jsonl/write', { filePath, items }, 5000);
      return data?.filePath || filePath;
    },
    async persistRunState(state = {}) {
      await call('POST', '/persist/run-state', { state }, 5000);
    },
    async persistEventLog(events = []) {
      await call('POST', '/persist/event-log', { events }, 5000);
    },
    async persistToolRuns(runs = []) {
      await call('POST', '/persist/tool-runs', { runs }, 5000);
    },
    async appendHostMessage(entry = {}) {
      await call('POST', '/host/append', { entry }, 5000);
    },
    async listHostMessages(query = {}) {
      const params = new URLSearchParams();
      if (query && String(query.direction || '').trim()) params.set('direction', String(query.direction || '').trim());
      if (query && String(query.channel || '').trim()) params.set('channel', String(query.channel || '').trim());
      if (query && Number.isFinite(Number(query.limit))) params.set('limit', String(Number(query.limit)));
      const pathname = `/host/list${params.size ? `?${params.toString()}` : ''}`;
      const data = await call('GET', pathname, undefined, 5000);
      return Array.isArray(data?.messages) ? data.messages : [];
    },
    async upsertSchedulerJob(job = {}) {
      const data = await call('POST', '/scheduler/upsert', { job }, 5000);
      return data?.job || null;
    },
    async listSchedulerJobs() {
      const data = await call('GET', '/scheduler/list', undefined, 5000);
      return Array.isArray(data?.jobs) ? data.jobs : [];
    },
    async close() {
      if (!baseUrl || !server?.child) return;
      try {
        await httpJson('POST', `${baseUrl}/shutdown`, {}, 3000);
      } catch {}
      try {
        await new Promise((resolve) => server.child.once('close', resolve));
      } catch {}
    },
  };
}

export function createFileStateBackend(params = {}) {
  return createExternalStateBackend(params);
}

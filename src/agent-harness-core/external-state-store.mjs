import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

function parseArgs(argv = []) {
  const out = {
    dbPath: path.join(process.cwd(), 'runtime', 'external-state-store.sqlite'),
    metaPath: path.join(process.cwd(), 'runtime', 'backend-meta.json'),
    statePath: path.join(process.cwd(), 'runtime', 'external-state-store.json'),
    runtimeDir: path.join(process.cwd(), 'runtime'),
    runId: 'run:unknown',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db-path') {
      out.dbPath = argv[index + 1] || out.dbPath;
      index += 1;
    } else if (arg === '--meta-path') {
      out.metaPath = argv[index + 1] || out.metaPath;
      index += 1;
    } else if (arg === '--state-path') {
      out.statePath = argv[index + 1] || out.statePath;
      index += 1;
    } else if (arg === '--runtime-dir') {
      out.runtimeDir = argv[index + 1] || out.runtimeDir;
      index += 1;
    } else if (arg === '--run-id') {
      out.runId = argv[index + 1] || out.runId;
      index += 1;
    }
  }
  return out;
}

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

const args = parseArgs(process.argv.slice(2));
const dbPath = String(args.dbPath || '');
const metaPath = String(args.metaPath || '');
const statePath = String(args.statePath || '');
const runtimeDir = String(args.runtimeDir || path.dirname(dbPath));
const runId = String(args.runId || 'run:unknown');
const db = new DatabaseSync(dbPath);

function docKey(filePath = '') {
  const root = String(runtimeDir || path.dirname(dbPath) || '.');
  const rel = path.relative(root, String(filePath || '')).trim();
  return rel || path.basename(String(filePath || 'document.json'));
}

function initSchema() {
  db.exec(`
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
  db.prepare(`
    INSERT INTO meta (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(String(key || ''), String(value || ''), nowIso());
}

function upsertDocument(key = '', format = 'json', content = '') {
  db.prepare(`
    INSERT INTO documents (key, format, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET format=excluded.format, content=excluded.content, updated_at=excluded.updated_at
  `).run(String(key || ''), String(format || 'json'), String(content || ''), nowIso());
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
      const row = db.prepare('SELECT content FROM documents WHERE key = ?').get(docKey(filePath));
      return row?.content ? JSON.parse(String(row.content)) : fallback;
    } catch {
      return fallback;
    }
  }
}

function persistRunState(state = {}) {
  db.prepare(`
    INSERT INTO run_snapshots (run_id, status, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET status=excluded.status, content=excluded.content, updated_at=excluded.updated_at
  `).run(runId, String(state.status || ''), JSON.stringify(state), nowIso());
}

function persistEventLog(events = []) {
  db.prepare('DELETE FROM event_log WHERE run_id = ?').run(runId);
  const stmt = db.prepare('INSERT INTO event_log (run_id, seq, event_type, content, created_at) VALUES (?, ?, ?, ?, ?)');
  (Array.isArray(events) ? events : []).forEach((event, index) => {
    stmt.run(runId, index + 1, String(event?.type || 'event'), JSON.stringify(event), nowIso());
  });
}

function persistToolRuns(runs = []) {
  db.prepare('DELETE FROM tool_runs WHERE run_id = ?').run(runId);
  const stmt = db.prepare('INSERT INTO tool_runs (run_id, seq, tool, ok, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  (Array.isArray(runs) ? runs : []).forEach((entry, index) => {
    stmt.run(runId, index + 1, String(entry?.tool || ''), entry?.ok === false ? 0 : 1, JSON.stringify(entry), nowIso());
  });
}

function appendHostMessage({ direction = 'session', channel = 'default', payload = {} } = {}) {
  db.prepare('INSERT INTO host_messages (run_id, direction, channel, payload, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(runId, String(direction || 'session'), String(channel || 'default'), JSON.stringify(payload || {}), nowIso());
}

function listHostMessages({ direction = '', channel = '', limit = 100 } = {}) {
  const clauses = ['run_id = ?'];
  const args = [runId];
  if (String(direction || '').trim()) {
    clauses.push('direction = ?');
    args.push(String(direction || '').trim());
  }
  if (String(channel || '').trim()) {
    clauses.push('channel = ?');
    args.push(String(channel || '').trim());
  }
  const capped = Math.max(1, Math.min(500, Number(limit || 100)));
  const rows = db.prepare(`
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
    runId,
    status: String(job?.status || 'pending'),
    kind: String(job?.kind || 'generic'),
    payload: job?.payload || {},
    updatedAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO scheduler_jobs (job_id, run_id, status, payload, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET status=excluded.status, payload=excluded.payload, updated_at=excluded.updated_at
  `).run(normalized.jobId, normalized.runId, normalized.status, JSON.stringify(normalized), normalized.updatedAt);
  return normalized;
}

function listSchedulerJobs() {
  const rows = db.prepare('SELECT payload FROM scheduler_jobs WHERE run_id = ? ORDER BY updated_at DESC').all(runId);
  return rows.map((row) => {
    try {
      return JSON.parse(String(row.payload || '{}'));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function getStats() {
  const eventCount = Number(db.prepare('SELECT COUNT(*) AS count FROM event_log WHERE run_id = ?').get(runId)?.count || 0);
  const toolRunCount = Number(db.prepare('SELECT COUNT(*) AS count FROM tool_runs WHERE run_id = ?').get(runId)?.count || 0);
  const hostMessageCount = Number(db.prepare('SELECT COUNT(*) AS count FROM host_messages WHERE run_id = ?').get(runId)?.count || 0);
  const schedulerJobCount = Number(db.prepare('SELECT COUNT(*) AS count FROM scheduler_jobs WHERE run_id = ?').get(runId)?.count || 0);
  return { eventCount, toolRunCount, hostMessageCount, schedulerJobCount, dbPath };
}

async function persistServiceState() {
  await writeJson(statePath, {
    contractVersion: 'agent-harness-external-store.v1',
    runId,
    dbPath,
    metaPath,
    statePath,
    updatedAt: nowIso(),
    stats: getStats(),
  });
}

await ensureDir(path.dirname(dbPath));
await ensureDir(path.dirname(metaPath));
await ensureDir(path.dirname(statePath));
initSchema();
upsertMeta('contractVersion', 'agent-harness-backend.v1');
upsertMeta('backendId', 'sqlite-state-backend');
upsertMeta('driver', 'sqlite');
upsertMeta('topology', 'external_service');
upsertMeta('runId', runId);
await writeJson(metaPath, {
  contractVersion: 'agent-harness-backend.v1',
  kind: 'state_backend',
  backendId: 'sqlite-state-backend',
  driver: 'sqlite',
  durability: 'external-sqlite-service',
  topology: 'external_service',
  initializedAt: nowIso(),
  dbPath,
  runId,
  serviceContractVersion: 'agent-harness-external-store.v1',
  swappableTargets: ['sqlite', 'redis', 'postgres'],
});
await persistServiceState();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      await persistServiceState();
      return sendJson(res, 200, {
        ok: true,
        contractVersion: 'agent-harness-external-store.v1',
        runId,
        dbPath,
        statePath,
        stats: getStats(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/init') {
      const body = await readJsonBody(req);
      await writeJson(metaPath, {
        contractVersion: 'agent-harness-backend.v1',
        kind: 'state_backend',
        backendId: 'sqlite-state-backend',
        driver: 'sqlite',
        durability: 'external-sqlite-service',
        topology: 'external_service',
        initializedAt: nowIso(),
        dbPath,
        runId,
        backendMetaPath: String(body?.backendMetaPath || metaPath),
        statePath: String(body?.statePath || statePath),
        serviceContractVersion: 'agent-harness-external-store.v1',
        swappableTargets: ['sqlite', 'redis', 'postgres'],
      });
      await persistServiceState();
      return sendJson(res, 200, { ok: true, dbPath, metaPath, statePath, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/json/write') {
      const body = await readJsonBody(req);
      const filePath = String(body?.filePath || '');
      await writeJson(filePath, body?.value ?? {});
      await persistServiceState();
      return sendJson(res, 200, { ok: true, filePath, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/jsonl/write') {
      const body = await readJsonBody(req);
      const filePath = String(body?.filePath || '');
      await writeJsonLines(filePath, Array.isArray(body?.items) ? body.items : []);
      await persistServiceState();
      return sendJson(res, 200, { ok: true, filePath, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/json/read') {
      const body = await readJsonBody(req);
      const value = await readJson(String(body?.filePath || ''), body?.fallback ?? null);
      return sendJson(res, 200, { ok: true, value, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/persist/run-state') {
      const body = await readJsonBody(req);
      persistRunState(body?.state || {});
      await persistServiceState();
      return sendJson(res, 200, { ok: true, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/persist/event-log') {
      const body = await readJsonBody(req);
      persistEventLog(Array.isArray(body?.events) ? body.events : []);
      await persistServiceState();
      return sendJson(res, 200, { ok: true, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/persist/tool-runs') {
      const body = await readJsonBody(req);
      persistToolRuns(Array.isArray(body?.runs) ? body.runs : []);
      await persistServiceState();
      return sendJson(res, 200, { ok: true, stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/host/append') {
      const body = await readJsonBody(req);
      appendHostMessage(body?.entry || {});
      await persistServiceState();
      return sendJson(res, 200, { ok: true, stats: getStats() });
    }

    if (req.method === 'GET' && url.pathname === '/host/list') {
      const direction = String(url.searchParams.get('direction') || '');
      const channel = String(url.searchParams.get('channel') || '');
      const limit = Number(url.searchParams.get('limit') || 100);
      return sendJson(res, 200, { ok: true, messages: listHostMessages({ direction, channel, limit }), stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/scheduler/upsert') {
      const body = await readJsonBody(req);
      const job = upsertSchedulerJob(body?.job || {});
      await persistServiceState();
      return sendJson(res, 200, { ok: true, job, stats: getStats() });
    }

    if (req.method === 'GET' && url.pathname === '/scheduler/list') {
      return sendJson(res, 200, { ok: true, jobs: listSchedulerJobs(), stats: getStats() });
    }

    if (req.method === 'POST' && url.pathname === '/shutdown') {
      sendJson(res, 200, { ok: true });
      setTimeout(() => {
        server.close(() => process.exit(0));
      }, 20).unref();
      return;
    }

    return sendJson(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: String(error?.message || error || 'internal_error') });
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  process.stdout.write(`${JSON.stringify({ type: 'ready', contractVersion: 'agent-harness-external-store.v1', port, dbPath, statePath })}\n`);
});

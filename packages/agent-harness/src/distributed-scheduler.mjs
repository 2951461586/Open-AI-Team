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
    dbPath: path.join(process.cwd(), 'runtime', 'scheduler-state.sqlite'),
    statePath: path.join(process.cwd(), 'runtime', 'scheduler-state.json'),
    runId: 'run:unknown',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db-path') {
      out.dbPath = argv[index + 1] || out.dbPath;
      index += 1;
    } else if (arg === '--state-path') {
      out.statePath = argv[index + 1] || out.statePath;
      index += 1;
    } else if (arg === '--run-id') {
      out.runId = argv[index + 1] || out.runId;
      index += 1;
    }
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

const args = parseArgs(process.argv.slice(2));
const dbPath = String(args.dbPath || '');
const statePath = String(args.statePath || '');
const runId = String(args.runId || 'run:unknown');
const db = new DatabaseSync(dbPath);

function initSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS broker_registry (
      broker_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      port INTEGER NOT NULL,
      state_path TEXT NOT NULL,
      status TEXT NOT NULL,
      health TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dispatch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      dispatch_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      role TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      lease_ms INTEGER NOT NULL,
      preferred_node_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lease_registry (
      lease_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      state TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_state (
      job_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      role TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recovery_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      lease_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      recovered_state TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function rowJson(text = '', fallback = {}) {
  try {
    return JSON.parse(String(text || '{}'));
  } catch {
    return fallback;
  }
}

function brokerRows() {
  return db.prepare('SELECT * FROM broker_registry WHERE run_id = ? ORDER BY broker_id').all(runId);
}

function brokers() {
  return brokerRows().map((row) => ({
    brokerId: String(row.broker_id || ''),
    nodeId: String(row.node_id || ''),
    port: Number(row.port || 0),
    statePath: String(row.state_path || ''),
    status: String(row.status || ''),
    health: String(row.health || ''),
    updatedAt: String(row.updated_at || ''),
  }));
}

function runningCountsByNode() {
  const rows = db.prepare('SELECT node_id, COUNT(*) AS count FROM job_state WHERE run_id = ? AND state IN (?, ?, ?) GROUP BY node_id').all(runId, 'queued', 'dispatched', 'running');
  return Object.fromEntries(rows.map((row) => [String(row.node_id || ''), Number(row.count || 0)]));
}

function runningCountsByBroker() {
  const rows = db.prepare('SELECT broker_id, COUNT(*) AS count FROM job_state WHERE run_id = ? AND state IN (?, ?, ?) GROUP BY broker_id').all(runId, 'queued', 'dispatched', 'running');
  return Object.fromEntries(rows.map((row) => [String(row.broker_id || ''), Number(row.count || 0)]));
}

function roleAffinityScore(nodeId = '', role = '', placementHints = []) {
  const hints = Array.isArray(placementHints) ? placementHints : [];
  const hint = hints.find((item) => String(item?.nodeId || '') === String(nodeId || ''));
  const roles = Array.isArray(hint?.roles) ? hint.roles.map((item) => String(item || '')) : [];
  if (roles.includes(role)) return 100;
  if (roles.length === 0) return 20;
  return 5;
}

function chooseBroker({ jobId = '', role = '', preferredNodeId = '', leaseMs = 1200, placementHints = [], payload = {} } = {}) {
  const brokerList = brokers().filter((broker) => broker.status !== 'stopped' && broker.health !== 'failed');
  if (brokerList.length === 0) return null;

  const byNode = runningCountsByNode();
  const byBroker = runningCountsByBroker();
  const ranked = brokerList.map((broker) => {
    const preferredScore = preferredNodeId && broker.nodeId === preferredNodeId ? 500 : 0;
    const affinityScore = roleAffinityScore(broker.nodeId, role, placementHints);
    const nodePenalty = Number(byNode[broker.nodeId] || 0) * 20;
    const brokerPenalty = Number(byBroker[broker.brokerId] || 0) * 10;
    const healthPenalty = broker.health === 'degraded' ? 50 : 0;
    const score = preferredScore + affinityScore - nodePenalty - brokerPenalty - healthPenalty;
    return { broker, score, preferredScore, affinityScore, nodePenalty, brokerPenalty, healthPenalty };
  }).sort((a, b) => b.score - a.score || a.broker.brokerId.localeCompare(b.broker.brokerId));

  const winner = ranked[0];
  if (!winner) return null;
  const dispatchId = `dispatch:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const leaseId = `lease:${jobId || dispatchId}`;
  const expiresAt = new Date(Date.now() + Math.max(200, Number(leaseMs || 1200))).toISOString();
  const reason = preferredNodeId && winner.broker.nodeId === preferredNodeId ? 'preferred_node' : winner.affinityScore >= 100 ? 'role_affinity' : 'least_loaded';

  db.prepare(`
    INSERT INTO dispatch_log (run_id, dispatch_id, job_id, role, broker_id, node_id, lease_ms, preferred_node_id, reason, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(runId, dispatchId, String(jobId || dispatchId), String(role || ''), winner.broker.brokerId, winner.broker.nodeId, Math.max(200, Number(leaseMs || 1200)), String(preferredNodeId || ''), reason, JSON.stringify(payload || {}), nowIso());

  db.prepare(`
    INSERT INTO lease_registry (lease_id, run_id, job_id, broker_id, node_id, state, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lease_id) DO UPDATE SET broker_id=excluded.broker_id, node_id=excluded.node_id, state=excluded.state, expires_at=excluded.expires_at, updated_at=excluded.updated_at
  `).run(leaseId, runId, String(jobId || dispatchId), winner.broker.brokerId, winner.broker.nodeId, 'reserved', expiresAt, nowIso());

  db.prepare(`
    INSERT INTO job_state (job_id, run_id, role, broker_id, node_id, state, attempts, updated_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET broker_id=excluded.broker_id, node_id=excluded.node_id, state=excluded.state, attempts=excluded.attempts, updated_at=excluded.updated_at, payload_json=excluded.payload_json
  `).run(String(jobId || dispatchId), runId, String(role || ''), winner.broker.brokerId, winner.broker.nodeId, 'dispatched', 0, nowIso(), JSON.stringify(payload || {}));

  return {
    dispatchId,
    leaseId,
    brokerId: winner.broker.brokerId,
    nodeId: winner.broker.nodeId,
    leaseMs: Math.max(200, Number(leaseMs || 1200)),
    expiresAt,
    reason,
    score: winner.score,
  };
}

function updateJob({ jobId = '', brokerId = '', nodeId = '', role = '', state = 'running', attempts = 0, payload = {} } = {}) {
  db.prepare(`
    INSERT INTO job_state (job_id, run_id, role, broker_id, node_id, state, attempts, updated_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET role=excluded.role, broker_id=excluded.broker_id, node_id=excluded.node_id, state=excluded.state, attempts=excluded.attempts, updated_at=excluded.updated_at, payload_json=excluded.payload_json
  `).run(String(jobId || ''), runId, String(role || ''), String(brokerId || ''), String(nodeId || ''), String(state || ''), Number(attempts || 0), nowIso(), JSON.stringify(payload || {}));
}

function touchLease({ leaseId = '', jobId = '', brokerId = '', nodeId = '', state = 'active', leaseMs = 1200 } = {}) {
  const expiresAt = new Date(Date.now() + Math.max(200, Number(leaseMs || 1200))).toISOString();
  db.prepare(`
    INSERT INTO lease_registry (lease_id, run_id, job_id, broker_id, node_id, state, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lease_id) DO UPDATE SET job_id=excluded.job_id, broker_id=excluded.broker_id, node_id=excluded.node_id, state=excluded.state, expires_at=excluded.expires_at, updated_at=excluded.updated_at
  `).run(String(leaseId || `lease:${jobId}`), runId, String(jobId || ''), String(brokerId || ''), String(nodeId || ''), String(state || 'active'), expiresAt, nowIso());
  return expiresAt;
}

function reapOrphanLeases({ graceMs = 0, reason = 'resume_recovery' } = {}) {
  const cutoffIso = new Date(Date.now() - Math.max(0, Number(graceMs || 0))).toISOString();
  const expired = db.prepare(`
    SELECT lease_id, job_id, broker_id, node_id, state, expires_at, updated_at
    FROM lease_registry
    WHERE run_id = ?
      AND state IN ('reserved', 'active', 'expired')
      AND expires_at <= ?
  `).all(runId, cutoffIso);

  const recovered = [];
  for (const row of expired) {
    const leaseId = String(row.lease_id || '');
    const jobId = String(row.job_id || '');
    const brokerId = String(row.broker_id || '');
    const nodeId = String(row.node_id || '');
    const previousState = String(row.state || 'unknown');
    db.prepare('UPDATE lease_registry SET state = ?, updated_at = ? WHERE lease_id = ?').run('reaped', nowIso(), leaseId);
    db.prepare('UPDATE job_state SET state = ?, updated_at = ? WHERE job_id = ?').run('recoverable', nowIso(), jobId);
    db.prepare(`
      INSERT INTO recovery_log (run_id, lease_id, job_id, broker_id, node_id, previous_state, recovered_state, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(runId, leaseId, jobId, brokerId, nodeId, previousState, 'recoverable', String(reason || 'resume_recovery'), nowIso());
    recovered.push({ leaseId, jobId, brokerId, nodeId, previousState, recoveredState: 'recoverable' });
  }
  return recovered;
}

function getSnapshot() {
  const brokerList = brokers();
  const dispatchCount = Number(db.prepare('SELECT COUNT(*) AS count FROM dispatch_log WHERE run_id = ?').get(runId)?.count || 0);
  const leaseCount = Number(db.prepare('SELECT COUNT(*) AS count FROM lease_registry WHERE run_id = ?').get(runId)?.count || 0);
  const activeLeaseCount = Number(db.prepare('SELECT COUNT(*) AS count FROM lease_registry WHERE run_id = ? AND state IN (?, ?)').get(runId, 'reserved', 'active')?.count || 0);
  const reapedLeaseCount = Number(db.prepare('SELECT COUNT(*) AS count FROM lease_registry WHERE run_id = ? AND state = ?').get(runId, 'reaped')?.count || 0);
  const recoveredJobCount = Number(db.prepare('SELECT COUNT(*) AS count FROM job_state WHERE run_id = ? AND state = ?').get(runId, 'recoverable')?.count || 0);
  const recoveryCount = Number(db.prepare('SELECT COUNT(*) AS count FROM recovery_log WHERE run_id = ?').get(runId)?.count || 0);
  const distributedDispatchCount = Number(db.prepare('SELECT COUNT(*) AS count FROM job_state WHERE run_id = ? AND state IN (?, ?, ?, ?)').get(runId, 'queued', 'dispatched', 'running', 'completed')?.count || 0);
  return {
    contractVersion: 'agent-harness-distributed-scheduler.v1',
    runId,
    dbPath,
    statePath,
    updatedAt: nowIso(),
    brokers: brokerList,
    counts: {
      brokerCount: brokerList.length,
      activeBrokerCount: brokerList.filter((item) => item.status !== 'stopped').length,
      dispatchCount,
      leaseCount,
      activeLeaseCount,
      reapedLeaseCount,
      recoveredJobCount,
      recoveryCount,
      distributedDispatchCount,
    },
  };
}

async function persistState() {
  await writeState(getSnapshot());
}

async function writeState(snapshot = {}) {
  await ensureDir(path.dirname(statePath));
  await fs.writeFile(statePath, JSON.stringify(snapshot, null, 2), 'utf8');
}

await ensureDir(path.dirname(dbPath));
initSchema();
await persistState();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      await persistState();
      return sendJson(res, 200, { ok: true, ...getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/brokers/register') {
      const body = await readJsonBody(req);
      const brokerId = String(body?.brokerId || '').trim();
      const nodeId = String(body?.nodeId || '').trim();
      if (!brokerId || !nodeId) return sendJson(res, 400, { ok: false, error: 'broker_id_and_node_id_required' });
      db.prepare(`
        INSERT INTO broker_registry (broker_id, run_id, node_id, port, state_path, status, health, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(broker_id) DO UPDATE SET node_id=excluded.node_id, port=excluded.port, state_path=excluded.state_path, status=excluded.status, health=excluded.health, updated_at=excluded.updated_at
      `).run(brokerId, runId, nodeId, Number(body?.port || 0), String(body?.statePath || ''), String(body?.status || 'ready'), String(body?.health || 'ok'), nowIso());
      await persistState();
      return sendJson(res, 200, { ok: true, snapshot: getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/brokers/heartbeat') {
      const body = await readJsonBody(req);
      const brokerId = String(body?.brokerId || '').trim();
      const row = db.prepare('SELECT * FROM broker_registry WHERE broker_id = ?').get(brokerId);
      if (!row) return sendJson(res, 404, { ok: false, error: 'broker_not_found' });
      db.prepare('UPDATE broker_registry SET status = ?, health = ?, updated_at = ? WHERE broker_id = ?')
        .run(String(body?.status || row.status || 'ready'), String(body?.health || row.health || 'ok'), nowIso(), brokerId);
      await persistState();
      return sendJson(res, 200, { ok: true, snapshot: getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/brokers/stopped') {
      const body = await readJsonBody(req);
      const brokerId = String(body?.brokerId || '').trim();
      db.prepare('UPDATE broker_registry SET status = ?, health = ?, updated_at = ? WHERE broker_id = ?')
        .run('stopped', 'stopped', nowIso(), brokerId);
      await persistState();
      return sendJson(res, 200, { ok: true, snapshot: getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/dispatch') {
      const body = await readJsonBody(req);
      const result = chooseBroker({
        jobId: body?.jobId || '',
        role: body?.role || '',
        preferredNodeId: body?.preferredNodeId || '',
        leaseMs: body?.leaseMs || 1200,
        placementHints: Array.isArray(body?.placementHints) ? body.placementHints : [],
        payload: body?.payload || {},
      });
      if (!result) return sendJson(res, 503, { ok: false, error: 'no_available_broker' });
      await persistState();
      return sendJson(res, 200, { ok: true, dispatch: result, snapshot: getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/jobs/update') {
      const body = await readJsonBody(req);
      updateJob(body || {});
      await persistState();
      return sendJson(res, 200, { ok: true, snapshot: getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/leases/touch') {
      const body = await readJsonBody(req);
      const expiresAt = touchLease(body || {});
      await persistState();
      return sendJson(res, 200, { ok: true, expiresAt, snapshot: getSnapshot() });
    }

    if (req.method === 'POST' && url.pathname === '/leases/reap-orphans') {
      const body = await readJsonBody(req);
      const recovered = reapOrphanLeases({ graceMs: body?.graceMs || 0, reason: body?.reason || 'resume_recovery' });
      await persistState();
      return sendJson(res, 200, { ok: true, recovered, snapshot: getSnapshot() });
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
  process.stdout.write(`${JSON.stringify({ type: 'ready', contractVersion: 'agent-harness-distributed-scheduler.v1', port, dbPath, statePath })}\n`);
});

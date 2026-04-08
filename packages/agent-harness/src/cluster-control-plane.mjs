import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function normalizeNodes(nodes = []) {
  return (Array.isArray(nodes) ? nodes : []).map((node, index) => ({
    nodeId: String(node?.nodeId || node?.id || `node-${index + 1}`),
    region: String(node?.region || 'local'),
    roles: Array.isArray(node?.roles) ? node.roles.map((item) => String(item || '')).filter(Boolean) : [],
    labels: node?.labels && typeof node.labels === 'object' ? node.labels : {},
    tier: String(node?.tier || 'worker'),
  }));
}

function roleAffinityScore(node = {}, role = '') {
  if (!role) return 0;
  const roles = Array.isArray(node.roles) ? node.roles : [];
  if (roles.includes(role)) return 100;
  if (roles.length === 0) return 20;
  return 5;
}

export function createDistributedControlPlane({ dbPath = '', runId = '', clusterDir = '', nodes = [] } = {}) {
  const normalizedNodes = normalizeNodes(nodes);
  const clusterRegistryPath = path.join(clusterDir || path.dirname(dbPath), 'cluster-registry.json');
  const clusterPlacementsPath = path.join(clusterDir || path.dirname(dbPath), 'cluster-placements.jsonl');
  const clusterSummaryPath = path.join(clusterDir || path.dirname(dbPath), 'cluster-summary.json');
  let db = null;

  function getDb() {
    if (!db) db = new DatabaseSync(String(dbPath || ':memory:'));
    return db;
  }

  function initSchema() {
    const conn = getDb();
    conn.exec(`
      CREATE TABLE IF NOT EXISTS cluster_nodes (
        node_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        region TEXT NOT NULL,
        tier TEXT NOT NULL,
        roles_json TEXT NOT NULL,
        labels_json TEXT NOT NULL,
        status TEXT NOT NULL,
        broker_count INTEGER NOT NULL,
        active_jobs INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS broker_registry (
        broker_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        pid INTEGER NOT NULL,
        port INTEGER NOT NULL,
        state_path TEXT NOT NULL,
        status TEXT NOT NULL,
        last_health TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS placement_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        role TEXT NOT NULL,
        node_id TEXT NOT NULL,
        broker_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS broker_jobs (
        job_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        role TEXT NOT NULL,
        node_id TEXT NOT NULL,
        broker_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        queue_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scheduler_dispatches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS control_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async function appendPlacementFile(entry = {}) {
    await ensureDir(path.dirname(clusterPlacementsPath));
    await fs.appendFile(clusterPlacementsPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  async function writeRegistryFiles() {
    await ensureDir(path.dirname(clusterRegistryPath));
    const snapshot = getSnapshot();
    await fs.writeFile(clusterRegistryPath, JSON.stringify({
      runId,
      generatedAt: nowIso(),
      nodes: snapshot.nodes,
      brokers: snapshot.brokers,
    }, null, 2), 'utf8');
    await fs.writeFile(clusterSummaryPath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async function init() {
    await ensureDir(path.dirname(dbPath));
    await ensureDir(clusterDir);
    initSchema();
    for (const node of normalizedNodes) {
      registerNode(node);
    }
    await writeRegistryFiles();
    return {
      clusterRegistryPath,
      clusterPlacementsPath,
      clusterSummaryPath,
    };
  }

  function registerNode(node = {}) {
    const normalized = {
      nodeId: String(node?.nodeId || node?.id || 'node-unknown'),
      region: String(node?.region || 'local'),
      tier: String(node?.tier || 'worker'),
      roles: Array.isArray(node?.roles) ? node.roles.map((item) => String(item || '')).filter(Boolean) : [],
      labels: node?.labels && typeof node.labels === 'object' ? node.labels : {},
      status: String(node?.status || 'ready'),
      brokerCount: Number(node?.brokerCount || 0),
      activeJobs: Number(node?.activeJobs || 0),
      updatedAt: nowIso(),
    };
    getDb().prepare(`
      INSERT INTO cluster_nodes (node_id, run_id, region, tier, roles_json, labels_json, status, broker_count, active_jobs, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        region=excluded.region,
        tier=excluded.tier,
        roles_json=excluded.roles_json,
        labels_json=excluded.labels_json,
        status=excluded.status,
        broker_count=excluded.broker_count,
        active_jobs=excluded.active_jobs,
        updated_at=excluded.updated_at
    `).run(normalized.nodeId, runId, normalized.region, normalized.tier, JSON.stringify(normalized.roles), JSON.stringify(normalized.labels), normalized.status, normalized.brokerCount, normalized.activeJobs, normalized.updatedAt);
    return normalized;
  }

  function brokerCountsByNode() {
    const rows = getDb().prepare('SELECT node_id, COUNT(*) AS count FROM broker_registry WHERE run_id = ? AND status != ? GROUP BY node_id').all(runId, 'stopped');
    return Object.fromEntries(rows.map((row) => [String(row.node_id || ''), Number(row.count || 0)]));
  }

  function activeJobsByNode() {
    const rows = getDb().prepare('SELECT node_id, COUNT(*) AS count FROM broker_jobs WHERE run_id = ? AND status IN (?, ?) GROUP BY node_id').all(runId, 'queued', 'running');
    return Object.fromEntries(rows.map((row) => [String(row.node_id || ''), Number(row.count || 0)]));
  }

  function updateNodeLoad(nodeId = '') {
    const brokerCounts = brokerCountsByNode();
    const activeCounts = activeJobsByNode();
    const existing = listNodes().find((node) => node.nodeId === nodeId);
    if (!existing) return null;
    return registerNode({
      ...existing,
      brokerCount: Number(brokerCounts[nodeId] || 0),
      activeJobs: Number(activeCounts[nodeId] || 0),
      status: Number(brokerCounts[nodeId] || 0) > 0 ? 'ready' : existing.status || 'ready',
    });
  }

  function registerBroker({ brokerId = '', nodeId = '', pid = 0, port = 0, statePath = '', status = 'ready', lastHealth = 'ok' } = {}) {
    const normalized = {
      brokerId: String(brokerId || ''),
      nodeId: String(nodeId || 'node-unknown'),
      pid: Number(pid || 0),
      port: Number(port || 0),
      statePath: String(statePath || ''),
      status: String(status || 'ready'),
      lastHealth: String(lastHealth || 'ok'),
      updatedAt: nowIso(),
    };
    getDb().prepare(`
      INSERT INTO broker_registry (broker_id, run_id, node_id, pid, port, state_path, status, last_health, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(broker_id) DO UPDATE SET
        node_id=excluded.node_id,
        pid=excluded.pid,
        port=excluded.port,
        state_path=excluded.state_path,
        status=excluded.status,
        last_health=excluded.last_health,
        updated_at=excluded.updated_at
    `).run(normalized.brokerId, runId, normalized.nodeId, normalized.pid, normalized.port, normalized.statePath, normalized.status, normalized.lastHealth, normalized.updatedAt);
    updateNodeLoad(normalized.nodeId);
    return normalized;
  }

  function heartbeatBroker({ brokerId = '', nodeId = '', lastHealth = 'ok', status = 'ready' } = {}) {
    const row = getDb().prepare('SELECT broker_id, node_id, pid, port, state_path FROM broker_registry WHERE broker_id = ?').get(String(brokerId || ''));
    if (!row) return null;
    return registerBroker({
      brokerId: row.broker_id,
      nodeId: nodeId || row.node_id,
      pid: row.pid,
      port: row.port,
      statePath: row.state_path,
      status,
      lastHealth,
    });
  }

  function markBrokerStopped(brokerId = '') {
    const row = getDb().prepare('SELECT node_id, pid, port, state_path FROM broker_registry WHERE broker_id = ?').get(String(brokerId || ''));
    if (!row) return null;
    return registerBroker({
      brokerId,
      nodeId: row.node_id,
      pid: row.pid,
      port: row.port,
      statePath: row.state_path,
      status: 'stopped',
      lastHealth: 'stopped',
    });
  }

  function listNodes() {
    const rows = getDb().prepare('SELECT * FROM cluster_nodes WHERE run_id = ? ORDER BY node_id').all(runId);
    return rows.map((row) => ({
      nodeId: String(row.node_id || ''),
      region: String(row.region || ''),
      tier: String(row.tier || ''),
      roles: JSON.parse(String(row.roles_json || '[]')),
      labels: JSON.parse(String(row.labels_json || '{}')),
      status: String(row.status || ''),
      brokerCount: Number(row.broker_count || 0),
      activeJobs: Number(row.active_jobs || 0),
      updatedAt: String(row.updated_at || ''),
    }));
  }

  function listBrokers() {
    const rows = getDb().prepare('SELECT * FROM broker_registry WHERE run_id = ? ORDER BY node_id, broker_id').all(runId);
    return rows.map((row) => ({
      brokerId: String(row.broker_id || ''),
      nodeId: String(row.node_id || ''),
      pid: Number(row.pid || 0),
      port: Number(row.port || 0),
      statePath: String(row.state_path || ''),
      status: String(row.status || ''),
      lastHealth: String(row.last_health || ''),
      updatedAt: String(row.updated_at || ''),
    }));
  }

  function selectPlacement({ role = '', preferredNodeId = '' } = {}) {
    const nodes = listNodes().filter((node) => node.status !== 'stopped');
    if (nodes.length === 0) return { nodeId: '', reason: 'no_nodes' };
    const scored = nodes.map((node) => ({
      ...node,
      preferredScore: preferredNodeId && node.nodeId === preferredNodeId ? 500 : 0,
      roleScore: roleAffinityScore(node, role),
      loadPenalty: Number(node.activeJobs || 0) * 20,
      emptyPenalty: Number(node.brokerCount || 0) <= 0 ? 200 : 0,
    })).map((node) => ({
      ...node,
      finalScore: node.preferredScore + node.roleScore - node.loadPenalty - node.emptyPenalty,
    })).sort((a, b) => b.finalScore - a.finalScore || a.activeJobs - b.activeJobs || a.nodeId.localeCompare(b.nodeId));
    const winner = scored[0];
    return {
      nodeId: winner.nodeId,
      reason: preferredNodeId && winner.nodeId === preferredNodeId ? 'preferred_node' : winner.roleScore >= 100 ? 'role_affinity' : 'least_loaded',
      score: winner.finalScore,
    };
  }

  async function recordPlacement({ jobId = '', role = '', nodeId = '', brokerId = '', reason = '' } = {}) {
    const entry = {
      runId,
      jobId: String(jobId || ''),
      role: String(role || ''),
      nodeId: String(nodeId || ''),
      brokerId: String(brokerId || ''),
      reason: String(reason || 'placement'),
      createdAt: nowIso(),
    };
    getDb().prepare('INSERT INTO placement_log (run_id, job_id, role, node_id, broker_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(entry.runId, entry.jobId, entry.role, entry.nodeId, entry.brokerId, entry.reason, entry.createdAt);
    await appendPlacementFile(entry);
    return entry;
  }

  function updateBrokerJob({ jobId = '', role = '', nodeId = '', brokerId = '', status = '', attempt = 0, queueKey = '', payload = {} } = {}) {
    const normalized = {
      jobId: String(jobId || ''),
      role: String(role || ''),
      nodeId: String(nodeId || ''),
      brokerId: String(brokerId || ''),
      status: String(status || 'queued'),
      attempt: Number(attempt || 0),
      queueKey: String(queueKey || ''),
      payload: payload || {},
      updatedAt: nowIso(),
    };
    getDb().prepare(`
      INSERT INTO broker_jobs (job_id, run_id, role, node_id, broker_id, status, attempt, queue_key, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        role=excluded.role,
        node_id=excluded.node_id,
        broker_id=excluded.broker_id,
        status=excluded.status,
        attempt=excluded.attempt,
        queue_key=excluded.queue_key,
        payload_json=excluded.payload_json,
        updated_at=excluded.updated_at
    `).run(normalized.jobId, runId, normalized.role, normalized.nodeId, normalized.brokerId, normalized.status, normalized.attempt, normalized.queueKey, JSON.stringify(normalized.payload), normalized.updatedAt);
    updateNodeLoad(normalized.nodeId);
    return normalized;
  }

  function recordSchedulerDispatch({ jobId = '', targetNodeId = '', status = 'dispatched', payload = {} } = {}) {
    const entry = {
      runId,
      jobId: String(jobId || ''),
      targetNodeId: String(targetNodeId || ''),
      status: String(status || 'dispatched'),
      payload: payload || {},
      updatedAt: nowIso(),
    };
    getDb().prepare('INSERT INTO scheduler_dispatches (run_id, job_id, target_node_id, status, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(entry.runId, entry.jobId, entry.targetNodeId, entry.status, JSON.stringify(entry.payload), entry.updatedAt);
    return entry;
  }

  function appendControlEvent(eventType = '', payload = {}) {
    getDb().prepare('INSERT INTO control_events (run_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)')
      .run(runId, String(eventType || ''), JSON.stringify(payload || {}), nowIso());
  }

  function getSnapshot() {
    const nodes = listNodes();
    const brokers = listBrokers();
    const jobRows = getDb().prepare('SELECT status, COUNT(*) AS count FROM broker_jobs WHERE run_id = ? GROUP BY status').all(runId);
    const jobsByStatus = Object.fromEntries(jobRows.map((row) => [String(row.status || ''), Number(row.count || 0)]));
    const placementCount = Number(getDb().prepare('SELECT COUNT(*) AS count FROM placement_log WHERE run_id = ?').get(runId)?.count || 0);
    const dispatchCount = Number(getDb().prepare('SELECT COUNT(*) AS count FROM scheduler_dispatches WHERE run_id = ?').get(runId)?.count || 0);
    const eventCount = Number(getDb().prepare('SELECT COUNT(*) AS count FROM control_events WHERE run_id = ?').get(runId)?.count || 0);
    return {
      contractVersion: 'agent-harness-cluster-control.v1',
      runId,
      generatedAt: nowIso(),
      nodes,
      brokers,
      counts: {
        nodeCount: nodes.length,
        activeBrokerCount: brokers.filter((broker) => broker.status !== 'stopped').length,
        placementCount,
        dispatchCount,
        controlEventCount: eventCount,
      },
      jobsByStatus,
      paths: {
        clusterRegistryPath,
        clusterPlacementsPath,
        clusterSummaryPath,
      },
    };
  }

  async function refreshFiles() {
    await writeRegistryFiles();
    return getSnapshot();
  }

  return {
    contractVersion: 'agent-harness-cluster-control.v1',
    paths: {
      clusterRegistryPath,
      clusterPlacementsPath,
      clusterSummaryPath,
    },
    init,
    registerNode,
    registerBroker,
    heartbeatBroker,
    markBrokerStopped,
    listNodes,
    listBrokers,
    selectPlacement,
    recordPlacement,
    updateBrokerJob,
    recordSchedulerDispatch,
    appendControlEvent,
    getSnapshot,
    refreshFiles,
  };
}

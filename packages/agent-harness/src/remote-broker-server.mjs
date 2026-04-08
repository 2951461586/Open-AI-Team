import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

function parseJsonLine(line = '') {
  try {
    return JSON.parse(String(line || '').trim());
  } catch {
    return null;
  }
}

async function postJson(url = '', payload = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
  return data;
}

function parseArgs(argv = []) {
  const out = { brokerId: 'broker-1', nodeId: 'node-1', runtimeDir: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--broker-id') {
      out.brokerId = argv[index + 1] || out.brokerId;
      index += 1;
    } else if (arg === '--node-id') {
      out.nodeId = argv[index + 1] || out.nodeId;
      index += 1;
    } else if (arg === '--runtime-dir') {
      out.runtimeDir = argv[index + 1] || out.runtimeDir;
      index += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const brokerId = String(args.brokerId || 'broker-1');
const nodeId = String(args.nodeId || 'node-1');
const runtimeDir = String(args.runtimeDir || process.cwd());
const brokerStatePath = path.join(runtimeDir, `broker-state-${brokerId}.json`);

function snapshotJob(job, offset = 0) {
  const safeOffset = Math.max(0, Number(offset || 0));
  return {
    ok: true,
    jobId: job.id,
    brokerId,
    nodeId,
    status: job.status,
    events: job.events.slice(safeOffset),
    nextOffset: job.events.length,
    result: job.status === 'completed' ? job.result : null,
    error: job.status === 'failed' ? job.error : '',
  };
}

const jobs = new Map();
const children = new Set();
let persistChain = Promise.resolve();

function serializeJobs() {
  return Array.from(jobs.values()).map((job) => ({
    id: job.id,
    role: job.role,
    brokerId,
    nodeId,
    status: job.status,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    leaseMs: job.leaseMs,
    retryCount: job.retryCount,
    queueKey: job.queueKey,
    error: job.error,
    eventCount: job.events.length,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastLeaseExpiresAt: job.lastLeaseExpiresAt,
    leaseId: job.leaseId,
    dispatchId: job.dispatchId,
  }));
}

function persistBrokerState() {
  persistChain = persistChain.then(async () => {
    await fs.mkdir(runtimeDir, { recursive: true });
    const data = {
      brokerId,
      nodeId,
      updatedAt: new Date().toISOString(),
      summary: {
        totalJobs: jobs.size,
        queued: Array.from(jobs.values()).filter((job) => job.status === 'queued').length,
        running: Array.from(jobs.values()).filter((job) => job.status === 'running').length,
        completed: Array.from(jobs.values()).filter((job) => job.status === 'completed').length,
        failed: Array.from(jobs.values()).filter((job) => job.status === 'failed').length,
      },
      jobs: serializeJobs(),
    };
    await fs.writeFile(brokerStatePath, JSON.stringify(data, null, 2));
  }).catch(() => {});
  return persistChain;
}

function durableResultDirForJob(job = {}) {
  const sharedDir = String(job?.payload?.paths?.sharedDir || runtimeDir || process.cwd());
  return path.join(sharedDir, 'broker-results');
}

function durableResultPathForJob(job = {}) {
  const runId = String(job?.payload?.runId || 'run-unknown').replace(/[^a-z0-9_-]/gi, '_');
  const jobId = String(job?.id || 'job-unknown').replace(/[^a-z0-9_-]/gi, '_');
  return path.join(durableResultDirForJob(job), `${runId}__${jobId}.json`);
}

async function persistDurableResult(job = {}) {
  const filePath = durableResultPathForJob(job);
  const body = {
    contractVersion: 'agent-harness-broker-result.v1',
    runId: String(job?.payload?.runId || ''),
    jobId: String(job?.id || ''),
    workItemId: String(job?.payload?.request?.context?.workItem?.id || ''),
    role: String(job?.role || ''),
    title: String(job?.payload?.request?.context?.workItem?.title || ''),
    brokerId,
    nodeId,
    status: String(job?.status || ''),
    attempt: Number(job?.attempt || 0),
    retryCount: Number(job?.retryCount || 0),
    dispatchId: String(job?.dispatchId || ''),
    leaseId: String(job?.leaseId || ''),
    error: String(job?.error || ''),
    result: job?.result || null,
    eventCount: Array.isArray(job?.events) ? job.events.length : 0,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(body, null, 2));
  return filePath;
}

async function notifyScheduler(url = '', body = {}) {
  if (!url) return null;
  try {
    return await postJson(url, body);
  } catch {
    return null;
  }
}

function pushEvent(job, event = {}) {
  job.updatedAt = Date.now();
  const normalizedEvent = { ...event, brokerId, nodeId, ts: event.ts || Date.now() };
  job.events.push(normalizedEvent);
  persistBrokerState();
  const waiters = job.waiters.splice(0, job.waiters.length);
  for (const waiter of waiters) waiter();
}

function waitForJob(job, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), Math.max(1, Number(timeoutMs || 1000)));
    job.waiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function scheduleRetry(job, reason = 'retryable_failure') {
  if (job.attempt >= job.maxAttempts) {
    job.status = 'failed';
    job.error = reason;
    pushEvent(job, { type: 'transport.job.failed', jobId: job.id, role: job.role, error: reason, attempt: job.attempt });
    notifyScheduler(job.schedulerJobsUpdateUrl, {
      jobId: job.id,
      brokerId,
      nodeId,
      role: job.role,
      state: 'failed',
      attempts: job.attempt,
      payload: { error: reason },
    });
    notifyScheduler(job.schedulerLeaseTouchUrl, {
      leaseId: job.leaseId,
      jobId: job.id,
      brokerId,
      nodeId,
      state: 'failed',
      leaseMs: job.leaseMs,
    });
    return;
  }
  job.status = 'queued';
  job.retryCount += 1;
  pushEvent(job, { type: 'transport.job.retried', jobId: job.id, role: job.role, attempt: job.attempt, retryCount: job.retryCount, reason });
  notifyScheduler(job.schedulerJobsUpdateUrl, {
    jobId: job.id,
    brokerId,
    nodeId,
    role: job.role,
    state: 'queued',
    attempts: job.attempt,
    payload: { retryCount: job.retryCount, reason },
  });
  setTimeout(() => {
    launchAttempt(job).catch((err) => {
      job.status = 'failed';
      job.error = String(err?.message || err || 'retry_launch_failed');
      pushEvent(job, { type: 'transport.job.failed', jobId: job.id, role: job.role, error: job.error, attempt: job.attempt });
    });
  }, 50).unref();
}

async function launchAttempt(job) {
  job.attempt += 1;
  job.status = 'running';
  const payloadPath = path.join(runtimeDir, `broker-worker-input-${job.id.replace(/[^a-z0-9_-]/gi, '_')}-attempt-${job.attempt}.json`);
  const request = {
    ...job.payload.request,
    __brokerAttempt: job.attempt,
    __brokerId: brokerId,
    __nodeId: nodeId,
  };
  job.payload.runId = String(job.payload.runId || job.payload?.dispatch?.runId || '');
  await fs.writeFile(payloadPath, JSON.stringify({
    manifestPath: job.payload.manifestPath,
    agentPackagePath: job.payload.agentPackagePath,
    paths: job.payload.paths,
    stateSnapshot: job.payload.stateSnapshot,
    request,
  }, null, 2));

  const child = spawn(process.execPath, [job.payload.workerEntryPath, payloadPath], {
    cwd: path.dirname(job.payload.workerEntryPath),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  job.current = { child, payloadPath, pid: child.pid, completed: false, leaseExpired: false };
  job.lastLeaseExpiresAt = new Date(Date.now() + job.leaseMs).toISOString();
  pushEvent(job, { type: 'transport.job.running', jobId: job.id, role: job.role, pid: child.pid, attempt: job.attempt });
  pushEvent(job, { type: 'transport.lease.acquired', jobId: job.id, role: job.role, pid: child.pid, attempt: job.attempt, leaseMs: job.leaseMs, leaseExpiresAt: job.lastLeaseExpiresAt, leaseId: job.leaseId, dispatchId: job.dispatchId });
  notifyScheduler(job.schedulerJobsUpdateUrl, {
    jobId: job.id,
    brokerId,
    nodeId,
    role: job.role,
    state: 'running',
    attempts: job.attempt,
    payload: { dispatchId: job.dispatchId },
  });
  notifyScheduler(job.schedulerLeaseTouchUrl, {
    leaseId: job.leaseId,
    jobId: job.id,
    brokerId,
    nodeId,
    state: 'active',
    leaseMs: job.leaseMs,
  });

  let stdoutBuffer = '';
  let stderr = '';
  let explicitError = '';

  const handleLine = (line) => {
    const msg = parseJsonLine(line);
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'stream.chunk' && msg.payload) {
      pushEvent(job, { type: 'stream.chunk', payload: msg.payload, jobId: job.id, role: job.role, pid: child.pid, attempt: job.attempt });
      return;
    }
    if (msg.type === 'result' && msg.payload) {
      job.result = {
        ...msg.payload,
        run: {
          ...(msg.payload.run || {}),
          workerPid: child.pid,
        },
      };
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

  const leaseTimer = setTimeout(() => {
    if (!job.current || job.current.completed) return;
    job.current.leaseExpired = true;
    pushEvent(job, { type: 'transport.lease.expired', jobId: job.id, role: job.role, pid: child.pid, attempt: job.attempt, leaseMs: job.leaseMs, leaseId: job.leaseId });
    notifyScheduler(job.schedulerLeaseTouchUrl, {
      leaseId: job.leaseId,
      jobId: job.id,
      brokerId,
      nodeId,
      state: 'expired',
      leaseMs: job.leaseMs,
    });
    try { child.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, 250).unref();
  }, job.leaseMs);

  child.on('close', async (code) => {
    clearTimeout(leaseTimer);
    children.delete(child);
    if (stdoutBuffer.trim()) handleLine(stdoutBuffer.trim());
    try { await fs.unlink(payloadPath); } catch {}
    if (!job.current || job.current.pid !== child.pid) return;
    job.current.completed = true;

    if (job.current.leaseExpired) {
      scheduleRetry(job, 'lease_expired');
      return;
    }

    if (Number(code || 0) === 0 && job.result?.run) {
      job.status = 'completed';
      const durableResultPath = await persistDurableResult(job).catch(() => '');
      pushEvent(job, { type: 'transport.lease.released', jobId: job.id, role: job.role, pid: child.pid, attempt: job.attempt, leaseId: job.leaseId });
      pushEvent(job, { type: 'transport.job.completed', jobId: job.id, role: job.role, pid: child.pid, attempt: job.attempt, exitCode: Number(code || 0), dispatchId: job.dispatchId, durableResultPath });
      notifyScheduler(job.schedulerJobsUpdateUrl, {
        jobId: job.id,
        brokerId,
        nodeId,
        role: job.role,
        state: 'completed',
        attempts: job.attempt,
        payload: { dispatchId: job.dispatchId, workerPid: child.pid, durableResultPath },
      });
      notifyScheduler(job.schedulerLeaseTouchUrl, {
        leaseId: job.leaseId,
        jobId: job.id,
        brokerId,
        nodeId,
        state: 'released',
        leaseMs: job.leaseMs,
      });
      return;
    }

    const error = explicitError || stderr.trim() || `worker_exit_${Number(code || 1)}`;
    scheduleRetry(job, error);
  });
}

async function startJob(payload = {}) {
  await fs.mkdir(runtimeDir, { recursive: true });
  const role = String(payload?.request?.role || 'worker');
  const meta = payload?.request?.context?.workItem?.metadata || {};
  const job = {
    id: String(payload?.dispatch?.jobId || `job:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`),
    role,
    brokerId,
    queueKey: `${role}:${Date.now()}`,
    status: 'queued',
    attempt: 0,
    maxAttempts: Math.max(1, Number(meta.maxAttempts || 2)),
    retryCount: 0,
    leaseMs: Math.max(200, Number(payload?.dispatch?.leaseMs || meta.leaseMs || 1200)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastLeaseExpiresAt: '',
    events: [],
    result: null,
    error: '',
    waiters: [],
    payload,
    current: null,
    dispatchId: String(payload?.dispatch?.dispatchId || ''),
    leaseId: String(payload?.dispatch?.leaseId || `lease:${payload?.dispatch?.jobId || role}`),
    schedulerLeaseTouchUrl: String(payload?.dispatch?.schedulerLeaseTouchUrl || ''),
    schedulerJobsUpdateUrl: String(payload?.dispatch?.schedulerJobsUpdateUrl || ''),
  };
  jobs.set(job.id, job);
  pushEvent(job, { type: 'transport.job.queued', jobId: job.id, role, attempt: 0, queueKey: job.queueKey, dispatchId: job.dispatchId, leaseId: job.leaseId });
  notifyScheduler(job.schedulerJobsUpdateUrl, {
    jobId: job.id,
    brokerId,
    nodeId,
    role: job.role,
    state: 'queued',
    attempts: 0,
    payload: { dispatchId: job.dispatchId },
  });
  await launchAttempt(job);
  return job;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, brokerId, nodeId, jobs: jobs.size, brokerStatePath });
  }

  if (req.method === 'POST' && url.pathname === '/jobs') {
    const payload = await readJson(req);
    const job = await startJob(payload);
    return sendJson(res, 200, { ok: true, brokerId, nodeId, brokerStatePath, jobId: job.id, status: job.status, dispatchId: job.dispatchId, leaseId: job.leaseId });
  }

  const pollMatch = url.pathname.match(/^\/jobs\/([^/]+)\/poll$/);
  if (req.method === 'GET' && pollMatch) {
    const jobId = decodeURIComponent(String(pollMatch[1] || ''));
    const job = jobs.get(jobId);
    if (!job) return sendJson(res, 404, { ok: false, error: 'job_not_found' });
    const offset = Number(url.searchParams.get('offset') || 0);
    const timeoutMs = Number(url.searchParams.get('timeoutMs') || 1000);
    if (job.events.length > offset || job.status === 'completed' || job.status === 'failed') {
      return sendJson(res, 200, snapshotJob(job, offset));
    }
    await waitForJob(job, timeoutMs);
    return sendJson(res, 200, snapshotJob(job, offset));
  }

  if (req.method === 'POST' && url.pathname === '/shutdown') {
    sendJson(res, 200, { ok: true, brokerId, brokerStatePath });
    setTimeout(() => {
      server.close(() => process.exit(0));
      for (const child of children) {
        try { child.kill('SIGTERM'); } catch {}
      }
    }, 10).unref();
    return;
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' });
});

await fs.mkdir(runtimeDir, { recursive: true });
await persistBrokerState();

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  process.stdout.write(`${JSON.stringify({ type: 'ready', brokerId, nodeId, port, brokerStatePath })}\n`);
});

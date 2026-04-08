import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDistributedControlPlane } from './cluster-control-plane.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULER_ENTRY = path.join(__dirname, 'distributed-scheduler.mjs');

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

async function getJson(url = '', timeoutMs = 1000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(50, Number(timeoutMs || 1000)));
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('poll_timeout');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function defaultClusterNodes() {
  return [
    { nodeId: 'node-a', region: 'local-a', roles: ['planner', 'critic'], tier: 'control' },
    { nodeId: 'node-b', region: 'local-b', roles: ['executor'], tier: 'worker' },
    { nodeId: 'node-c', region: 'local-c', roles: ['judge'], tier: 'decision' },
  ];
}

export function createRemoteBrokerRuntimeAdapter({ manifestPath = '', agentPackagePath = '', workerEntryPath = '', brokerEntryPath = '', paths = {}, state = {}, eventBus = null, brokerCount = 2, clusterNodes = [], backendProvider = null, hostLayer = null } = {}) {
  let brokers = [];
  const brokerIdPrefix = String(state.runId || 'run-unknown').replace(/[^a-z0-9_-]/gi, '-');
  let brokersReadyPromise = null;
  let roundRobinIndex = 0;
  let schedulerServer = null;
  let schedulerReadyPromise = null;
  let schedulerBaseUrl = '';
  const normalizedNodes = Array.isArray(clusterNodes) && clusterNodes.length > 0 ? clusterNodes : defaultClusterNodes();
  const controlPlane = createDistributedControlPlane({
    dbPath: String(paths.backendDbPath || path.join(paths.runtimeDir || '.', 'harness-state.sqlite')),
    runId: String(state.runId || ''),
    clusterDir: String(paths.clusterDir || path.join(paths.runtimeDir || '.', 'cluster')),
    nodes: normalizedNodes,
  });
  let controlPlaneReady = false;

  async function refreshClusterSnapshot() {
    const snapshot = await controlPlane.refreshFiles();
    state.transport = {
      ...(state.transport || {}),
      cluster: snapshot,
      clusterControlPath: snapshot?.paths?.clusterSummaryPath || '',
      clusterRegistryPath: snapshot?.paths?.clusterRegistryPath || '',
      clusterPlacementsPath: snapshot?.paths?.clusterPlacementsPath || '',
    };
    return snapshot;
  }

  async function refreshSchedulerSnapshot() {
    if (!schedulerBaseUrl) return null;
    const snapshot = await getJson(`${schedulerBaseUrl}/health`, 1500);
    state.transport = {
      ...(state.transport || {}),
      scheduler: snapshot,
      schedulerStatePath: snapshot?.statePath || '',
      schedulerDbPath: snapshot?.dbPath || '',
    };
    return snapshot;
  }

  async function ensureScheduler() {
    if (schedulerBaseUrl) return schedulerBaseUrl;
    if (schedulerReadyPromise) return schedulerReadyPromise;
    schedulerReadyPromise = new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        SCHEDULER_ENTRY,
        '--db-path', String(paths.schedulerDbPath || path.join(paths.runtimeDir || '.', 'scheduler-state.sqlite')),
        '--state-path', String(paths.schedulerStatePath || path.join(paths.runtimeDir || '.', 'scheduler-state.json')),
        '--run-id', String(state.runId || ''),
      ], {
        cwd: __dirname,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      schedulerServer = { child };
      let stdoutBuffer = '';
      let stderr = '';
      let settled = false;

      child.stdout.on('data', (chunk) => {
        stdoutBuffer += String(chunk || '');
        let cursor = stdoutBuffer.indexOf('\n');
        while (cursor >= 0) {
          const line = stdoutBuffer.slice(0, cursor);
          stdoutBuffer = stdoutBuffer.slice(cursor + 1);
          const msg = parseJsonLine(line);
          if (msg?.type === 'ready' && msg.port && !settled) {
            settled = true;
            schedulerBaseUrl = `http://127.0.0.1:${Number(msg.port)}`;
            schedulerServer.baseUrl = schedulerBaseUrl;
            resolve(schedulerBaseUrl);
          }
          cursor = stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      child.on('close', (code) => {
        if (!settled) reject(new Error(stderr.trim() || `scheduler_exit_${Number(code || 1)}`));
        schedulerBaseUrl = '';
        schedulerServer = null;
        schedulerReadyPromise = null;
      });
    });
    const url = await schedulerReadyPromise;
    await refreshSchedulerSnapshot();
    return url;
  }

  async function ensureControlPlane() {
    if (!controlPlaneReady) {
      await controlPlane.init();
      controlPlane.appendControlEvent('cluster.control.initialized', { nodeCount: normalizedNodes.length });
      await ensureScheduler();
      await refreshClusterSnapshot();
      controlPlaneReady = true;
    }
    return controlPlane;
  }

  function assignedNodeForSlot(slot = 0) {
    return normalizedNodes[slot % normalizedNodes.length] || normalizedNodes[0] || { nodeId: `node-${slot + 1}` };
  }

  async function startBroker(slot = 0) {
    await ensureControlPlane();
    return new Promise((resolve, reject) => {
      const brokerId = `${brokerIdPrefix}-broker-${slot + 1}`;
      const assignedNode = assignedNodeForSlot(slot);
      const nodeId = String(assignedNode?.nodeId || `node-${slot + 1}`);
      const child = spawn(process.execPath, [brokerEntryPath, '--broker-id', brokerId, '--node-id', nodeId, '--runtime-dir', paths.runtimeDir], {
        cwd: path.dirname(brokerEntryPath),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutBuffer = '';
      let stderr = '';
      let resolved = false;

      child.stdout.on('data', async (chunk) => {
        stdoutBuffer += String(chunk || '');
        let cursor = stdoutBuffer.indexOf('\n');
        while (cursor >= 0) {
          const line = stdoutBuffer.slice(0, cursor);
          stdoutBuffer = stdoutBuffer.slice(cursor + 1);
          const msg = parseJsonLine(line);
          if (msg?.type === 'ready' && msg.port && !resolved) {
            resolved = true;
            const broker = {
              slot,
              brokerId,
              nodeId: String(msg.nodeId || nodeId),
              child,
              port: Number(msg.port),
              baseUrl: `http://127.0.0.1:${Number(msg.port)}`,
              brokerStatePath: String(msg.brokerStatePath || ''),
              stopping: false,
            };
            brokers[slot] = broker;
            controlPlane.registerBroker({
              brokerId: broker.brokerId,
              nodeId: broker.nodeId,
              pid: child.pid,
              port: broker.port,
              statePath: broker.brokerStatePath,
              status: 'ready',
              lastHealth: 'ok',
            });
            await postJson(`${schedulerBaseUrl}/brokers/register`, {
              brokerId: broker.brokerId,
              nodeId: broker.nodeId,
              port: broker.port,
              statePath: broker.brokerStatePath,
              status: 'ready',
              health: 'ok',
            });
            await refreshClusterSnapshot();
            await refreshSchedulerSnapshot();
            if (eventBus?.emit) {
              eventBus.emit({
                type: 'transport.broker.started',
                transportKind: 'remote_broker_http',
                brokerId,
                nodeId: broker.nodeId,
                pid: child.pid,
                port: Number(msg.port),
                brokerStatePath: broker.brokerStatePath,
                clusterSummaryPath: state.transport?.clusterControlPath || '',
                schedulerStatePath: state.transport?.schedulerStatePath || '',
              });
            }
            resolve(broker);
          }
          cursor = stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      child.on('close', async (code) => {
        const active = brokers[slot];
        if (active && active.child === child) brokers[slot] = null;
        controlPlane.markBrokerStopped(brokerId);
        controlPlane.appendControlEvent('cluster.broker.closed', { brokerId, nodeId, code: Number(code || 0) });
        if (schedulerBaseUrl) {
          try {
            await postJson(`${schedulerBaseUrl}/brokers/stopped`, { brokerId });
          } catch {}
        }
        await refreshClusterSnapshot();
        await refreshSchedulerSnapshot().catch(() => null);
        if (!resolved) reject(new Error(stderr.trim() || `broker_exit_${Number(code || 1)}`));
        if (resolved && !active?.stopping && eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.unhealthy',
            transportKind: 'remote_broker_http',
            brokerId,
            nodeId,
            pid: child.pid,
            port: active?.port || 0,
            brokerStatePath: active?.brokerStatePath || '',
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
            error: stderr.trim() || `broker_exit_${Number(code || 1)}`,
          });
        }
      });
    });
  }

  async function ensureBrokers() {
    await ensureControlPlane();
    if (brokersReadyPromise) return brokersReadyPromise;
    brokersReadyPromise = Promise.all(Array.from({ length: Math.max(1, Number(brokerCount || 2)) }, async (_, slot) => {
      if (brokers[slot]) return brokers[slot];
      const broker = await startBroker(slot);
      if (eventBus?.emit && state.transport?.brokersStartedOnce) {
        eventBus.emit({
          type: 'transport.broker.restarted',
          transportKind: 'remote_broker_http',
          brokerId: broker.brokerId,
          nodeId: broker.nodeId,
          pid: broker.child.pid,
          port: broker.port,
          brokerStatePath: broker.brokerStatePath,
          clusterSummaryPath: state.transport?.clusterControlPath || '',
          schedulerStatePath: state.transport?.schedulerStatePath || '',
        });
      }
      return broker;
    }));
    try {
      const ready = await brokersReadyPromise;
      state.transport = {
        ...(state.transport || {}),
        brokersStartedOnce: true,
      };
      await refreshClusterSnapshot();
      await refreshSchedulerSnapshot();
      return ready.filter(Boolean);
    } finally {
      brokersReadyPromise = null;
    }
  }

  function activeBrokers() {
    return brokers.filter(Boolean);
  }

  function brokersByNode(nodeId = '') {
    return activeBrokers().filter((broker) => broker.nodeId === nodeId);
  }

  function rotateBrokers(items = []) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length <= 1) return list;
    const start = roundRobinIndex % list.length;
    roundRobinIndex += 1;
    return list.slice(start).concat(list.slice(0, start));
  }

  async function stopBroker(broker, reason = 'manual_shutdown') {
    if (!broker) return;
    broker.stopping = true;
    try {
      await postJson(`${broker.baseUrl}/shutdown`, {});
    } catch {}
    try {
      await new Promise((resolve) => broker.child.once('close', resolve));
    } catch {}
    brokers[broker.slot] = null;
    controlPlane.markBrokerStopped(broker.brokerId);
    controlPlane.appendControlEvent('cluster.broker.stopped', { brokerId: broker.brokerId, nodeId: broker.nodeId, reason });
    if (schedulerBaseUrl) {
      try {
        await postJson(`${schedulerBaseUrl}/brokers/stopped`, { brokerId: broker.brokerId });
      } catch {}
    }
    await refreshClusterSnapshot();
    await refreshSchedulerSnapshot().catch(() => null);
    if (eventBus?.emit) {
      eventBus.emit({
        type: 'transport.broker.stopped',
        transportKind: 'remote_broker_http',
        brokerId: broker.brokerId,
        nodeId: broker.nodeId,
        pid: broker.child.pid,
        port: broker.port,
        brokerStatePath: broker.brokerStatePath,
        clusterSummaryPath: state.transport?.clusterControlPath || '',
        schedulerStatePath: state.transport?.schedulerStatePath || '',
        reason,
      });
    }
  }

  async function probeBroker(broker, timeoutMs = 500) {
    try {
      const health = await getJson(`${broker.baseUrl}/health`, timeoutMs);
      controlPlane.heartbeatBroker({ brokerId: broker.brokerId, nodeId: broker.nodeId, lastHealth: 'ok', status: 'ready' });
      if (schedulerBaseUrl) {
        await postJson(`${schedulerBaseUrl}/brokers/heartbeat`, {
          brokerId: broker.brokerId,
          status: 'ready',
          health: 'ok',
        });
      }
      if (eventBus?.emit) {
        eventBus.emit({
          type: 'transport.broker.probed',
          transportKind: 'remote_broker_http',
          brokerId: broker.brokerId,
          nodeId: broker.nodeId,
          port: broker.port,
          brokerStatePath: broker.brokerStatePath,
          clusterSummaryPath: state.transport?.clusterControlPath || '',
          schedulerStatePath: state.transport?.schedulerStatePath || '',
          ok: true,
        });
      }
      await refreshClusterSnapshot();
      await refreshSchedulerSnapshot();
      return { ok: true, health };
    } catch (err) {
      const error = String(err?.message || err || 'probe_failed');
      controlPlane.heartbeatBroker({ brokerId: broker.brokerId, nodeId: broker.nodeId, lastHealth: error, status: 'degraded' });
      if (schedulerBaseUrl) {
        try {
          await postJson(`${schedulerBaseUrl}/brokers/heartbeat`, {
            brokerId: broker.brokerId,
            status: 'degraded',
            health: error,
          });
        } catch {}
      }
      if (eventBus?.emit) {
        eventBus.emit({
          type: 'transport.broker.probed',
          transportKind: 'remote_broker_http',
          brokerId: broker.brokerId,
          nodeId: broker.nodeId,
          port: broker.port,
          brokerStatePath: broker.brokerStatePath,
          clusterSummaryPath: state.transport?.clusterControlPath || '',
          schedulerStatePath: state.transport?.schedulerStatePath || '',
          ok: false,
          error,
        });
        eventBus.emit({
          type: 'transport.broker.unhealthy',
          transportKind: 'remote_broker_http',
          brokerId: broker.brokerId,
          nodeId: broker.nodeId,
          port: broker.port,
          brokerStatePath: broker.brokerStatePath,
          clusterSummaryPath: state.transport?.clusterControlPath || '',
          schedulerStatePath: state.transport?.schedulerStatePath || '',
          error,
        });
      }
      await refreshClusterSnapshot();
      await refreshSchedulerSnapshot().catch(() => null);
      return { ok: false, error };
    }
  }

  async function chooseBrokerForSubmit(request = {}) {
    const meta = request?.context?.workItem?.metadata || {};
    await ensureBrokers();
    let preferredNodeId = String(meta.preferredNodeId || '');
    const placement = controlPlane.selectPlacement({ role: String(request?.role || ''), preferredNodeId });
    if (!preferredNodeId && placement?.nodeId) preferredNodeId = placement.nodeId;

    if (meta.forceBrokerShutdownOnce === true && !state.transport?.failoverInjected) {
      let orderedForShutdown = [];
      if (preferredNodeId) orderedForShutdown.push(...brokersByNode(preferredNodeId));
      orderedForShutdown.push(...activeBrokers().filter((broker) => !orderedForShutdown.includes(broker)));
      orderedForShutdown = rotateBrokers(orderedForShutdown);
      if (orderedForShutdown[0]) {
        const downBroker = orderedForShutdown[0];
        state.transport = { ...(state.transport || {}), failoverInjected: true };
        controlPlane.appendControlEvent('cluster.failover.injected', { brokerId: downBroker.brokerId, nodeId: downBroker.nodeId });
        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.failover.injected',
            transportKind: 'remote_broker_http',
            brokerId: downBroker.brokerId,
            nodeId: downBroker.nodeId,
            brokerStatePath: downBroker.brokerStatePath,
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
          });
        }
        await stopBroker(downBroker, 'failover_injected');
        await ensureBrokers();
      }
    }

    const dispatchRequest = {
      jobId: `job:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      role: String(request?.role || ''),
      preferredNodeId,
      leaseMs: Number(meta.leaseMs || state.transport?.leaseMs || 1200),
      placementHints: normalizedNodes,
      payload: {
        workItemId: String(request?.context?.workItem?.id || ''),
        title: String(request?.context?.workItem?.title || ''),
      },
    };
    const dispatchResponse = await postJson(`${schedulerBaseUrl}/dispatch`, dispatchRequest);
    const dispatch = dispatchResponse?.dispatch || {};

    let ordered = [];
    if (dispatch?.nodeId) ordered.push(...brokersByNode(dispatch.nodeId));
    ordered.push(...activeBrokers().filter((broker) => !ordered.includes(broker)));
    ordered = rotateBrokers(ordered);
    if (dispatch?.brokerId) {
      ordered.sort((a, b) => (a.brokerId === dispatch.brokerId ? -1 : b.brokerId === dispatch.brokerId ? 1 : 0));
    }

    let lastError = 'no_healthy_broker';
    for (const broker of ordered) {
      const probe = await probeBroker(broker, Number(state.transport?.healthProbeTimeoutMs || 600));
      if (probe.ok) {
        return { broker, placement: { ...placement, reason: dispatch?.reason || placement?.reason || '' }, dispatch };
      }
      lastError = probe.error || lastError;
    }
    throw new Error(lastError);
  }

  async function reapOrphanLeases({ graceMs = 0, reason = 'resume_recovery' } = {}) {
    await ensureScheduler();
    const response = await postJson(`${schedulerBaseUrl}/leases/reap-orphans`, { graceMs, reason });
    await refreshSchedulerSnapshot().catch(() => null);
    return Array.isArray(response?.recovered) ? response.recovered : [];
  }

  async function close() {
    const closing = brokers.filter(Boolean);
    brokers = [];
    brokersReadyPromise = null;
    await Promise.all(closing.map(async (broker) => {
      await stopBroker(broker, 'adapter_close');
    }));
    controlPlane.appendControlEvent('cluster.adapter.closed', { brokerCount: closing.length });
    await refreshClusterSnapshot();
    await refreshSchedulerSnapshot().catch(() => null);
    if (schedulerBaseUrl && schedulerServer?.child) {
      try {
        await postJson(`${schedulerBaseUrl}/shutdown`, {});
      } catch {}
      try {
        await new Promise((resolve) => schedulerServer.child.once('close', resolve));
      } catch {}
    }
  }

  async function probeRole(role = '') {
    const { broker, placement, dispatch } = await chooseBrokerForSubmit({ role, context: { workItem: { metadata: {} } } });
    return {
      ok: true,
      provider: 'local-demo-broker-cluster',
      role,
      selectedNode: broker.brokerId,
      selectedClusterNode: broker.nodeId,
      placement,
      dispatch,
      deployment: {
        selectedNode: broker.brokerId,
        executionMode: 'remote_broker_http',
        outwardIdentity: `demo-broker:${role}`,
      },
      sessionCount: 0,
      status: 200,
      error: '',
    };
  }

  async function submitWithFailover({ role = '', request = {} } = {}) {
    const tried = new Set();
    let lastError = 'submit_failed';
    while (tried.size < Math.max(1, Number(brokerCount || 2))) {
      const { broker, placement, dispatch } = await chooseBrokerForSubmit({ ...request, role });
      if (!broker || tried.has(broker.brokerId)) break;
      tried.add(broker.brokerId);
      try {
        const submit = await postJson(`${broker.baseUrl}/jobs`, {
          manifestPath,
          agentPackagePath,
          workerEntryPath,
          paths,
          runId: String(state.runId || ''),
          stateSnapshot: {
            blackboard: state.blackboard || {},
            durableArtifacts: state.durableArtifacts || [],
          },
          dispatch: {
            ...dispatch,
            schedulerLeaseTouchUrl: `${schedulerBaseUrl}/leases/touch`,
            schedulerJobsUpdateUrl: `${schedulerBaseUrl}/jobs/update`,
          },
          request: {
            role,
            ...request,
          },
        });
        controlPlane.updateBrokerJob({
          jobId: String(submit.jobId || dispatch?.jobId || ''),
          role,
          nodeId: broker.nodeId,
          brokerId: broker.brokerId,
          status: 'queued',
          attempt: 0,
          queueKey: `${role}:${Date.now()}`,
          payload: { request, dispatch },
        });
        controlPlane.recordSchedulerDispatch({
          jobId: String(submit.jobId || dispatch?.jobId || ''),
          targetNodeId: broker.nodeId,
          status: 'dispatched',
          payload: { role, brokerId: broker.brokerId, dispatchId: dispatch?.dispatchId || '' },
        });
        await controlPlane.recordPlacement({
          jobId: String(submit.jobId || dispatch?.jobId || ''),
          role,
          nodeId: broker.nodeId,
          brokerId: broker.brokerId,
          reason: String(dispatch?.reason || placement?.reason || 'placement'),
        });
        controlPlane.appendControlEvent('cluster.job.submitted', { jobId: submit.jobId, role, nodeId: broker.nodeId, brokerId: broker.brokerId, dispatchId: dispatch?.dispatchId || '' });
        await refreshClusterSnapshot();
        await refreshSchedulerSnapshot();
        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.job.submitted',
            transportKind: 'remote_broker_http',
            brokerId: broker.brokerId,
            nodeId: broker.nodeId,
            brokerStatePath: broker.brokerStatePath,
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
            schedulerDispatchId: dispatch?.dispatchId || '',
            schedulerLeaseId: dispatch?.leaseId || '',
            jobId: submit.jobId,
            role,
            placementReason: String(dispatch?.reason || placement?.reason || ''),
          });
        }
        return { broker, submit, placement, dispatch };
      } catch (err) {
        lastError = String(err?.message || err || 'submit_failed');
        controlPlane.appendControlEvent('cluster.job.failover', { role, brokerId: broker.brokerId, nodeId: broker.nodeId, error: lastError });
        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.failover',
            transportKind: 'remote_broker_http',
            fromBrokerId: broker.brokerId,
            nodeId: broker.nodeId,
            brokerStatePath: broker.brokerStatePath,
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
            role,
            error: lastError,
          });
        }
        await stopBroker(broker, 'submit_failed');
        await ensureBrokers();
      }
    }
    throw new Error(lastError);
  }

  async function spawnForRole({ role = '', onChunk = null, ...request } = {}) {
    const { broker, submit, dispatch } = await submitWithFailover({ role, request });
    let offset = 0;
    let idlePolls = 0;
    while (true) {
      let poll = null;
      try {
        poll = await getJson(`${broker.baseUrl}/jobs/${encodeURIComponent(submit.jobId)}/poll?offset=${offset}&timeoutMs=1000`, 1500);
      } catch (err) {
        const errorText = String(err?.message || err || 'poll_failed');
        if (errorText === 'poll_timeout') {
          idlePolls += 1;
          if (idlePolls > 10 && eventBus?.emit) {
            eventBus.emit({
              type: 'transport.broker.poll.stalled',
              transportKind: 'remote_broker_http',
              brokerId: broker.brokerId,
              nodeId: broker.nodeId,
              brokerStatePath: broker.brokerStatePath,
              clusterSummaryPath: state.transport?.clusterControlPath || '',
              schedulerStatePath: state.transport?.schedulerStatePath || '',
              jobId: submit.jobId,
              role,
              idlePolls,
            });
          }
          continue;
        }
        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.poll.error',
            transportKind: 'remote_broker_http',
            brokerId: broker.brokerId,
            nodeId: broker.nodeId,
            brokerStatePath: broker.brokerStatePath,
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
            jobId: submit.jobId,
            role,
            error: errorText,
          });
        }
        throw err;
      }
      idlePolls = 0;
      const events = Array.isArray(poll.events) ? poll.events : [];
      offset = Number(poll.nextOffset || offset);
      for (const event of events) {
        if (event?.type === 'stream.chunk' && event.payload && typeof onChunk === 'function') {
          await onChunk(event.payload);
        }
        if (String(event?.type || '').startsWith('transport.job.running')) {
          controlPlane.updateBrokerJob({ jobId: submit.jobId, role, nodeId: broker.nodeId, brokerId: broker.brokerId, status: 'running', attempt: Number(event?.attempt || 0), queueKey: String(event?.queueKey || `${role}:${submit.jobId}`), payload: { request, dispatch } });
        }
        if (eventBus?.emit && String(event?.type || '').startsWith('transport.')) {
          eventBus.emit({ ...event, brokerId: broker.brokerId, nodeId: broker.nodeId, brokerStatePath: broker.brokerStatePath, clusterSummaryPath: state.transport?.clusterControlPath || '', schedulerStatePath: state.transport?.schedulerStatePath || '' });
        }
      }
      await refreshClusterSnapshot();
      await refreshSchedulerSnapshot();

      if (poll.status === 'completed' && poll.result?.run) {
        controlPlane.updateBrokerJob({ jobId: submit.jobId, role, nodeId: broker.nodeId, brokerId: broker.brokerId, status: 'completed', attempt: Number(poll.result?.run?.brokerAttempt || 0), queueKey: `${role}:${submit.jobId}`, payload: { request, dispatch } });
        controlPlane.appendControlEvent('cluster.job.completed', { jobId: submit.jobId, role, nodeId: broker.nodeId, brokerId: broker.brokerId, dispatchId: dispatch?.dispatchId || '' });
        await refreshClusterSnapshot();
        await refreshSchedulerSnapshot();
        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.job.completed',
            transportKind: 'remote_broker_http',
            brokerId: broker.brokerId,
            nodeId: broker.nodeId,
            brokerStatePath: broker.brokerStatePath,
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
            schedulerDispatchId: dispatch?.dispatchId || '',
            schedulerLeaseId: dispatch?.leaseId || '',
            jobId: submit.jobId,
            role,
            pid: poll.result?.run?.workerPid,
          });
        }
        const sessionKey = String(poll.result?.run?.runId || state.runId || submit.jobId || '');
        return {
          ...poll.result.run,
          sessionKey,
          childSessionKey: sessionKey,
          provider: 'local-demo-broker-cluster',
          via: 'remote_broker_http',
          brokerId: broker.brokerId,
          nodeId: broker.nodeId,
          brokerStatePath: broker.brokerStatePath,
          brokerJobId: submit.jobId,
          schedulerDispatchId: dispatch?.dispatchId || '',
          schedulerLeaseId: dispatch?.leaseId || '',
          workerEventLog: Array.isArray(poll.result.eventLog) ? poll.result.eventLog : [],
          workerToolRuns: Array.isArray(poll.result.toolRuns) ? poll.result.toolRuns : [],
        };
      }

      if (poll.status === 'failed') {
        controlPlane.updateBrokerJob({ jobId: submit.jobId, role, nodeId: broker.nodeId, brokerId: broker.brokerId, status: 'failed', attempt: 0, queueKey: `${role}:${submit.jobId}`, payload: { request, dispatch, error: poll.error || 'broker_job_failed' } });
        controlPlane.appendControlEvent('cluster.job.failed', { jobId: submit.jobId, role, nodeId: broker.nodeId, brokerId: broker.brokerId, dispatchId: dispatch?.dispatchId || '', error: poll.error || 'broker_job_failed' });
        await refreshClusterSnapshot();
        await refreshSchedulerSnapshot();
        if (eventBus?.emit) {
          eventBus.emit({
            type: 'transport.broker.job.failed',
            transportKind: 'remote_broker_http',
            brokerId: broker.brokerId,
            nodeId: broker.nodeId,
            brokerStatePath: broker.brokerStatePath,
            clusterSummaryPath: state.transport?.clusterControlPath || '',
            schedulerStatePath: state.transport?.schedulerStatePath || '',
            schedulerDispatchId: dispatch?.dispatchId || '',
            schedulerLeaseId: dispatch?.leaseId || '',
            jobId: submit.jobId,
            role,
            error: poll.error || 'broker_job_failed',
          });
        }
        return {
          ok: false,
          error: poll.error || 'broker_job_failed',
          via: 'remote_broker_http',
          brokerId: broker.brokerId,
          nodeId: broker.nodeId,
          brokerStatePath: broker.brokerStatePath,
          brokerJobId: submit.jobId,
          schedulerDispatchId: dispatch?.dispatchId || '',
          schedulerLeaseId: dispatch?.leaseId || '',
          workerEventLog: [],
          workerToolRuns: [],
        };
      }
    }
  }

  async function sendToSession({ sessionKey = '', text = '', role = 'user', message = '', payload = {}, channel = 'session-bus' } = {}) {
    const normalizedSessionKey = normalizeSessionKey(sessionKey);
    const normalizedText = String(text || message || payload?.text || '');
    if (!normalizedSessionKey) {
      return { ok: false, error: 'session_key_required', via: 'remote_broker_http' };
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
      return { ok: false, error: 'session_bus_unavailable', via: 'remote_broker_http' };
    }
    if (hostLayer?.desk?.enqueueInbox) {
      await hostLayer.desk.enqueueInbox({ sessionKey: normalizedSessionKey, role: entry.role, text: normalizedText, channel: entry.channel });
    }
    if (hostLayer?.persistHostState) {
      await hostLayer.persistHostState({ lastSessionMessageAt: new Date().toISOString() });
    }
    return { ok: true, via: 'remote_broker_http', sessionKey: normalizedSessionKey, entry };
  }

  async function listSessionsForSession({ sessionKey = '', limit = 100 } = {}) {
    if (!backendProvider?.listHostMessages) {
      return { ok: false, error: 'list_unavailable', sessions: [], via: 'remote_broker_http' };
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
    return { ok: true, via: 'remote_broker_http', sessions };
  }

  async function getSessionHistory({ sessionKey = '', limit = 50 } = {}) {
    const normalizedSessionKey = normalizeSessionKey(sessionKey);
    if (!normalizedSessionKey) {
      return { ok: false, error: 'session_key_required', via: 'remote_broker_http' };
    }
    if (!backendProvider?.listHostMessages) {
      return { ok: false, error: 'history_unavailable', via: 'remote_broker_http' };
    }
    const records = await backendProvider.listHostMessages({ direction: 'session', channel: 'session-bus', limit: Math.max(20, Number(limit || 50) * 6) });
    const messages = records
      .filter((record) => pickSessionKey(record) === normalizedSessionKey)
      .map((record) => toHistoryMessage(record))
      .slice(-Math.max(1, Number(limit || 50)));
    return { ok: true, via: 'remote_broker_http', sessionKey: normalizedSessionKey, messages };
  }

  return {
    provider: 'local-demo-broker-cluster',
    kind: 'runtime_adapter',
    transportKind: 'remote_broker_http',
    controlPlane,
    init: ensureControlPlane,
    probeRole,
    spawnForRole,
    reapOrphanLeases,
    sendToSession,
    listSessionsForSession,
    getSessionHistory,
    close,
  };
}

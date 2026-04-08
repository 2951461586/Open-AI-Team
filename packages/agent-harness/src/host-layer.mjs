import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

async function writeText(filePath = '', content = '') {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, String(content || ''), 'utf8');
}

async function appendText(filePath = '', content = '') {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, String(content || ''), 'utf8');
}

async function readJson(filePath = '', fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function createLocalHostLayer({ paths = {}, eventBus = null, backendProvider = null, runId = '' } = {}) {
  const hostLayerStatePath = String(paths.hostLayerStatePath || path.join(paths.deskNotesDir || '.', 'host-layer.json'));
  const hostSchedulerPath = String(paths.hostSchedulerPath || path.join(paths.deskNotesDir || '.', 'scheduler-jobs.json'));
  const hostSessionBusPath = String(paths.hostSessionBusPath || path.join(paths.deskNotesDir || '.', 'session-bus.jsonl'));
  const hostInboxQueuePath = String(paths.hostInboxQueuePath || path.join(paths.deskInboxDir || '.', 'queue.json'));
  const hostOutboxQueuePath = String(paths.hostOutboxQueuePath || path.join(paths.deskOutboxDir || '.', 'queue.json'));
  const hostDispatchLogPath = String(paths.hostDispatchLogPath || path.join(paths.deskNotesDir || '.', 'dispatch-log.json'));

  async function persistHostState(extra = {}) {
    const inbox = await readJson(hostInboxQueuePath, { items: [] });
    const outbox = await readJson(hostOutboxQueuePath, { items: [] });
    const scheduler = await readJson(hostSchedulerPath, { jobs: [] });
    const dispatch = await readJson(hostDispatchLogPath, { dispatches: [] });
    const state = {
      contractVersion: 'agent-harness-host-layer.v1',
      kind: 'host_runtime',
      runId,
      features: {
        sessionBus: true,
        desk: true,
        scheduler: true,
        inbox: true,
        outbox: true,
        dispatch: true,
      },
      counts: {
        inboxPending: Array.isArray(inbox?.items) ? inbox.items.filter((item) => !item.dispatchedAt).length : 0,
        outboxPending: Array.isArray(outbox?.items) ? outbox.items.filter((item) => !item.dispatchedAt).length : 0,
        schedulerJobs: Array.isArray(scheduler?.jobs) ? scheduler.jobs.length : 0,
        dispatches: Array.isArray(dispatch?.dispatches) ? dispatch.dispatches.length : 0,
      },
      paths: {
        hostLayerStatePath,
        hostSchedulerPath,
        hostSessionBusPath,
        hostInboxQueuePath,
        hostOutboxQueuePath,
        hostDispatchLogPath,
      },
      updatedAt: nowIso(),
      ...extra,
    };
    if (backendProvider?.writeJson) {
      await backendProvider.writeJson(hostLayerStatePath, state);
    } else {
      await writeText(hostLayerStatePath, JSON.stringify(state, null, 2));
    }
    return state;
  }

  async function init() {
    await ensureDir(paths.deskInboxDir);
    await ensureDir(paths.deskOutboxDir);
    await ensureDir(paths.deskNotesDir);
    const inboxExisting = await readQueue(hostInboxQueuePath);
    const outboxExisting = await readQueue(hostOutboxQueuePath);
    const schedulerExisting = backendProvider?.readJson ? await backendProvider.readJson(hostSchedulerPath, { jobs: [] }) : await readJson(hostSchedulerPath, { jobs: [] });
    const dispatchExisting = backendProvider?.readJson ? await backendProvider.readJson(hostDispatchLogPath, { dispatches: [] }) : await readJson(hostDispatchLogPath, { dispatches: [] });
    if (backendProvider?.writeJson) {
      await backendProvider.writeJson(hostInboxQueuePath, inboxExisting || { items: [] });
      await backendProvider.writeJson(hostOutboxQueuePath, outboxExisting || { items: [] });
      await backendProvider.writeJson(hostSchedulerPath, schedulerExisting || { jobs: [] });
      await backendProvider.writeJson(hostDispatchLogPath, dispatchExisting || { dispatches: [] });
    } else {
      await writeText(hostInboxQueuePath, JSON.stringify(inboxExisting || { items: [] }, null, 2));
      await writeText(hostOutboxQueuePath, JSON.stringify(outboxExisting || { items: [] }, null, 2));
      await writeText(hostSchedulerPath, JSON.stringify(schedulerExisting || { jobs: [] }, null, 2));
      await writeText(hostDispatchLogPath, JSON.stringify(dispatchExisting || { dispatches: [] }, null, 2));
    }
    try {
      await fs.access(hostSessionBusPath);
    } catch {
      await writeText(hostSessionBusPath, '');
    }
    await persistHostState();
    return {
      hostLayerStatePath,
      hostSchedulerPath,
      hostSessionBusPath,
      hostInboxQueuePath,
      hostOutboxQueuePath,
      hostDispatchLogPath,
    };
  }

  async function appendSessionMessage(message = {}) {
    const entry = { ...message, ts: message.ts || Date.now(), runId };
    await appendText(hostSessionBusPath, `${JSON.stringify(entry)}\n`);
    if (backendProvider?.appendHostMessage) await backendProvider.appendHostMessage({ direction: 'session', channel: 'session-bus', payload: entry });
    eventBus?.emit?.({ type: 'host.session_bus.appended', path: hostSessionBusPath });
    return { ok: true, hostSessionBusPath, entry };
  }

  async function readQueue(queuePath = '') {
    return (backendProvider?.readJson ? await backendProvider.readJson(queuePath, { items: [] }) : await readJson(queuePath, { items: [] })) || { items: [] };
  }

  async function writeQueue(queuePath = '', value = { items: [] }) {
    if (backendProvider?.writeJson) return backendProvider.writeJson(queuePath, value);
    return writeText(queuePath, JSON.stringify(value, null, 2));
  }

  async function enqueueInbox(message = {}) {
    const queue = await readQueue(hostInboxQueuePath);
    const entry = { id: `inbox:${Date.now()}:${queue.items.length + 1}`, payload: message, createdAt: nowIso(), dispatchedAt: '' };
    queue.items.push(entry);
    await writeQueue(hostInboxQueuePath, queue);
    if (backendProvider?.appendHostMessage) await backendProvider.appendHostMessage({ direction: 'inbox', channel: 'desk-inbox', payload: entry });
    eventBus?.emit?.({ type: 'host.inbox.enqueued', path: hostInboxQueuePath, entryId: entry.id });
    await persistHostState();
    return entry;
  }

  async function enqueueOutbox(message = {}) {
    const queue = await readQueue(hostOutboxQueuePath);
    const entry = { id: `outbox:${Date.now()}:${queue.items.length + 1}`, payload: message, createdAt: nowIso(), dispatchedAt: '' };
    queue.items.push(entry);
    await writeQueue(hostOutboxQueuePath, queue);
    if (backendProvider?.appendHostMessage) await backendProvider.appendHostMessage({ direction: 'outbox', channel: 'desk-outbox', payload: entry });
    eventBus?.emit?.({ type: 'host.outbox.enqueued', path: hostOutboxQueuePath, entryId: entry.id });
    await persistHostState();
    return entry;
  }

  async function writeDeskNote(name = 'host-note.md', content = '') {
    const filePath = path.join(paths.deskNotesDir || '.', name);
    await writeText(filePath, content);
    eventBus?.emit?.({ type: 'host.desk.note_written', path: filePath });
    return { ok: true, path: filePath };
  }

  async function listScheduledJobs() {
    const raw = backendProvider?.readJson ? await backendProvider.readJson(hostSchedulerPath, { jobs: [] }) : await readJson(hostSchedulerPath, { jobs: [] });
    return Array.isArray(raw?.jobs) ? raw.jobs : [];
  }

  async function scheduleJob(job = {}) {
    const jobs = await listScheduledJobs();
    const normalized = {
      jobId: String(job?.jobId || job?.id || `job:${Date.now()}`),
      kind: String(job?.kind || 'generic'),
      status: String(job?.status || 'pending'),
      payload: job?.payload || {},
      updatedAt: nowIso(),
    };
    const next = jobs.filter((item) => item.jobId !== normalized.jobId);
    next.push(normalized);
    if (backendProvider?.writeJson) {
      await backendProvider.writeJson(hostSchedulerPath, { jobs: next });
      if (backendProvider.upsertSchedulerJob) await backendProvider.upsertSchedulerJob(normalized);
    } else {
      await writeText(hostSchedulerPath, JSON.stringify({ jobs: next }, null, 2));
    }
    eventBus?.emit?.({ type: 'host.scheduler.upserted', jobId: normalized.jobId, status: normalized.status });
    await persistHostState();
    return normalized;
  }

  async function dispatchPending() {
    const inbox = await readQueue(hostInboxQueuePath);
    const outbox = await readQueue(hostOutboxQueuePath);
    const dispatch = backendProvider?.readJson ? await backendProvider.readJson(hostDispatchLogPath, { dispatches: [] }) : await readJson(hostDispatchLogPath, { dispatches: [] });
    const nextDispatches = Array.isArray(dispatch?.dispatches) ? [...dispatch.dispatches] : [];

    for (const item of inbox.items || []) {
      if (item.dispatchedAt) continue;
      item.dispatchedAt = nowIso();
      nextDispatches.push({ direction: 'inbox', entryId: item.id, dispatchedAt: item.dispatchedAt });
    }
    for (const item of outbox.items || []) {
      if (item.dispatchedAt) continue;
      item.dispatchedAt = nowIso();
      nextDispatches.push({ direction: 'outbox', entryId: item.id, dispatchedAt: item.dispatchedAt });
    }

    await writeQueue(hostInboxQueuePath, inbox);
    await writeQueue(hostOutboxQueuePath, outbox);
    if (backendProvider?.writeJson) {
      await backendProvider.writeJson(hostDispatchLogPath, { dispatches: nextDispatches });
    } else {
      await writeText(hostDispatchLogPath, JSON.stringify({ dispatches: nextDispatches }, null, 2));
    }
    eventBus?.emit?.({ type: 'host.dispatch.completed', dispatchCount: nextDispatches.length, path: hostDispatchLogPath });
    const state = await persistHostState({ lastDispatchAt: nowIso() });
    return { ok: true, dispatchCount: nextDispatches.length, state };
  }

  return {
    kind: 'host_runtime',
    contractVersion: 'agent-harness-host-layer.v1',
    paths: {
      hostLayerStatePath,
      hostSchedulerPath,
      hostSessionBusPath,
      hostInboxQueuePath,
      hostOutboxQueuePath,
      hostDispatchLogPath,
    },
    init,
    sessionBus: {
      kind: 'session_bus',
      appendMessage: appendSessionMessage,
    },
    desk: {
      kind: 'desk_service',
      writeNote: writeDeskNote,
      enqueueInbox,
      enqueueOutbox,
    },
    scheduler: {
      kind: 'host_scheduler',
      listJobs: listScheduledJobs,
      scheduleJob,
    },
    dispatchPending,
    persistHostState,
  };
}

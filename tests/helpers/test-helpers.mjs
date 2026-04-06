import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function makeTempDir(prefix = 'ai-team-harness-test-') {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function withTempDir(fn, prefix = 'ai-team-harness-test-') {
  const dir = await makeTempDir(prefix);
  try {
    return await fn(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

export async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

export function createEventBusStub() {
  const published = [];
  return {
    published,
    emit() {},
    async publish(event) {
      published.push(event);
      return { ok: true, event };
    },
  };
}

export function createInMemoryTeamStore() {
  const teams = new Map();
  const tasks = new Map();
  const mailboxes = [];
  const blackboard = [];
  const evidence = [];
  return {
    teams,
    tasks,
    mailboxes,
    blackboard,
    evidence,
    createTeam(team) { teams.set(team.teamId, structuredClone(team)); return team; },
    createTask(task) { tasks.set(task.taskId, structuredClone(task)); return task; },
    getTaskById(taskId) { return tasks.get(taskId) || null; },
    updateTask(taskId, patch = {}) {
      const current = tasks.get(taskId) || {};
      const next = { ...current, ...patch, metadata: { ...(current.metadata || {}), ...(patch.metadata || {}) } };
      tasks.set(taskId, next);
      return next;
    },
    updateTaskState(taskId, state) {
      const current = tasks.get(taskId) || {};
      const next = { ...current, state, updatedAt: Date.now() };
      tasks.set(taskId, next);
      return next;
    },
    updateTaskMetadata({ taskId, metadata = {} }) {
      const current = tasks.get(taskId) || {};
      const next = { ...current, metadata: { ...(current.metadata || {}), ...metadata } };
      tasks.set(taskId, next);
      return next;
    },
    appendTaskMailbox(entry) { mailboxes.push(structuredClone(entry)); return entry; },
    appendTaskBlackboard(entry) { blackboard.push(structuredClone(entry)); return entry; },
    insertEvidence(item) { evidence.push(structuredClone(item)); return item; },
    listChildTasks(parentTaskId) { return [...tasks.values()].filter((task) => task.parentTaskId === parentTaskId); },
  };
}

export function createNativeChatStub({ reply, streamReply } = {}) {
  return {
    async generateReply() {
      return { ok: true, reply: typeof reply === 'function' ? await reply() : String(reply || '') };
    },
    async generateReplyStream({ onChunk } = {}) {
      const text = typeof streamReply === 'function' ? await streamReply() : String(streamReply || reply || '');
      if (typeof onChunk === 'function') onChunk(text, text);
      return { ok: true, reply: text };
    },
  };
}

export function createIdGenerator(prefixSeed = 'id') {
  let counter = 0;
  return (prefix = prefixSeed) => `${prefix}:${++counter}`;
}

export function assertIncludes(haystack, needle, message = '') {
  assert.equal(String(haystack).includes(String(needle)), true, message || `expected to include ${needle}`);
}

export function exists(filePath) {
  return fs.existsSync(filePath);
}

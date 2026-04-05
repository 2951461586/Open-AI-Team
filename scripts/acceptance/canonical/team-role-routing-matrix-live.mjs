#!/usr/bin/env node
import sqlite3 from 'node:sqlite';
import { loadIndexConfig } from '../../../src/index-env.mjs';
import { loadHostRuntimeConfig, loadLiveEnvToken } from '../../../src/index-host-config.mjs';

const config = loadIndexConfig();
const hostConfig = loadHostRuntimeConfig(config);
const API = `${String(hostConfig?.local?.controlBaseUrl || 'http://127.0.0.1:19090').replace(/\/$/, '')}/api/chat/create`;
const DB = config.TEAM_DB_PATH;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDashboardToken() {
  return loadLiveEnvToken('DASHBOARD_TOKEN', config);
}

async function createTask({ text, source }) {
  const token = loadDashboardToken();
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'x-dashboard-token': token } : {}),
    },
    body: JSON.stringify({
      text,
      scope: 'dashboard',
      metadata: { source, strictTaskMode: true },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function openDb() {
  return new sqlite3.DatabaseSync(DB);
}

function getTaskRow(db, taskId) {
  const row = db.prepare('select task_id, title, state, metadata_json, updated_at from team_tasks where task_id = ?').get(taskId);
  if (!row) return null;
  let metadata = {};
  try { metadata = JSON.parse(row.metadata_json || '{}'); } catch {}
  return {
    taskId: row.task_id,
    title: row.title,
    state: row.state,
    updatedAt: row.updated_at,
    metadata,
  };
}

async function waitForSession(db, taskId, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = getTaskRow(db, taskId);
    const meta = row?.metadata || {};
    const sessionsByRole = meta.sessionsByRole || {};
    const hasSession = Object.values(sessionsByRole).some((info) => String(info?.sessionKey || '').trim());
    if (row && hasSession) return row;
    await sleep(1500);
  }
  return getTaskRow(db, taskId);
}

function findRoleSession(row, role) {
  const meta = row?.metadata || {};
  const info = meta?.sessionsByRole?.[role] || null;
  return {
    requestedNode: String(meta?.requestedNode || ''),
    actualNode: String(meta?.actualNode || ''),
    degradedReason: String(meta?.degradedReason || ''),
    primarySessionKey: String(meta?.primarySessionKey || ''),
    roleSessionKey: String(info?.sessionKey || ''),
    roleRequestedNode: String(info?.requestedNode || ''),
    roleActualNode: String(info?.actualNode || ''),
    assignmentId: String(info?.assignmentId || ''),
    childTaskId: String(info?.childTaskId || ''),
  };
}

async function runCase(db, { name, role, expectedNode, text }) {
  const create = await createTask({ text, source: `role_matrix_${name}` });
  const taskId = String(create?.data?.taskId || '');
  if (!create.ok || !taskId) {
    return {
      name,
      role,
      expectedNode,
      ok: false,
      error: 'task_create_failed',
      create,
    };
  }

  const row = await waitForSession(db, taskId, 90000);
  const route = findRoleSession(row, role);
  const selectedNode = route.roleActualNode || route.actualNode || '';
  const ok = selectedNode === expectedNode;

  return {
    name,
    role,
    expectedNode,
    ok,
    taskId,
    state: row?.state || '',
    requestedNode: route.roleRequestedNode || route.requestedNode,
    actualNode: route.roleActualNode || route.actualNode,
    degradedReason: route.degradedReason,
    sessionKey: route.roleSessionKey || route.primarySessionKey,
    assignmentId: route.assignmentId,
    childTaskId: route.childTaskId,
    replySource: create?.data?.replySource || '',
    action: create?.data?.action || '',
    summary: create?.data?.summary || '',
  };
}

async function main() {
  const db = openDb();
  const startedAt = Date.now();

  const cases = [
    {
      name: 'executor_to_violet',
      role: 'executor',
      expectedNode: 'violet',
      text: '/task 角色矩阵实测 executor：请执行一个最小任务，只输出一句执行结果摘要，不改代码，不写文件。',
    },
    {
      name: 'critic_to_lebang',
      role: 'critic',
      expectedNode: 'lebang',
      text: '/task 角色矩阵实测 critic：请审查这份计划“先做基线，再重启服务，再回验”，只输出一句审查结论。',
    },
    {
      name: 'judge_to_laoda',
      role: 'judge',
      expectedNode: 'laoda',
      text: '/task 角色矩阵实测 judge：请对结论“该任务可以直接放行”做最终裁决，只输出一句裁决结果。',
    },
  ];

  const steps = [];
  let allOk = true;
  for (const item of cases) {
    const out = await runCase(db, item);
    steps.push(out);
    if (!out.ok) allOk = false;
  }

  console.log(JSON.stringify({
    ok: allOk,
    acceptance: 'team-role-routing-matrix-live.v1',
    startedAt,
    finishedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    steps,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});

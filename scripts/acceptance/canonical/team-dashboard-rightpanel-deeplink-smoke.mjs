#!/usr/bin/env node
import fs from 'node:fs';
import { loadIndexConfig } from '../../../src/index-env.mjs';
import { loadLiveEnvToken } from '../../../src/index-host-config.mjs';

const API = 'https://api.liziai.cloud';
const BOARD = 'https://board.liziai.cloud';

function loadDashboardToken() {
  return loadLiveEnvToken('DASHBOARD_TOKEN', loadIndexConfig());
}

async function getTaskId() {
  const token = loadDashboardToken();
  const res = await fetch(`${API}/state/team/dashboard?limit=10`, {
    headers: token ? { Authorization: `Bearer ${token}`, 'x-dashboard-token': token } : {},
  });
  if (!res.ok) throw new Error(`dashboard_http_${res.status}`);
  const data = await res.json().catch(() => ({}));
  const cards = data?.payload?.dashboard?.cards || data?.dashboard?.cards || [];
  const task = cards.find((item) => String(item?.sessionMode || '').trim()) || cards[0];
  const taskId = String(task?.taskId || '').trim();
  if (!taskId) throw new Error('task_not_found');
  return taskId;
}

async function run(cmd) {
  const { execFile } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    execFile('bash', ['-lc', cmd], { maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || stdout || err.message || err)));
      resolve(String(stdout || ''));
    });
  });
}

const taskId = await getTaskId();
const url = `${BOARD}/?view=kanban&taskId=${encodeURIComponent(taskId)}&detailTab=chat`;
await run(`agent-browser open '${url}' >/tmp/team-rp-open.log 2>&1`);
await run(`agent-browser set viewport 1920 1280 >/tmp/team-rp-vp.log 2>&1 || true`);
await run(`agent-browser wait 2500 >/tmp/team-rp-wait.log 2>&1 || true`);
await run(`agent-browser snapshot -i > /tmp/team-rp-snapshot.txt`);
const snap = fs.readFileSync('/tmp/team-rp-snapshot.txt', 'utf8');
const checks = {
  selectedTaskOpened: /现场：/.test(snap) || /现场已打开/.test(snap),
  closeDetail: /关闭详情/.test(snap),
  chatEntry: /对话/.test(snap),
  quickActions: /继续推进/.test(snap) && /请求执行/.test(snap) && /请求复审/.test(snap),
  inputReady: /在这里留言，Enter 发送/.test(snap),
  routeInfoOptional: /路由：/.test(snap) || /会话：/.test(snap) || /节点：/.test(snap),
};
const ok = checks.selectedTaskOpened && checks.closeDetail && checks.chatEntry && checks.quickActions && checks.inputReady;
console.log(JSON.stringify({ ok, taskId, url, checks }, null, 2));
if (!ok) process.exit(1);

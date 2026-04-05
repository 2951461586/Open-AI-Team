/**
 * team-single-flight-mainline-smoke.mjs
 *
 * Verifies P2 single-flight is wired into TL mainline:
 * - same scope + active root task => reuse existing task
 * - no duplicate root task created
 * - mailbox + metadata record single-flight hit/follow-up
 * - terminal root tasks do not block new task creation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-single-flight-'));
const dbPath = path.join(tmpDir, 'team.sqlite');
const configPath = path.join(process.cwd(), 'config', 'team', 'governance.json');
const teamStore = openTeamStore(dbPath);
const governanceRuntime = createGovernanceRuntime(configPath);

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
    passed += 1;
  } else {
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const roleConfig = {
  roles: {
    executor: {
      displayName: '执行者',
      description: '执行任务并返回结构化结果',
      capabilities: ['execute'],
      timeoutMs: 60000,
    },
  },
};

const nativeChat = {
  async generateReply() {
    return {
      ok: true,
      reply: JSON.stringify({
        action: 'delegate',
        summary: '需要执行任务',
        taskMode: 'general',
        riskLevel: 'medium',
        workItems: [
          {
            id: 'w1',
            role: 'executor',
            title: '执行单元任务',
            objective: '完成任务',
            task: '执行并返回结果',
            acceptance: '返回完成确认',
            deliverables: [],
            dependencies: [],
            riskLevel: 'medium',
            needsReview: false,
            needsDecision: false,
            context: '',
          },
        ],
      }),
    };
  },
};

const tlRuntime = createTLRuntime({
  teamStore,
  nativeChat,
  governanceRuntime,
  roleConfig,
  now: (() => {
    let ts = Date.now();
    return () => (ts += 1000);
  })(),
  idgen: ((counters = {}) => (prefix = 'id') => {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return `${prefix}:${counters[prefix]}`;
  })(),
  spawnMemberSession: async () => ({
    reply: JSON.stringify({
      ok: true,
      status: 'completed',
      summary: '执行完成',
      deliverables: [],
      issues: [],
      findings: ['single-flight smoke'],
      needsReplan: false,
      additionalWorkItems: [],
      needsHuman: false,
    }),
  }),
});

const activeTeam = teamStore.createTeam({
  teamId: 'team:active',
  scopeKey: 'dashboard:alpha',
  mode: 'tl_runtime',
  status: 'active',
  metadata: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
const activeTask = teamStore.createTask({
  taskId: 'task:active',
  teamId: activeTeam.teamId,
  title: '进行中的任务',
  description: '老任务',
  state: 'planning',
  metadata: { followupRoute: 'tl' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const reused = await tlRuntime.handleTeamRun({
  text: '继续推进这个 scope 下的新需求',
  scopeKey: 'dashboard:alpha',
  history: [{ role: 'user', content: '上次还没做完' }],
});

assert(reused?.ok === true, 'single-flight 命中成功');
assert(reused?.action === 'tl_single_flight_reuse', '返回复用动作', reused?.action);
assert(reused?.task?.taskId === activeTask.taskId, '复用已有 root task', reused?.task?.taskId);

const alphaTeams = teamStore.listTeamsByScope('dashboard:alpha');
const alphaRootTasks = alphaTeams.flatMap((team) => teamStore.listTasksByTeam(team.teamId)).filter((task) => !task.parentTaskId);
assert(alphaRootTasks.length === 1, '同 scope 未新增重复 root task', String(alphaRootTasks.length));

const mailbox = teamStore.listMailboxMessages({ teamId: activeTeam.teamId, limit: 20 });
assert(mailbox.some((item) => item.kind === 'single_flight.hit'), '记录 single_flight.hit 邮件');
assert(mailbox.some((item) => item.kind === 'single_flight.follow_up'), '记录 single_flight.follow_up 邮件');

const activeTaskAfter = teamStore.getTaskById(activeTask.taskId);
assert(Number(activeTaskAfter?.metadata?.singleFlight?.hitCount || 0) === 1, 'task metadata 记录 hitCount=1');
assert(String(activeTaskAfter?.metadata?.singleFlight?.lastFollowUpText || '').includes('继续推进'), 'task metadata 记录 follow-up 文本');

const terminalTeam = teamStore.createTeam({
  teamId: 'team:done',
  scopeKey: 'dashboard:done',
  mode: 'tl_runtime',
  status: 'done',
  metadata: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
teamStore.createTask({
  taskId: 'task:done',
  teamId: terminalTeam.teamId,
  title: '已完成任务',
  description: 'done task',
  state: 'done',
  metadata: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const created = await tlRuntime.handleTeamRun({
  text: '这个 scope 的新任务应该新建',
  scopeKey: 'dashboard:done',
  history: [],
});

assert(created?.ok === true, 'terminal scope 仍可新建任务');
assert(created?.action === 'tl_delegate', 'terminal scope 走正常新建路径', created?.action);
assert(created?.task?.taskId !== 'task:done', 'done task 不会被复用', created?.task?.taskId || '');

const doneTeams = teamStore.listTeamsByScope('dashboard:done');
const doneRootTasks = doneTeams.flatMap((team) => teamStore.listTasksByTeam(team.teamId)).filter((task) => !task.parentTaskId);
assert(doneRootTasks.length >= 2, 'terminal task 不阻塞新 root task 创建', String(doneRootTasks.length));

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

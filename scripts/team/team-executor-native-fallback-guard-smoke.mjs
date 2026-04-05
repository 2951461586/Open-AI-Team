/**
 * team-executor-native-fallback-guard-smoke.mjs
 *
 * Verifies P3:
 * - executor/planner cannot degrade to nativeChat when real spawn backends are unavailable
 * - critic may still use nativeChat fallback under governance degradation policy
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-native-fallback-guard-'));
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
    executor: { displayName: '执行者', description: '真实执行', capabilities: ['execute'] },
    critic: { displayName: '审查官', description: '评审', capabilities: ['review'] },
  },
};

const nativeChat = {
  async generateReply({ text = '' } = {}) {
    if (String(text).includes('审查')) {
      return {
        ok: true,
        reply: JSON.stringify({
          ok: true,
          status: 'completed',
          summary: 'critic fallback worked',
          issues: [],
          findings: ['critic via native chat'],
          needsHuman: false,
        }),
      };
    }

    return {
      ok: true,
      reply: JSON.stringify({
        action: 'delegate',
        summary: 'executor task',
        taskMode: 'general',
        riskLevel: 'medium',
        workItems: [
          {
            id: 'w1',
            role: 'executor',
            title: '执行任务',
            objective: '执行任务',
            task: '执行任务',
            acceptance: '完成执行',
            deliverables: [],
            dependencies: [],
            riskLevel: 'medium',
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
});

const executorTask = await tlRuntime.handleTeamRun({
  text: '请执行这个真实任务',
  scopeKey: 'dashboard:p3',
  history: [],
});

assert(executorTask?.ok === true, 'executor task run returns structured result');
assert(executorTask?.action === 'tl_delegate', 'executor task still走 TL delegate', executorTask?.action);
assert(String(executorTask?.task?.state || '') !== 'done', 'executor task does not fake-success to done', executorTask?.task?.state || '');
assert((executorTask?.memberResults || []).some((item) => item.role === 'executor' && item.ok === false), 'executor memberResult marked failed');
assert((executorTask?.memberResults || []).some((item) => item.role === 'executor' && item.via === 'native_chat_blocked'), 'executor nativeChat fallback is blocked');
assert(!(executorTask?.memberResults || []).some((item) => item.role === 'executor' && item.via === 'native_chat_fallback'), 'executor does not use native_chat_fallback');
const executorResult = (executorTask?.memberResults || []).find((item) => item.role === 'executor');
const executorChildTask = executorResult?.childTaskId ? teamStore.getTaskById(executorResult.childTaskId) : null;
assert(executorChildTask?.state === 'blocked', 'executor child task is blocked', executorChildTask?.state || '');

const criticTeam = teamStore.createTeam({
  teamId: 'team:critic',
  scopeKey: 'dashboard:p3:critic',
  mode: 'tl_runtime',
  status: 'active',
  metadata: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
const parentTask = teamStore.createTask({
  taskId: 'task:critic-parent',
  teamId: criticTeam.teamId,
  title: '父任务',
  description: '需要 critic',
  state: 'planning',
  metadata: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
const childTask = teamStore.createTask({
  taskId: 'task:critic-child',
  teamId: criticTeam.teamId,
  parentTaskId: parentTask.taskId,
  title: 'critic child',
  description: '审查子任务',
  state: 'approved',
  metadata: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const criticResult = await tlRuntime._runMemberWithSession({
  role: 'critic',
  task: '请审查这个结果',
  objective: '做 review',
  acceptance: '给出结论',
  deliverables: [],
  assignmentId: 'w1:critic',
  teamId: criticTeam.teamId,
  parentTask,
  childTask,
  scopeKey: 'dashboard:p3:critic',
  context: '',
  timeoutMs: 2000,
  workItem: { id: 'w1:critic', role: 'critic', title: '审查任务' },
});

assert(criticResult?.ok === true, 'critic may still fallback to native chat');
assert(criticResult?.via === 'native_chat_fallback', 'critic uses native_chat_fallback', criticResult?.via || '');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

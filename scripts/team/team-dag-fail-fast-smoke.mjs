/**
 * team-dag-fail-fast-smoke.mjs
 *
 * Verifies P4:
 * - invalid plan DAG fails fast before child task creation / execution
 * - invalid dynamic DAG fails fast before dynamic tasks are created or executed
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { validateExecutionDag } from '../../src/team/team-parallel-executor.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-dag-fail-fast-'));
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
    judge: { displayName: '裁决官', description: '裁决', capabilities: ['judge'] },
  },
};

const baseNow = (() => {
  let ts = Date.now();
  return () => (ts += 1000);
})();
const baseId = ((counters = {}) => (prefix = 'id') => {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}:${counters[prefix]}`;
})();

const directValidation = validateExecutionDag([
  { id: 'w1', dependsOn: ['ghost'] },
  { id: 'w2', dependsOn: ['w1'] },
]);
assert(directValidation.ok === false, 'validator rejects missing dependency');
assert(directValidation.errors.some((err) => err.code === 'missing_dependency'), 'validator reports missing_dependency');

const invalidPlanNativeChat = {
  async generateReply() {
    return {
      ok: true,
      reply: JSON.stringify({
        action: 'delegate',
        summary: 'bad dag plan',
        taskMode: 'general',
        riskLevel: 'low',
        workItems: [
          {
            id: 'w1',
            role: 'executor',
            title: '先执行',
            objective: '执行 1',
            task: '执行 1',
            acceptance: '完成',
            deliverables: [],
            dependencies: ['ghost'],
            riskLevel: 'low',
          },
        ],
      }),
    };
  },
};

const invalidPlanRuntime = createTLRuntime({
  teamStore,
  nativeChat: invalidPlanNativeChat,
  governanceRuntime,
  roleConfig,
  now: baseNow,
  idgen: baseId,
});

const invalidPlanResult = await invalidPlanRuntime.handleTeamRun({
  text: '执行一个坏 DAG 计划',
  scopeKey: 'dashboard:p4:plan',
  history: [],
});

const invalidPlanTasks = teamStore.listTasksByTeam(invalidPlanResult.teamId || '');
assert(invalidPlanResult.ok === true, 'invalid plan returns structured TL result');
assert(invalidPlanResult.task?.state === 'blocked', 'invalid plan root task blocked', invalidPlanResult.task?.state || '');
assert((invalidPlanResult.childTasks || []).length === 0, 'invalid plan creates zero child tasks');
assert(invalidPlanTasks.length === 1, 'invalid plan team only has root task', String(invalidPlanTasks.length));
assert(String(invalidPlanResult.reply || '').includes('规划 DAG 依赖异常'), 'invalid plan reply includes DAG fail-fast summary');
assert(String(invalidPlanResult.error || '') === 'invalid_dag', 'invalid plan returns invalid_dag', invalidPlanResult.error || '');

const dynamicNativeChat = {
  async generateReply() {
    return {
      ok: true,
      reply: JSON.stringify({
        action: 'delegate',
        summary: 'valid root plan with later bad replan',
        taskMode: 'general',
        riskLevel: 'low',
        workItems: [
          {
            id: 'w1',
            role: 'executor',
            title: '初始执行',
            objective: '执行初始任务',
            task: '执行初始任务',
            acceptance: '完成',
            deliverables: [],
            dependencies: [],
            riskLevel: 'low',
          },
        ],
      }),
    };
  },
};

const dynamicRuntime = createTLRuntime({
  teamStore,
  nativeChat: dynamicNativeChat,
  governanceRuntime,
  roleConfig,
  now: baseNow,
  idgen: baseId,
  spawnMemberSession: async ({ role }) => {
    if (role !== 'executor') throw new Error(`unexpected role ${role}`);
    return {
      reply: JSON.stringify({
        ok: true,
        status: 'completed',
        summary: 'executor done and proposed invalid dynamic step',
        deliverables: ['artifact.txt'],
        additionalWorkItems: [
          {
            id: 'dyn:bad:1',
            role: 'executor',
            title: '坏的动态任务',
            objective: '引用不存在依赖',
            task: '执行坏动态任务',
            acceptance: '完成',
            deliverables: [],
            dependencies: ['ghost:dynamic'],
            riskLevel: 'low',
          },
        ],
      }),
    };
  },
});

const dynamicResult = await dynamicRuntime.handleTeamRun({
  text: '执行一个会提出坏动态 DAG 的任务',
  scopeKey: 'dashboard:p4:dynamic',
  history: [],
});

const dynamicTasks = teamStore.listTasksByTeam(dynamicResult.teamId || '');
const dynamicTaskTitles = dynamicTasks.map((task) => task.title || '');
assert(dynamicResult.ok === true, 'dynamic invalid DAG returns structured TL result');
assert(dynamicResult.task?.state === 'blocked', 'dynamic invalid DAG root task blocked', dynamicResult.task?.state || '');
assert((dynamicResult.memberResults || []).some((item) => item.assignmentId === 'w1' && item.ok === true), 'initial executor result preserved before fail-fast');
assert(String(dynamicResult.reply || '').includes('动态追加 DAG 依赖异常'), 'dynamic invalid DAG reply includes fail-fast summary');
assert(!dynamicTaskTitles.includes('坏的动态任务'), 'invalid dynamic tasks are not created');
assert(String(dynamicResult.task?.state || '') === 'blocked', 'dynamic invalid DAG stops further execution', dynamicResult.task?.state || '');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

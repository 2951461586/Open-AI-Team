import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import {
  getRoleCapabilityContract,
  validateWorkItemCapabilityContract,
} from '../../src/team/team-role-capability-contracts.mjs';

let passed = 0;
let failed = 0;
function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const roleConfig = {
  roles: {
    planner: {
      displayName: '规划师',
      capabilities: ['planning', 'decomposition', 'task-design'],
      contract: { version: 'planner.plan.v2', outputType: 'team.plan.v2' },
      timeoutMs: 5000,
    },
    critic: {
      displayName: '审查官',
      capabilities: ['review', 'risk-analysis', 'consistency-check'],
      contract: { version: 'critic.review.v2', outputType: 'team.review.v2' },
      timeoutMs: 5000,
    },
    executor: {
      displayName: '执行者',
      capabilities: ['execution', 'implementation', 'drafting'],
      contract: { version: 'executor.result.v1', outputType: 'team.executor.result.v1' },
      timeoutMs: 5000,
    },
  },
};

const plannerContract = getRoleCapabilityContract('planner', roleConfig);
assert(plannerContract?.contractVersion === 'planner.plan.v2', 'planner contract loaded');
assert(plannerContract?.capabilities?.includes('planning'), 'planner capability loaded');

const mismatch = validateWorkItemCapabilityContract({
  role: 'critic',
  title: 'critic wrongly asked to implement',
  requiredCapabilities: ['implementation'],
  expectedContractVersion: 'critic.review.v2',
  expectedOutputType: 'team.review.v2',
}, roleConfig);
assert(mismatch.ok === false, 'critic implementation mismatch rejected');
assert((mismatch.errors || []).some((err) => err.code === 'role_capability_mismatch'), 'mismatch error code emitted');

const governanceRuntime = createGovernanceRuntime();

function makeRuntime({ nativeChatReply, spawnReply }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p7-capability-'));
  const teamStore = openTeamStore(path.join(tmpDir, 'team.sqlite'));
  const nativeChat = {
    async generateReply() {
      return { ok: true, reply: JSON.stringify(nativeChatReply) };
    },
  };
  const tlRuntime = createTLRuntime({
    teamStore,
    nativeChat,
    governanceRuntime,
    roleConfig,
    spawnMemberSession: async ({ role }) => ({
      ok: true,
      reply: JSON.stringify(spawnReply?.[role] || {
        ok: true,
        status: 'completed',
        summary: `${role} done`,
        deliverables: [],
        issues: [],
        findings: [],
        needsReplan: false,
        additionalWorkItems: [],
        needsHuman: false,
      }),
    }),
  });
  return { tlRuntime, teamStore };
}

// case 1: plan-stage capability contract fail-fast
{
  const { tlRuntime } = makeRuntime({
    nativeChatReply: {
      action: 'delegate',
      summary: 'bad role assignment',
      taskMode: 'general',
      riskLevel: 'medium',
      workItems: [
        {
          id: 'w1',
          role: 'critic',
          title: '让 critic 直接实现功能',
          objective: '错误角色',
          task: '去实现功能',
          acceptance: '功能完成',
          requiredCapabilities: ['implementation'],
          expectedContractVersion: 'critic.review.v2',
          expectedOutputType: 'team.review.v2',
          dependencies: [],
        },
      ],
    },
    spawnReply: {},
  });

  const result = await tlRuntime.handleTeamRun({ text: 'P7 plan fail-fast', scopeKey: 'p7:plan', history: [] });
  assert(result.ok === true, 'plan fail-fast returns handled response');
  assert(result.error === 'role_capability_contract_invalid', 'plan fail-fast error code');
  assert(String(result.reply || '').includes('role_capability_mismatch'), 'plan fail-fast summary includes mismatch');
  assert((result.memberResults || []).length === 0, 'plan fail-fast blocks before member run');
  assert(result.task?.state === 'blocked', 'plan fail-fast blocks task', result.task?.state || '');
}

// case 2: dynamic replan-stage capability contract fail-fast
{
  const { tlRuntime } = makeRuntime({
    nativeChatReply: {
      action: 'delegate',
      summary: 'valid executor then bad dynamic critic step',
      taskMode: 'general',
      riskLevel: 'medium',
      workItems: [
        {
          id: 'w1',
          role: 'executor',
          title: '先执行主任务',
          objective: '主任务',
          task: '执行',
          acceptance: '完成',
          requiredCapabilities: ['execution'],
          expectedContractVersion: 'executor.result.v1',
          expectedOutputType: 'team.executor.result.v1',
          dependencies: [],
        },
      ],
    },
    spawnReply: {
      executor: {
        ok: true,
        status: 'completed',
        summary: 'executor finished but proposed invalid critic implementation task',
        deliverables: [],
        issues: [],
        findings: [],
        needsReplan: false,
        additionalWorkItems: [
          {
            role: 'critic',
            title: '错误追加：critic 实现代码',
            objective: 'critic 不该实现代码',
            task: '请直接实现功能',
            acceptance: '功能完成',
            requiredCapabilities: ['implementation'],
            expectedContractVersion: 'critic.review.v2',
            expectedOutputType: 'team.review.v2',
            dependencies: ['w1'],
            riskLevel: 'medium',
          },
        ],
        needsHuman: false,
      },
    },
  });

  const result = await tlRuntime.handleTeamRun({ text: 'P7 dynamic fail-fast', scopeKey: 'p7:dynamic', history: [] });
  assert(result.ok === true, 'dynamic fail-fast returns handled response');
  assert(String(result.reply || '').includes('动态追加角色能力合同异常'), 'dynamic fail-fast summary title');
  assert(String(result.reply || '').includes('role_capability_mismatch'), 'dynamic fail-fast mismatch code present');
  assert(result.task?.state === 'blocked', 'dynamic fail-fast blocks task', result.task?.state || '');
}

console.log(`RESULT ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

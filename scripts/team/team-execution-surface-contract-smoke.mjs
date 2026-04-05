import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import {
  getRoleExecutionSurfaceContract,
  validateWorkItemExecutionSurfaceContract,
} from '../../src/team/team-role-capability-contracts.mjs';
import { tryHandleHealthStateRoute } from '../../src/routes/index-routes-health-state.mjs';

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
      executionSurface: {
        skills: ['file-search'],
        tools: ['read', 'web_fetch'],
        mcpServers: [],
      },
      timeoutMs: 5000,
    },
    executor: {
      displayName: '执行者',
      capabilities: ['execution', 'implementation', 'drafting'],
      contract: { version: 'executor.result.v1', outputType: 'team.executor.result.v1' },
      executionSurface: {
        skills: ['file-search', 'git-essentials'],
        tools: ['read', 'write', 'edit', 'exec'],
        mcpServers: ['filesystem'],
      },
      timeoutMs: 5000,
    },
    critic: {
      displayName: '审查官',
      capabilities: ['review', 'risk-analysis', 'consistency-check'],
      contract: { version: 'critic.review.v2', outputType: 'team.review.v2' },
      executionSurface: {
        skills: ['code-review'],
        tools: ['read'],
        mcpServers: [],
      },
      timeoutMs: 5000,
    },
  },
};

const surface = getRoleExecutionSurfaceContract('executor', roleConfig);
assert(surface?.tools?.includes('edit'), 'executor execution surface loaded');
assert(surface?.mcpServers?.includes('filesystem'), 'executor MCP surface loaded');

const mismatch = validateWorkItemExecutionSurfaceContract({
  role: 'critic',
  title: 'critic wrongly asked to edit files',
  requiredTools: ['edit'],
}, roleConfig);
assert(mismatch.ok === false, 'critic edit-tool mismatch rejected');
assert((mismatch.errors || []).some((err) => err.code === 'role_tool_surface_mismatch'), 'tool mismatch error code emitted');

const governanceRuntime = createGovernanceRuntime();

function makeRes() {
  const state = { statusCode: 0, headers: {}, body: '' };
  return {
    state,
    writeHead(code, headers = {}) { state.statusCode = code; state.headers = headers; },
    end(body = '') { state.body = String(body || ''); },
    setHeader(name, value) { state.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return state.headers[String(name).toLowerCase()]; },
  };
}

function requestJson(route, teamStore, taskId) {
  const req = {
    method: 'GET',
    url: `${route}?taskId=${encodeURIComponent(taskId)}`,
    headers: { authorization: 'Bearer test-dashboard' },
  };
  const res = makeRes();
  const sendJson = (targetRes, code, payload) => {
    targetRes.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    targetRes.end(JSON.stringify(payload));
  };
  const handled = tryHandleHealthStateRoute(req, res, {
    teamStore,
    sendJson,
    isDashboardAuthorized: (incomingReq) => String(incomingReq?.headers?.authorization || '') === 'Bearer test-dashboard',
  });
  return { handled, json: JSON.parse(res.state.body || '{}'), state: res.state };
}

function makeRuntime({ nativeChatReply, spawnReplyByRole = {}, capturePrompts = false }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p9-surface-'));
  const teamStore = openTeamStore(path.join(tmpDir, 'team.sqlite'));
  const prompts = [];
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
    spawnMemberSession: async ({ role, task }) => {
      if (capturePrompts) prompts.push(String(task || ''));
      return {
        ok: true,
        reply: JSON.stringify(spawnReplyByRole?.[role] || {
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
      };
    },
  });
  return { tlRuntime, teamStore, prompts };
}

// case 1: plan-stage execution surface fail-fast
{
  const { tlRuntime } = makeRuntime({
    nativeChatReply: {
      action: 'delegate',
      summary: 'bad tool assignment',
      taskMode: 'general',
      riskLevel: 'medium',
      workItems: [
        {
          id: 'w1',
          role: 'critic',
          title: '让 critic 改代码',
          objective: '错误工具面',
          task: '请直接修改文件',
          acceptance: '改完',
          requiredCapabilities: ['review'],
          requiredTools: ['edit'],
          expectedContractVersion: 'critic.review.v2',
          expectedOutputType: 'team.review.v2',
          dependencies: [],
        },
      ],
    },
  });

  const result = await tlRuntime.handleTeamRun({ text: 'P9 plan fail-fast', scopeKey: 'p9:plan', history: [] });
  assert(result.ok === true, 'plan execution-surface fail-fast handled');
  assert(result.error === 'role_execution_surface_contract_invalid', 'plan execution-surface error code');
  assert(String(result.reply || '').includes('role_tool_surface_mismatch'), 'plan execution-surface summary includes mismatch');
  assert(result.task?.state === 'blocked', 'plan execution-surface blocks task', result.task?.state || '');
}

// case 2: member prompt carries execution surface section and route exposes child task surface
{
  const { tlRuntime, teamStore, prompts } = makeRuntime({
    capturePrompts: true,
    nativeChatReply: {
      action: 'delegate',
      summary: 'valid executor run',
      taskMode: 'general',
      riskLevel: 'medium',
      workItems: [
        {
          id: 'w1',
          role: 'executor',
          title: '实现功能',
          objective: '主任务',
          task: '执行功能实现',
          acceptance: '功能完成',
          requiredCapabilities: ['execution'],
          requiredSkills: ['file-search'],
          requiredTools: ['edit', 'exec'],
          requiredMcpServers: ['filesystem'],
          expectedContractVersion: 'executor.result.v1',
          expectedOutputType: 'team.executor.result.v1',
          dependencies: [],
        },
      ],
    },
  });

  const result = await tlRuntime.handleTeamRun({ text: 'P9 success path', scopeKey: 'p9:success', history: [] });
  assert(result.ok === true, 'valid execution-surface task handled');
  assert(prompts.some((text) => text.includes('## Skill / Tool / MCP 执行面')), 'member prompt includes execution surface section');
  assert(prompts.some((text) => text.includes('requiredTools：edit、exec')), 'member prompt includes required tools');
  assert(prompts.some((text) => text.includes('requiredMcpServers：filesystem')), 'member prompt includes required MCP servers');

  const taskId = String(result.taskId || result.task?.taskId || '');
  const pipeline = requestJson('/state/team/pipeline', teamStore, taskId);
  assert(pipeline.handled === true, 'pipeline route handled');
  assert(pipeline.state.statusCode === 200, 'pipeline route ok');
  assert(Array.isArray(pipeline.json.childTasks) && pipeline.json.childTasks.length >= 1, 'pipeline exposes childTasks');
  const pipelineExecutorChild = (pipeline.json.childTasks || []).find((item) => String(item?.role || '') === 'executor') || null;
  assert((pipelineExecutorChild?.executionSurface?.requiredTools || []).includes('edit'), 'pipeline exposes child task required tools');
  assert((pipelineExecutorChild?.executionSurface?.requiredMcpServers || []).includes('filesystem'), 'pipeline exposes child task required MCP');
  assert(Number(pipeline.json.executionSurface?.toolBoundCount || 0) >= 1, 'pipeline exposes tool-bound summary');

  const workbench = requestJson('/state/team/workbench', teamStore, taskId);
  assert(workbench.handled === true, 'workbench route handled');
  assert(workbench.state.statusCode === 200, 'workbench route ok');
  assert(Array.isArray(workbench.json.board?.childTasks) && workbench.json.board.childTasks.length >= 1, 'workbench exposes board childTasks');
  const workbenchExecutorChild = (workbench.json.board?.childTasks || []).find((item) => String(item?.role || '') === 'executor') || null;
  assert((workbenchExecutorChild?.executionSurface?.requiredSkills || []).includes('file-search'), 'workbench exposes child skill surface');
  assert(Number(workbench.json.summary?.executionSurface?.childTaskCount || 0) >= 1, 'workbench summary exposes execution-surface summary');
}

// case 3: dynamic replan execution surface fail-fast
{
  const { tlRuntime } = makeRuntime({
    nativeChatReply: {
      action: 'delegate',
      summary: 'valid executor then bad dynamic tool request',
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
          requiredSkills: ['file-search'],
          requiredTools: ['edit'],
          expectedContractVersion: 'executor.result.v1',
          expectedOutputType: 'team.executor.result.v1',
          dependencies: [],
        },
      ],
    },
    spawnReplyByRole: {
      executor: {
        ok: true,
        status: 'completed',
        summary: 'executor finished but proposed invalid critic tool task',
        deliverables: [],
        issues: [],
        findings: [],
        needsReplan: false,
        additionalWorkItems: [
          {
            role: 'critic',
            title: '错误追加：critic 调 exec',
            objective: 'critic 不该跑 exec',
            task: '请执行命令修复环境',
            acceptance: '命令执行完',
            requiredCapabilities: ['review'],
            requiredTools: ['exec'],
            dependencies: ['w1'],
            riskLevel: 'medium',
          },
        ],
        needsHuman: false,
      },
    },
  });

  const result = await tlRuntime.handleTeamRun({ text: 'P9 dynamic fail-fast', scopeKey: 'p9:dynamic', history: [] });
  assert(result.ok === true, 'dynamic execution-surface fail-fast handled');
  assert(String(result.reply || '').includes('动态追加 Skill / Tool / MCP 执行面合同异常'), 'dynamic execution-surface summary title');
  assert(String(result.reply || '').includes('role_tool_surface_mismatch'), 'dynamic execution-surface mismatch code');
  assert(result.task?.state === 'blocked', 'dynamic execution-surface blocks task', result.task?.state || '');
}

console.log(`RESULT ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

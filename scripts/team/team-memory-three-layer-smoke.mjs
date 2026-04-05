import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
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
        tools: ['read'],
        mcpServers: [],
      },
      timeoutMs: 5000,
    },
  },
};

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p10-memory-'));
const teamStore = openTeamStore(path.join(tmpDir, 'team.sqlite'));
const governanceRuntime = createGovernanceRuntime();
const prompts = [];

const tlRuntime = createTLRuntime({
  teamStore,
  governanceRuntime,
  roleConfig,
  nativeChat: {
    async generateReply() {
      return {
        ok: true,
        reply: JSON.stringify({
          action: 'delegate',
          summary: 'three layer memory run',
          taskMode: 'general',
          riskLevel: 'low',
          workItems: [
            {
              id: 'w1',
              role: 'planner',
              title: '整理初始信息',
              objective: '完成第一层输入整理',
              task: '读取上下文并输出初始整理结果',
              acceptance: '给出结构化整理',
              requiredCapabilities: ['planning'],
              requiredSkills: ['file-search'],
              expectedContractVersion: 'planner.plan.v2',
              expectedOutputType: 'team.plan.v2',
              dependencies: [],
              context: '用户要求把 memory 分成三层。',
            },
            {
              id: 'w2',
              role: 'planner',
              title: '基于上游整理给出 memory 分层方案',
              objective: '完成三层 memory 方案',
              task: '结合上游结果整理成三层 memory 方案',
              acceptance: '输出三层 memory 结构',
              requiredCapabilities: ['planning'],
              requiredSkills: ['file-search'],
              expectedContractVersion: 'planner.plan.v2',
              expectedOutputType: 'team.plan.v2',
              dependencies: ['w1'],
            },
          ],
        }),
      };
    },
  },
  spawnMemberSession: async ({ role, task }) => {
    prompts.push(String(task || ''));
    return {
      ok: true,
      reply: JSON.stringify({
        ok: true,
        status: 'completed',
        summary: `${role} completed memory layer work`,
        deliverables: [{ title: 'memory-layer-note.md', path: 'memory-layer-note.md', type: 'file' }],
        issues: [],
        findings: ['memory 分层完成', '共享黑板已可作为 L2'],
        needsReplan: false,
        additionalWorkItems: [],
        needsHuman: false,
      }),
    };
  },
});

const result = await tlRuntime.handleTeamRun({ text: 'P10 memory three layers', scopeKey: 'p10:memory', history: [] });
assert(result.ok === true, 'P10 runtime handled');
assert(prompts.length >= 2, 'captured member prompts');
assert(prompts.some((text) => text.includes('## 🧠 三层 Memory 视图')), 'member prompt includes memory overview');
assert(prompts.some((text) => text.includes('## ⚡ L1 即时工作记忆')), 'member prompt includes L1 working memory');
assert(prompts.some((text) => text.includes('## 📋 L2 任务共享记忆')), 'member prompt includes L2 shared memory');
assert(prompts.some((text) => text.includes('## 🗂️ L3 持久证据记忆')), 'member prompt includes L3 durable memory');

const taskId = String(result.taskId || result.task?.taskId || '');
assert(!!taskId, 'taskId returned');

const pipeline = requestJson('/state/team/pipeline', teamStore, taskId);
assert(pipeline.handled === true, 'pipeline route handled');
assert(pipeline.state.statusCode === 200, 'pipeline route ok');
assert(Number(pipeline.json.memoryLayers?.layerCount || 0) === 3, 'pipeline exposes three memory layers');
assert(Number(pipeline.json.memoryLayers?.working?.dependencyBoundCount || 0) >= 1, 'pipeline exposes L1 dependency binding');
assert(Number(pipeline.json.memoryLayers?.shared?.entryCount || 0) >= 1, 'pipeline exposes L2 blackboard entries');
assert(Number(pipeline.json.memoryLayers?.durable?.artifactCount || 0) >= 1, 'pipeline exposes L3 artifacts');

const workbench = requestJson('/state/team/workbench', teamStore, taskId);
assert(workbench.handled === true, 'workbench route handled');
assert(workbench.state.statusCode === 200, 'workbench route ok');
assert(Number(workbench.json.summary?.memoryLayers?.layerCount || 0) === 3, 'workbench summary exposes three memory layers');
assert(Number(workbench.json.board?.memoryLayers?.shared?.entryCount || 0) >= 1, 'workbench board exposes L2 shared memory');
assert(Number(workbench.json.summary?.memoryLayers?.durable?.artifactCount || 0) >= 1, 'workbench summary exposes L3 durable memory');

const summary = requestJson('/state/team/summary', teamStore, taskId);
assert(summary.handled === true, 'summary route handled');
assert(summary.state.statusCode === 200, 'summary route ok');
assert(Number(summary.json.memoryLayers?.layerCount || 0) === 3, 'summary route exposes three memory layers');
assert(Number(summary.json.memoryLayers?.working?.dependencyBoundCount || 0) >= 1, 'summary route exposes L1 dependency binding');

console.log(`memory three-layer summary ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);

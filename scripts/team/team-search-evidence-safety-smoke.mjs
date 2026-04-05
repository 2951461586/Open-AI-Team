import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';

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
    executor: {
      displayName: '执行者',
      capabilities: ['execution'],
      contract: { version: 'executor.result.v1', outputType: 'team.executor.result.v1' },
      executionSurface: {
        skills: ['file-search'],
        tools: ['exec', 'read', 'write'],
        mcpServers: [],
      },
      timeoutMs: 5000,
    },
  },
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p15-search-safety-'));
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
          summary: 'search evidence safety run',
          taskMode: 'analysis',
          riskLevel: 'medium',
          workItems: [
            {
              id: 'w1',
              role: 'executor',
              title: '做全仓搜索并整理证据',
              objective: '生成搜索证据',
              task: '扫描 orchestrator 并输出搜索证据文件',
              acceptance: '给出可复核的搜索证据',
              requiredCapabilities: ['execution'],
              requiredSkills: ['file-search'],
              requiredTools: ['exec', 'write'],
              expectedContractVersion: 'executor.result.v1',
              expectedOutputType: 'team.executor.result.v1',
              dependencies: [],
            },
          ],
        }),
      };
    },
  },
  spawnMemberSession: async ({ task }) => {
    prompts.push(String(task || ''));
    return {
      ok: true,
      reply: JSON.stringify({
        ok: true,
        status: 'completed',
        summary: 'search evidence guard acknowledged',
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

const result = await tlRuntime.handleTeamRun({ text: 'P15 search evidence safety', scopeKey: 'p15:search-safety', history: [] });
assert(result.ok === true, 'search evidence safety runtime handled');
assert(prompts.length >= 1, 'captured member prompt');
assert(prompts.some((text) => text.includes('## 搜索留证安全护栏（强制）')), 'member prompt includes search evidence safety section');
assert(prompts.some((text) => text.includes('不要边扫描边把结果写回扫描根里的文件')), 'member prompt warns against self-referential scan output');
assert(prompts.some((text) => text.includes("--glob '!artifacts/**'")), 'member prompt includes artifact exclusion example');
assert(prompts.some((text) => text.includes('/tmp/agent-harness-evidence/')), 'member prompt recommends scratch path outside scan root');

console.log(`search evidence safety summary ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);

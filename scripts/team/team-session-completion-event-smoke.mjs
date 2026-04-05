import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { createSessionCompletionBus } from '../../src/team/team-session-completion-bus.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p6-event-'));
const dbPath = path.join(tmpDir, 'team.sqlite');
const workdir = path.join(tmpDir, 'task_workspaces');
fs.mkdirSync(workdir, { recursive: true });

const teamStore = openTeamStore(dbPath);
const governanceRuntime = createGovernanceRuntime(path.join(process.cwd(), 'config', 'team', 'governance.json'));
const sessionCompletionBus = createSessionCompletionBus();

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

let listCalls = 0;
let historyCalls = 0;
let completionPublishCount = 0;

const nativeChat = {
  async generateReply() {
    return {
      ok: true,
      reply: JSON.stringify({
        action: 'delegate',
        summary: 'event completion smoke',
        taskMode: 'general',
        riskLevel: 'low',
        workItems: [
          {
            id: 'w1',
            role: 'planner',
            title: '事件驱动 completion',
            objective: '验证 completion 改为事件驱动',
            task: '直接完成并回推 completion 文件',
            acceptance: 'TL 通过 completion 事件收结果',
            deliverables: [],
            dependencies: [],
            riskLevel: 'low',
          },
        ],
      }),
    };
  },
};

const roleConfig = {
  roles: {
    planner: { displayName: '规划者', description: '规划任务', capabilities: ['plan'], timeoutMs: 5000 },
  },
};

const tlRuntime = createTLRuntime({
  teamStore,
  nativeChat,
  governanceRuntime,
  sessionCompletionBus,
  roleConfig,
  workspaceRoot: workdir,
  runtimeAdapter: {
    async spawnForRole({ task }) {
      const match = String(task || '').match(/`([^`]*\.team-completions\/[^`]+\.json)`/);
      const completionFilePath = match?.[1] || '';
      setTimeout(async () => {
        completionPublishCount += 1;
        await sessionCompletionBus.publishCompletion({
          filePath: completionFilePath,
          payload: {
            ok: true,
            status: 'completed',
            summary: 'completion event arrived',
            deliverables: [],
            issues: [],
            findings: ['event_driven_completion'],
            needsReplan: false,
            additionalWorkItems: [],
            needsHuman: false,
          },
        });
      }, 80).unref?.();
      return {
        ok: true,
        childSessionKey: 'sess:event:1',
        sessionKey: 'sess:event:1',
        runId: 'run:event:1',
      };
    },
    async listSessionsForSession() {
      listCalls += 1;
      return { sessions: [] };
    },
    async getSessionHistory() {
      historyCalls += 1;
      return { messages: [] };
    },
    async sendToSession() {
      return { ok: false, error: 'send_unavailable' };
    },
  },
});

const result = await tlRuntime.handleTeamRun({
  text: '继续直接推进 P6，验证 completion 事件驱动',
  scopeKey: 'dashboard:p6:event',
  history: [],
});

assert(result.ok === true, 'handleTeamRun ok');
assert(result.task?.state === 'done', 'task done', result.task?.state || '');
assert((result.memberResults || []).length === 1, 'one member result');
assert(result.memberResults?.[0]?.ok === true, 'member result ok');
assert(String(result.memberResults?.[0]?.summary || '').includes('completion event arrived'), 'summary came from completion payload');
assert(completionPublishCount === 1, 'completion published once', String(completionPublishCount));
assert(listCalls === 0, 'sessions_list not polled on event path', String(listCalls));
assert(historyCalls === 0, 'session history not polled on event path', String(historyCalls));

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

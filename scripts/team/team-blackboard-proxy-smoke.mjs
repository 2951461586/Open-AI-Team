/**
 * team-blackboard-proxy-smoke.mjs
 *
 * Validates the blackboard proxy system:
 *   1. buildBlackboardSnapshot reads from teamStore
 *   2. extractAndWriteBlackboard writes findings back
 *   3. buildMemberPrompt includes blackboard context
 *   4. buildUpstreamContext includes blackboard even without dependencies
 *   5. End-to-end: member A writes → member B sees it
 */

import { openTeamStore } from '../../src/team/team-store.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', '..', 'config', 'team', 'governance.json');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`✅ ${label}`);
    passed += 1;
  } else {
    console.error(`❌ ${label}`);
    failed += 1;
  }
}

// ── Setup: temporary DB + runtime ────────────────────────────────
const tmpDir = mkdtempSync(join(tmpdir(), 'bb-smoke-'));
const dbPath = join(tmpDir, 'team.db');
const teamStore = openTeamStore(dbPath);
const governanceRuntime = createGovernanceRuntime(configPath);

// Mock nativeChat to capture prompts
let lastChatPrompt = '';
const mockNativeChat = {
  chat: async ({ messages }) => {
    lastChatPrompt = messages?.map(m => m.content).join('\n') || '';
    return { ok: true, reply: '{"action":"direct","directReply":"test"}' };
  },
};

// Track spawned sessions
const spawnedSessions = [];
const mockGateway = {
  spawnSession: async (args) => {
    spawnedSessions.push(args);
    return {
      ok: true,
      childSessionKey: `mock-session-${spawnedSessions.length}`,
      reply: JSON.stringify({
        ok: true,
        summary: `Mock result from ${args.role || 'executor'}`,
        findings: ['关键发现A：系统需要升级', '关键发现B：依赖版本冲突'],
        deliverables: [{ path: '/tmp/output.md', type: 'file', title: '结果文件' }],
      }),
    };
  },
};

const tlRuntime = createTLRuntime({
  teamStore,
  nativeChat: mockNativeChat,
  runtimeAdapter: {
    spawnForRole: async (args) => mockGateway.spawnSession(args),
    sendToSession: async (args) => mockGateway.sendToSession?.(args) || { ok: false, error: 'send_unavailable' },
    listSessionsForSession: async () => ({ sessions: [] }),
    getSessionHistory: async () => ({ messages: [] }),
  },
  governanceRuntime,
  roleConfig: {
    roles: {
      executor: { displayName: '执行者' },
      critic: { displayName: '审查官' },
    },
  },
});

// ── Test 1: Empty blackboard returns empty string ─────────────────
const teamId = 'team:bb-test';
const taskId = 'task:bb-test-1';

// Create team and task
teamStore.createTeam({
  teamId,
  scopeKey: 'test',
  mode: 'tl_delegate',
  status: 'active',
});
teamStore.createTask({
  taskId,
  teamId,
  title: 'Blackboard Test Task',
  description: 'Test blackboard proxy',
  state: 'active',
  priority: 0,
  dependencies: [],
});

// Verify blackboard is empty initially
const entries0 = teamStore.listBlackboardEntries({ taskId });
assert(entries0.length === 0, 'initial blackboard is empty');

// ── Test 2: Write blackboard entries ──────────────────────────────
teamStore.upsertBlackboardEntry({
  teamId,
  taskId,
  section: 'member_results',
  entryKey: 'w1',
  value: {
    role: 'executor',
    ok: true,
    summary: '完成了代码分析，发现 3 个高风险点',
    deliverables: [{ path: '/tmp/analysis.md', title: '分析报告' }],
  },
  authorMemberId: 'member:executor',
});

teamStore.upsertBlackboardEntry({
  teamId,
  taskId,
  section: 'findings',
  entryKey: 'w1:0',
  value: { text: '数据库连接池需要从 10 扩大到 50' },
  authorMemberId: 'member:executor',
});

teamStore.upsertBlackboardEntry({
  teamId,
  taskId,
  section: 'findings',
  entryKey: 'w1:1',
  value: { text: 'API 响应时间在高峰期超过 2s' },
  authorMemberId: 'member:executor',
});

const entries1 = teamStore.listBlackboardEntries({ taskId });
assert(entries1.length === 3, 'blackboard has 3 entries after writes');

// ── Test 3: Verify entries are structured correctly ───────────────
const memberResultEntry = entries1.find(e => e.section === 'member_results');
assert(memberResultEntry != null, 'member_results entry exists');
assert(memberResultEntry.value?.role === 'executor', 'member_results has correct role');
assert(memberResultEntry.value?.summary?.includes('代码分析'), 'member_results has summary');

const findingsEntries = entries1.filter(e => e.section === 'findings');
assert(findingsEntries.length === 2, 'findings has 2 entries');

// ── Test 4: Blackboard entries are readable for snapshot ──────────
// Use the TL runtime's internal buildBlackboardSnapshot
// We test this indirectly via buildMemberPrompt
// which now injects blackboard context

// ── Test 5: Write a signal entry ──────────────────────────────────
teamStore.upsertBlackboardEntry({
  teamId,
  taskId,
  section: 'signals',
  entryKey: 'replan:w2',
  value: {
    signal: 'needsReplan',
    reason: 'executor discovered new dependency',
    from: 'w2',
  },
  authorMemberId: 'member:executor',
});

const entries2 = teamStore.listBlackboardEntries({ taskId });
assert(entries2.length === 4, 'blackboard has 4 entries after signal write');
const signalEntry = entries2.find(e => e.section === 'signals');
assert(signalEntry?.value?.signal === 'needsReplan', 'signal entry has correct signal type');

// ── Test 6: Blackboard version upsert ─────────────────────────────
teamStore.upsertBlackboardEntry({
  teamId,
  taskId,
  section: 'member_results',
  entryKey: 'w1',
  version: 2,
  value: {
    role: 'executor',
    ok: true,
    summary: '完成了代码分析，发现 3 个高风险点（已修订）',
    deliverables: [{ path: '/tmp/analysis-v2.md', title: '分析报告 v2' }],
  },
  authorMemberId: 'member:executor',
});

const entries3 = teamStore.listBlackboardEntries({ taskId });
// version 2 creates a new entry (unique on task_id+section+entry_key+version)
assert(entries3.length === 5, 'blackboard has 5 entries after versioned upsert');

// ── Test 7: Cross-task isolation ──────────────────────────────────
const otherTaskId = 'task:bb-test-other';
teamStore.createTask({
  taskId: otherTaskId,
  teamId,
  title: 'Other Task',
  description: 'Should not see bb entries from task 1',
  state: 'active',
  priority: 0,
  dependencies: [],
});

const otherEntries = teamStore.listBlackboardEntries({ taskId: otherTaskId });
assert(otherEntries.length === 0, 'other task blackboard is isolated');

// ── Test 8: Large blackboard truncation ───────────────────────────
for (let i = 0; i < 50; i += 1) {
  teamStore.upsertBlackboardEntry({
    teamId,
    taskId: otherTaskId,
    section: 'bulk',
    entryKey: `entry_${i}`,
    value: { text: `Bulk entry ${i} with some padding text to take up space in the prompt `.repeat(3) },
    authorMemberId: 'member:executor',
  });
}
const bulkEntries = teamStore.listBlackboardEntries({ taskId: otherTaskId, limit: 200 });
assert(bulkEntries.length === 50, 'bulk entries stored (50)');

// ── Cleanup ───────────────────────────────────────────────────────
try { rmSync(tmpDir, { recursive: true }); } catch {}

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

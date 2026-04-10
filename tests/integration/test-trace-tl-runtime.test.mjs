import assert from 'node:assert/strict';
import path from 'node:path';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { createTraceCollector } from '../../src/observability/trace-span.mjs';
import { FileTraceExporter } from '../../src/observability/trace-exporter.mjs';
import { createInMemoryTeamStore, createIdGenerator, withTempDir } from '../helpers/test-helpers.mjs';

function createGovernanceRuntime() {
  return {
    shouldSkipStage() { return { skip: false }; },
    getErrorRecoveryConfig() { return { autoRetry: { enabled: false, maxRetries: 0, retryableErrors: [], backoffMs: 0 }, partialSuccess: { enabled: true } }; },
    getReviewLoopConfig() { return { enabled: false, maxRevisions: 0, triggerOnVerdict: [], skipOnVerdict: ['approve'] }; },
    getDynamicReplanConfig() { return { enabled: false, maxDynamicLayers: 0, maxDynamicWorkItems: 0, allowedRoles: ['executor'], requireTLApproval: false }; },
    auditTaskEvent: async () => ({ ok: true }),
    getStageRetry: () => ({ maxAttempts: 1 }),
    isRetryableError: () => false,
  };
}

function createNativeChatDelegatingStub() {
  return {
    async generateReplyStream({ onChunk } = {}) {
      const reply = JSON.stringify({
        type: 'delegate',
        summary: 'do work',
        taskMode: 'general',
        riskLevel: 'medium',
        workItems: [{ id: 'w1', role: 'executor', title: 'Do thing', objective: 'Do thing', task: 'Do thing', acceptance: 'done', deliverables: ['result'], dependencies: [], riskLevel: 'medium' }],
      });
      onChunk?.(reply, reply);
      return { ok: true, reply };
    },
  };
}

test('TL runtime emits dispatch/planning/orchestration traces for delegated run', async () => {
  await withTempDir(async (dir) => {
    const traceFile = path.join(dir, `traces-${Date.now() + Math.random()}.jsonl`);
    const collector = createTraceCollector({ exporter: new FileTraceExporter(traceFile), traceLogPath: traceFile });
    const teamStore = createInMemoryTeamStore();
    const runtime = createTLRuntime({
      teamStore,
      nativeChat: createNativeChatDelegatingStub(),
      governanceRuntime: createGovernanceRuntime(),
      governanceAuditor: { logTaskLifecycle: async () => ({}), logAgentBehavior: async () => ({}) },
      traceCollector: collector,
      roleConfig: { roles: { executor: { displayName: '执行者', capabilities: ['implementation'] } } },
      now: () => 1000,
      idgen: createIdGenerator(),
    });

    runtime._runMemberWithSession = async () => ({ ok: true, role: 'executor', assignmentId: 'w1', result: 'done', summary: 'done', structured: {} });
    await runtime.handleTeamRun({ text: 'please do thing', scopeKey: 'test' });
    await collector.flush();

    const recent = await collector.listRecent(10);
    assert.equal(recent.ok, true);
    assert.equal(recent.traces.length, 1);
    const ops = JSON.stringify(recent.traces[0].tree);
    assert.match(ops, /tl\.dispatch/);
    assert.match(ops, /tl\.planning/);
  });
});

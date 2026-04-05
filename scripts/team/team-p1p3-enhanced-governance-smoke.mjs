/**
 * team-p1p3-enhanced-governance-smoke.mjs
 *
 * Validates P1-P3 improvements:
 *   P1: Review loop (critic → revise → re-execute → re-review)
 *   P2: Error recovery (auto-retry, partial success)
 *   P3: Governance config v2 (medium risk enables critic/judge)
 */

import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { buildExecutionLayers } from '../../src/team/team-parallel-executor.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ── Test 1: Governance v2 config loads correctly ──────────────────
const rt = createGovernanceRuntime(configPath);
const cfg = rt.getConfig();
assert(cfg?.version === '2.0.0', 'governance version 2.0.0');

// ── Test 2: Medium risk no longer skips critic ───────────────────
const skipCriticLow = rt.shouldSkipStage('critic', { riskLevel: 'low' });
const skipCriticMed = rt.shouldSkipStage('critic', { riskLevel: 'medium' });
const skipCriticHigh = rt.shouldSkipStage('critic', { riskLevel: 'high' });
assert(skipCriticLow.skip === true, 'low risk → skip critic');
assert(skipCriticMed.skip === false, 'medium risk → DO NOT skip critic');
assert(skipCriticHigh.skip === false, 'high risk → DO NOT skip critic');

// ── Test 3: Medium risk no longer skips judge ────────────────────
const skipJudgeLow = rt.shouldSkipStage('judge', { riskLevel: 'low' });
const skipJudgeMed = rt.shouldSkipStage('judge', { riskLevel: 'medium' });
assert(skipJudgeLow.skip === true, 'low risk → skip judge');
assert(skipJudgeMed.skip === false, 'medium risk → DO NOT skip judge');

// ── Test 4: Review loop config ───────────────────────────────────
const loopCfg = rt.getReviewLoopConfig();
assert(loopCfg.enabled === true, 'review loop enabled');
assert(loopCfg.maxRevisions === 2, 'max revisions = 2');
assert(loopCfg.triggerOnVerdict.includes('revise'), 'trigger on "revise"');
assert(loopCfg.skipOnVerdict.includes('approve'), 'skip on "approve"');
assert(loopCfg.escalateOnVerdict.includes('escalate_human'), 'escalate on "escalate_human"');

// ── Test 5: Review verdict resolution ────────────────────────────
const revise = rt.resolveReviewVerdict('revise');
const approve = rt.resolveReviewVerdict('approve');
const escalate = rt.resolveReviewVerdict('escalate_human');
assert(revise.action === 'revise', 'revise verdict → action=revise');
assert(approve.action === 'approve', 'approve verdict → action=approve');
assert(escalate.action === 'escalate', 'escalate_human verdict → action=escalate');

// ── Test 6: Error recovery config ────────────────────────────────
const recoveryCfg = rt.getErrorRecoveryConfig();
assert(recoveryCfg.autoRetry.enabled === true, 'auto-retry enabled');
assert(recoveryCfg.autoRetry.maxRetries === 2, 'max retries = 2');
assert(recoveryCfg.autoRetry.retryableErrors.includes('timeout'), '"timeout" is retryable');
assert(recoveryCfg.autoRetry.retryableErrors.includes('spawn_failed'), '"spawn_failed" is retryable');
assert(recoveryCfg.partialSuccess.enabled === true, 'partial success enabled');
assert(recoveryCfg.partialSuccess.preserveCompletedResults === true, 'preserve completed results');

// ── Test 7: Retryable error detection ────────────────────────────
assert(rt.isRetryableError('session_failed: spawn error') === true, 'session_failed is retryable');
assert(rt.isRetryableError('connection timeout after 120s') === true, 'timeout is retryable');
assert(rt.isRetryableError('spawn_failed: node unreachable') === true, 'spawn_failed is retryable');
assert(rt.isRetryableError('invalid JSON in response') === false, 'invalid JSON is NOT retryable');
assert(rt.isRetryableError('LLM refused to answer') === false, 'LLM refused is NOT retryable');

// ── Test 8: Stage retry config ───────────────────────────────────
const executorRetry = rt.getStageRetry('executor');
const criticRetry = rt.getStageRetry('critic');
assert(executorRetry.maxAttempts === 2, 'executor max retry attempts = 2');
assert(criticRetry.maxAttempts === 1, 'critic max retry attempts = 1');

// ── Test 9: Execution layers still work with enhanced workItems ──
const layers = buildExecutionLayers([
  { id: 'w1', role: 'executor', dependsOn: [] },
  { id: 'w1:critic', role: 'critic', dependsOn: ['w1'] },
  { id: 'w1:judge', role: 'judge', dependsOn: ['w1:critic'] },
  { id: 'w2', role: 'executor', dependsOn: [] },
]);
assert(layers.length === 3, 'DAG produces 3 layers');
assert(layers[0].length === 2, 'layer 0 has 2 parallel items (w1, w2)');
assert(layers[0].some(s => s.stepId === 'w1'), 'layer 0 contains w1');
assert(layers[0].some(s => s.stepId === 'w2'), 'layer 0 contains w2');
assert(layers[1].length === 1 && layers[1][0].stepId === 'w1:critic', 'layer 1 contains w1:critic');
assert(layers[2].length === 1 && layers[2][0].stepId === 'w1:judge', 'layer 2 contains w1:judge');

// ── Test 10: Degradation config ──────────────────────────────────
assert(recoveryCfg.degradation.enabled === true, 'degradation enabled');
assert(recoveryCfg.degradation.fallbackToNativeChat === true, 'fallback to native chat');
assert(recoveryCfg.degradation.fallbackToTLDirect === true, 'fallback to TL direct');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

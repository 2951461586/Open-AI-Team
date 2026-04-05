import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { tryHandleTeamRoute } from '../../src/routes/index-routes-team.mjs';

const ctx = createAppContext(loadIndexConfig());
const { teamStore } = ctx;
const now = () => Date.now();

function makeReq(url, body) { return { method: 'POST', url, _body: body }; }
function makeRes() { return { code: 0, body: null, headers: null }; }
async function invoke(url, body) {
  const req = makeReq(url, body);
  const res = makeRes();
  const handled = tryHandleTeamRoute(req, res, {
    ...ctx,
    isOrchAuthorized: () => true,
    sendJson: (resObj, code, payload, extraHeaders = {}) => { resObj.code = code; resObj.body = payload; resObj.headers = extraHeaders; },
    handleJsonBody: async (_req, _res, fn) => {
      try {
        const out = await fn(_req._body || {});
        res.code = out?.ok === false ? 400 : 200;
        res.body = out;
      } catch (error) {
        res.code = 400;
        res.body = { ok: false, error: String(error) };
      }
    },
  });
  return { handled, res };
}
function snapshotTask(taskId, teamId) {
  return {
    task: teamStore.getTaskById(taskId),
    reviews: teamStore.listReviewsByTask ? teamStore.listReviewsByTask(taskId) : [],
    decisions: teamStore.listDecisionsByTask ? teamStore.listDecisionsByTask(taskId) : [],
    mailbox: teamStore.listMailboxMessages({ teamId, limit: 500 }) || [],
    blackboard: teamStore.listBlackboardEntries({ taskId, limit: 500 }) || [],
    artifacts: teamStore.listArtifactsByTask ? (teamStore.listArtifactsByTask(taskId) || []) : [],
    evidence: teamStore.listEvidenceByTask ? (teamStore.listEvidenceByTask(taskId) || []) : [],
  };
}
function countKinds(mailbox = []) { return mailbox.reduce((acc, item) => { const kind = String(item?.kind || ''); acc[kind] = (acc[kind] || 0) + 1; return acc; }, {}); }
function assertNoMutation(before, after, label) {
  assert.equal(String(after.task?.state || ''), String(before.task?.state || ''), `${label}: task state`);
  assert.equal(after.reviews.length, before.reviews.length, `${label}: reviews`);
  assert.equal(after.decisions.length, before.decisions.length, `${label}: decisions`);
  assert.deepEqual(countKinds(after.mailbox), countKinds(before.mailbox), `${label}: mailbox`);
  assert.equal(after.blackboard.length, before.blackboard.length, `${label}: blackboard`);
  assert.equal(after.artifacts.length, before.artifacts.length, `${label}: artifacts`);
  assert.equal(after.evidence.length, before.evidence.length, `${label}: evidence`);
}
function seedReviewTask() {
  const ts = now();
  const teamId = `team:negative-review:${randomUUID()}`;
  const taskId = `task:negative-review:${randomUUID()}`;
  const plannerId = `member:planner:${randomUUID()}`;
  const criticId = `member:critic:${randomUUID()}`;
  const judgeId = `member:judge:${randomUUID()}`;
  teamStore.createTeam({ teamId, scopeKey: `qq:${randomUUID()}`, mode: 'analysis', status: 'active', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: judgeId, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createTask({ taskId, teamId, title: 'negative review acceptance', description: 'invalid review must not mutate state', state: 'plan_review', priority: 10, dependencies: [], metadata: { taskMode: 'analysis', riskLevel: 'medium', visibilityPolicy: { userVisible: true, teamVisible: true } }, createdAt: ts, updatedAt: ts });
  const plan = teamStore.insertPlan({ planId: `plan:${randomUUID()}`, taskId, authorMemberId: plannerId, summary: 'valid seed plan', steps: ['a', 'b', 'c'], risks: ['r1'], status: 'submitted', createdAt: ts, updatedAt: ts });
  return { teamId, taskId, criticId, judgeId, planId: String(plan.planId || '') };
}
function seedDecisionTask() {
  const ts = now();
  const teamId = `team:negative-decision:${randomUUID()}`;
  const taskId = `task:negative-decision:${randomUUID()}`;
  const criticId = `member:critic:${randomUUID()}`;
  const judgeId = `member:judge:${randomUUID()}`;
  teamStore.createTeam({ teamId, scopeKey: `qq:${randomUUID()}`, mode: 'analysis', status: 'active', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: judgeId, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createTask({ taskId, teamId, title: 'negative decision acceptance', description: 'invalid decision must not mutate state', state: 'approved', priority: 10, dependencies: [], metadata: { taskMode: 'analysis', riskLevel: 'medium', visibilityPolicy: { userVisible: true, teamVisible: true } }, createdAt: ts, updatedAt: ts });
  const review = teamStore.insertReview({ reviewId: `review:${randomUUID()}`, contractVersion: 'critic.review.v2', outputType: 'team.review.v2', taskId, targetType: 'plan', targetId: `plan:${randomUUID()}`, reviewerMemberId: criticId, score: 0.95, verdict: 'approve', checklist: ['verdict_matches_issues', 'issues_are_actionable', 'review_is_reusable'], evidenceRequirements: ['issues_reference_location', 'severity_is_explicit', 'suggestion_is_concrete'], issues: [], createdAt: ts, updatedAt: ts });
  return { teamId, taskId, judgeId, reviewId: String(review.reviewId || '') };
}
async function expectInvalid(url, body, seed, expectedContractError, label) {
  const before = snapshotTask(seed.taskId, seed.teamId);
  const out = await invoke(url, body);
  const after = snapshotTask(seed.taskId, seed.teamId);
  assert.equal(out.handled, true, `${label}: handled`);
  assert.equal(out.res.code, 400, `${label}: code`);
  assert.equal(out.res.body?.ok, false, `${label}: ok false`);
  if (expectedContractError) assert.equal(out.res.body?.contractCheck?.error, expectedContractError, `${label}: contract error`);
  assertNoMutation(before, after, label);
  return out.res.body;
}

const reviewSeed = seedReviewTask();
await expectInvalid('/internal/team/review', {
  reviewId: `review:${randomUUID()}`,
  contractVersion: 'critic.review.v2', outputType: 'team.review.v2', taskId: reviewSeed.taskId, targetType: 'plan', targetId: reviewSeed.planId, reviewerMemberId: reviewSeed.criticId,
  score: 0.9, verdict: 'approve', checklist: ['verdict_matches_issues', 'issues_are_actionable', 'review_is_reusable'], evidenceRequirements: ['issues_reference_location', 'severity_is_explicit', 'suggestion_is_concrete'],
  issues: [{ severity: 'major', location: 'overall', title: 'should fail', description: 'semantic mismatch', suggestion: 'fix' }],
}, reviewSeed, 'critic_verdict_issues_mismatch', 'review-verdict-mismatch');

const reviewBoundaries = [];
for (const [label, score] of [['review-score-lt-zero', -0.01], ['review-score-gt-one', 1.01], ['review-score-string', '0.8'], ['review-score-null', null], ['review-score-nan', Number.NaN]]) {
  const seed = seedReviewTask();
  const res = await expectInvalid('/internal/team/review', {
    reviewId: `review:${randomUUID()}`,
    contractVersion: 'critic.review.v2', outputType: 'team.review.v2', taskId: seed.taskId, targetType: 'plan', targetId: seed.planId, reviewerMemberId: seed.criticId,
    score, verdict: 'approve', checklist: ['verdict_matches_issues', 'issues_are_actionable', 'review_is_reusable'], evidenceRequirements: ['issues_reference_location', 'severity_is_explicit', 'suggestion_is_concrete'], issues: [],
  }, seed, 'critic_score_out_of_range', label);
  reviewBoundaries.push({ label, error: res.contractCheck?.error, score: String(score) });
}

const decisionBoundaries = [];
for (const item of [
  { label: 'decision-next-state-mismatch', body: (seed) => ({ decisionId: `decision:${randomUUID()}`, contractVersion: 'judge.decision.v2', outputType: 'team.decision.v2', taskId: seed.taskId, judgeMemberId: seed.judgeId, decisionType: 'approve', reason: 'valid reason', payload: { nextState: 'blocked' }, evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'] }), err: 'judge_decision_state_mismatch' },
  { label: 'decision-empty-reason', body: (seed) => ({ decisionId: `decision:${randomUUID()}`, contractVersion: 'judge.decision.v2', outputType: 'team.decision.v2', taskId: seed.taskId, judgeMemberId: seed.judgeId, decisionType: 'approve', reason: '', payload: { nextState: 'done' }, evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'] }), err: 'judge_reason_invalid' },
  { label: 'decision-placeholder-reason', body: (seed) => ({ decisionId: `decision:${randomUUID()}`, contractVersion: 'judge.decision.v2', outputType: 'team.decision.v2', taskId: seed.taskId, judgeMemberId: seed.judgeId, decisionType: 'approve', reason: 'N/A', payload: { nextState: 'done' }, evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'] }), err: 'judge_reason_invalid' },
  { label: 'decision-payload-not-object', body: (seed) => ({ decisionId: `decision:${randomUUID()}`, contractVersion: 'judge.decision.v2', outputType: 'team.decision.v2', taskId: seed.taskId, judgeMemberId: seed.judgeId, decisionType: 'approve', reason: 'valid reason', payload: 'done', evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'] }), err: 'judge_payload_invalid' },
  { label: 'decision-payload-extra-field', body: (seed) => ({ decisionId: `decision:${randomUUID()}`, contractVersion: 'judge.decision.v2', outputType: 'team.decision.v2', taskId: seed.taskId, judgeMemberId: seed.judgeId, decisionType: 'approve', reason: 'valid reason', payload: { nextState: 'done', hacked: true }, evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'] }), err: 'judge_payload_extra_fields_not_allowed' },
  { label: 'decision-revise-missing-review-link', body: (seed) => ({ decisionId: `decision:${randomUUID()}`, contractVersion: 'judge.decision.v2', outputType: 'team.decision.v2', taskId: seed.taskId, judgeMemberId: seed.judgeId, decisionType: 'revise', reason: 'need revision after review', payload: { nextState: 'revision_requested' }, evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'] }), err: 'judge_payload_review_link_required' },
]) {
  const seed = seedDecisionTask();
  const res = await expectInvalid('/internal/team/decision', item.body(seed), seed, item.err, item.label);
  decisionBoundaries.push({ label: item.label, error: res.contractCheck?.error });
}

const plannerSeed = seedReviewTask();
const plannerBefore = snapshotTask(plannerSeed.taskId, plannerSeed.teamId);
const plannerOut = await invoke('/internal/team/plan', {
  taskId: plannerSeed.taskId, authorMemberId: 'planner', ok: true, type: 'team.plan.v2', contractVersion: 'planner.plan.v2', summary: 'bad planner payload', steps: [], risks: [], successCriteria: ['plan_is_actionable', 'steps_are_ordered', 'risks_are_explicit'], evidenceRequirements: ['task_context_cited', 'steps_have_exit_criteria', 'risks_have_mitigation'],
});
const plannerAfter = snapshotTask(plannerSeed.taskId, plannerSeed.teamId);
assert.equal(plannerOut.handled, true);
assert.equal(plannerOut.res.code, 400);
assert.equal(plannerOut.res.body?.error, 'planner_contract_invalid');
assertNoMutation(plannerBefore, plannerAfter, 'planner-empty-steps-risks');

console.log(JSON.stringify({
  ok: true,
  summary: {
    plannerNegative: { code: plannerOut.res.code, error: plannerOut.res.body?.error },
    reviewBoundaries,
    decisionBoundaries,
  },
  boundaryPolicy: {
    decisionExtraPayloadFields: 'rejected_fail_closed',
    decisionPayloadNormalizationOnConflict: 'not_allowed',
    judgeReasonPlaceholders: ['n/a', 'na', 'none', 'null', 'undefined', 'unknown', 'tbd', 'todo', '-', '--', '...', 'reason', 'placeholder'],
    judgePayloadWhitelist: ['nextState', 'source', 'reviewId', 'verdict', 'revisionCount', 'maxRevisions', 'lastReviewId', 'lastVerdict', 'issueStats', 'userVisible'],
  },
}, null, 2));

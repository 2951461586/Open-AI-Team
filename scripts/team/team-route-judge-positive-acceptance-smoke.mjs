import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { tryHandleTeamRoute } from '../../src/routes/index-routes-team.mjs';
import { JUDGE_ALLOWED_PAYLOAD_KEYS } from '../../src/team/team-role-contracts.mjs';

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

function seedTask({ state = 'approved' } = {}) {
  const ts = now();
  const teamId = `team:judge-positive:${randomUUID()}`;
  const taskId = `task:judge-positive:${randomUUID()}`;
  const criticId = `member:critic:${randomUUID()}`;
  const judgeId = `member:judge:${randomUUID()}`;
  teamStore.createTeam({ teamId, scopeKey: `qq:${randomUUID()}`, mode: 'analysis', status: 'active', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createMember({ memberId: judgeId, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: ts, updatedAt: ts });
  teamStore.createTask({ taskId, teamId, title: 'judge positive acceptance', description: 'route positive coverage', state, priority: 10, dependencies: [], metadata: { taskMode: 'analysis', riskLevel: 'medium', visibilityPolicy: { userVisible: true, teamVisible: true } }, createdAt: ts, updatedAt: ts });
  const review = teamStore.insertReview({
    reviewId: `review:${randomUUID()}`,
    contractVersion: 'critic.review.v2',
    outputType: 'team.review.v2',
    taskId,
    targetType: 'plan',
    targetId: `plan:${randomUUID()}`,
    reviewerMemberId: criticId,
    score: 0.61,
    verdict: 'revise',
    checklist: ['verdict_matches_issues', 'issues_are_actionable', 'review_is_reusable'],
    evidenceRequirements: ['issues_reference_location', 'severity_is_explicit', 'suggestion_is_concrete'],
    issues: [{ severity: 'major', location: 'overall', title: 'Need revision', description: 'Major issue found', suggestion: 'Revise before shipping' }],
    issueStats: { critical: 0, major: 1, minor: 0, suggestion: 0 },
    createdAt: ts,
    updatedAt: ts,
  });
  return { teamId, taskId, judgeId, reviewId: String(review.reviewId || '') };
}

const cases = [
  {
    label: 'revise-valid',
    seedState: 'approved',
    decisionType: 'revise',
    expectedState: 'revision_requested',
    payload: (seed) => ({
      nextState: 'revision_requested',
      reviewId: seed.reviewId,
      source: 'judge_positive_smoke',
      verdict: 'revise',
      issueStats: { critical: 0, major: 1, minor: 0, suggestion: 0 },
      userVisible: false,
    }),
  },
  {
    label: 'reject-valid',
    seedState: 'approved',
    decisionType: 'reject',
    expectedState: 'revision_requested',
    payload: (seed) => ({
      nextState: 'revision_requested',
      reviewId: seed.reviewId,
      source: 'judge_positive_smoke',
      verdict: 'revise',
      lastReviewId: seed.reviewId,
      lastVerdict: 'revise',
      userVisible: false,
    }),
  },
  {
    label: 'escalate-valid',
    seedState: 'approved',
    decisionType: 'escalate',
    expectedState: 'blocked',
    payload: (seed) => ({
      nextState: 'blocked',
      reviewId: seed.reviewId,
      source: 'judge_positive_smoke',
      verdict: 'revise',
      revisionCount: 2,
      maxRevisions: 3,
      issueStats: { critical: 1, major: 0, minor: 0, suggestion: 0 },
      userVisible: true,
    }),
  },
  {
    label: 'escalate-human-valid',
    seedState: 'approved',
    decisionType: 'escalate_human',
    expectedState: 'blocked',
    payload: (seed) => ({
      nextState: 'blocked',
      reviewId: seed.reviewId,
      source: 'judge_positive_smoke',
      verdict: 'revise',
      revisionCount: 3,
      maxRevisions: 3,
      lastReviewId: seed.reviewId,
      lastVerdict: 'revise',
      issueStats: { critical: 1, major: 1, minor: 0, suggestion: 0 },
      userVisible: true,
    }),
  },
];

const summary = [];
for (const item of cases) {
  const seed = seedTask({ state: item.seedState });
  const decisionId = `decision:${randomUUID()}`;
  const out = await invoke('/internal/team/decision', {
    decisionId,
    contractVersion: 'judge.decision.v2',
    outputType: 'team.decision.v2',
    taskId: seed.taskId,
    judgeMemberId: seed.judgeId,
    decisionType: item.decisionType,
    reason: `Positive acceptance for ${item.decisionType} with contract-valid route payload.`,
    payload: item.payload(seed),
    evidenceRequirements: ['decision_references_review_or_task_state', 'next_state_matches_decision'],
  });

  assert.equal(out.handled, true, `${item.label}: handled`);
  assert.equal(out.res.code, 200, `${item.label}: code`);
  assert.equal(out.res.body?.ok, true, `${item.label}: ok`);
  assert.equal(String(out.res.body?.decision?.decisionType || ''), item.decisionType, `${item.label}: decisionType`);
  assert.equal(String(out.res.body?.task?.state || ''), item.expectedState, `${item.label}: task state`);
  assert.equal(String(out.res.body?.decision?.payload?.nextState || ''), item.expectedState, `${item.label}: payload nextState`);
  const payloadKeys = Object.keys(out.res.body?.decision?.payload || {});
  assert(payloadKeys.every((key) => JUDGE_ALLOWED_PAYLOAD_KEYS.includes(key)), `${item.label}: payload keys are whitelisted`);
  assert(payloadKeys.includes('reviewId'), `${item.label}: reviewId kept`);
  const mailbox = teamStore.listMailboxMessages({ teamId: seed.teamId, limit: 100 }) || [];
  assert(mailbox.some((msg) => String(msg.kind || '') === 'decision.final' && String(msg.payload?.decisionId || '') === decisionId), `${item.label}: decision.final emitted`);
  summary.push({
    label: item.label,
    decisionType: out.res.body?.decision?.decisionType,
    taskState: out.res.body?.task?.state,
    payloadKeys,
    outputGateOpened: !!out.res.body?.outputGate?.opened,
  });
}

console.log(JSON.stringify({
  ok: true,
  judgePayloadWhitelist: JUDGE_ALLOWED_PAYLOAD_KEYS,
  cases: summary,
  policy: {
    extraPayloadFields: 'rejected_fail_closed',
    positiveCasesRoutedThrough: '/internal/team/decision',
  },
}, null, 2));

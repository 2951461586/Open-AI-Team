import assert from 'node:assert/strict';
import {
  TEAM_ROLE_CONTRACTS,
  JUDGE_ALLOWED_PAYLOAD_KEYS,
  JUDGE_INVALID_REASON_LITERALS,
  JUDGE_REVIEW_LINKED_DECISION_TYPES,
  validateRoleContract,
  isInvalidJudgeReason,
} from '../../src/team/team-role-contracts.mjs';

const plannerValid = {
  ok: true,
  type: 'team.plan.v2',
  contractVersion: 'planner.plan.v2',
  summary: 'Deliver a safe incremental rollout plan.',
  steps: ['create patch', 'run smoke', 'ship'],
  risks: ['regression risk'],
  successCriteria: TEAM_ROLE_CONTRACTS.planner.successCriteria,
  evidenceRequirements: TEAM_ROLE_CONTRACTS.planner.evidenceRequirements,
};

const criticValid = {
  reviewId: 'review:matrix:1',
  contractVersion: 'critic.review.v2',
  outputType: 'team.review.v2',
  taskId: 'task:matrix:1',
  targetType: 'plan',
  targetId: 'plan:matrix:1',
  reviewerMemberId: 'critic:matrix',
  score: 0.82,
  verdict: 'approve_with_notes',
  checklist: TEAM_ROLE_CONTRACTS.critic.successCriteria,
  evidenceRequirements: TEAM_ROLE_CONTRACTS.critic.evidenceRequirements,
  issues: [
    {
      severity: 'minor',
      location: 'step[1]',
      title: 'Clarify rollback trigger',
      description: 'Need explicit rollback condition.',
      suggestion: 'Add a threshold-based rollback note.',
    },
  ],
};

const judgeValid = {
  decisionId: 'decision:matrix:1',
  contractVersion: 'judge.decision.v2',
  outputType: 'team.decision.v2',
  taskId: 'task:matrix:1',
  judgeMemberId: 'judge:matrix',
  decisionType: 'revise',
  reason: 'Critical review findings require a focused revision pass.',
  payload: {
    nextState: 'revision_requested',
    reviewId: 'review:matrix:1',
    source: 'matrix_smoke',
    verdict: 'revise',
    issueStats: { critical: 1, major: 0, minor: 0, suggestion: 0 },
    userVisible: false,
  },
  evidenceRequirements: TEAM_ROLE_CONTRACTS.judge.evidenceRequirements,
};

const matrix = [
  {
    role: 'planner',
    cases: [
      { label: 'valid happy path', payload: plannerValid, ok: true },
      { label: 'required field missing', payload: { ...plannerValid, steps: [] }, ok: false, error: 'contract_required_fields_missing' },
      { label: 'type/version mismatch', payload: { ...plannerValid, type: 'team.plan.v1' }, ok: false, error: 'contract_required_fields_missing' },
      { label: 'semantic boundary mismatch', payload: { ...plannerValid, risks: [] }, ok: false, error: 'contract_required_fields_missing' },
    ],
  },
  {
    role: 'critic',
    cases: [
      { label: 'valid happy path', payload: criticValid, ok: true },
      { label: 'required field missing', payload: { ...criticValid, evidenceRequirements: undefined }, ok: false, error: 'critic_evidence_requirements_mismatch' },
      { label: 'type/version mismatch', payload: { ...criticValid, contractVersion: 'critic.review.v1' }, ok: false, error: 'contract_required_fields_missing' },
      { label: 'semantic boundary mismatch', payload: { ...criticValid, verdict: 'approve', issues: criticValid.issues }, ok: false, error: 'critic_verdict_issues_mismatch' },
    ],
  },
  {
    role: 'judge',
    cases: [
      { label: 'valid happy path', payload: judgeValid, ok: true },
      { label: 'required field missing', payload: { ...judgeValid, payload: { nextState: 'revision_requested' } }, ok: false, error: 'judge_payload_review_link_required' },
      { label: 'type/version mismatch', payload: { ...judgeValid, outputType: 'team.decision.v1' }, ok: false, error: 'contract_required_fields_missing' },
      { label: 'semantic boundary mismatch', payload: { ...judgeValid, payload: { ...judgeValid.payload, nextState: 'blocked' } }, ok: false, error: 'judge_decision_state_mismatch' },
    ],
  },
];

const results = [];
for (const group of matrix) {
  for (const item of group.cases) {
    const out = validateRoleContract(group.role, item.payload);
    assert.equal(out.ok, item.ok, `${group.role} ${item.label} ok`);
    if (!item.ok) assert.equal(out.error, item.error, `${group.role} ${item.label} error`);
    results.push({ role: group.role, label: item.label, ok: out.ok, error: out.error || '' });
  }
}

for (const literal of JUDGE_INVALID_REASON_LITERALS) {
  assert.equal(isInvalidJudgeReason(literal), true, `invalid reason literal blocked: ${literal}`);
}
assert.equal(isInvalidJudgeReason('placeholder: fill later'), true, 'invalid reason prefix blocked');
assert.equal(isInvalidJudgeReason('Need human sign-off because deployment risk is unresolved.'), false, 'valid judge reason allowed');
assert.deepEqual(JUDGE_ALLOWED_PAYLOAD_KEYS, ['nextState', 'source', 'reviewId', 'verdict', 'revisionCount', 'maxRevisions', 'lastReviewId', 'lastVerdict', 'issueStats', 'userVisible']);
assert.deepEqual(JUDGE_REVIEW_LINKED_DECISION_TYPES, ['revise', 'reject', 'escalate', 'escalate_human']);

console.log(JSON.stringify({
  ok: true,
  results,
  judgePolicy: {
    invalidReasonLiterals: JUDGE_INVALID_REASON_LITERALS,
    allowedPayloadKeys: JUDGE_ALLOWED_PAYLOAD_KEYS,
    reviewLinkedDecisionTypes: JUDGE_REVIEW_LINKED_DECISION_TYPES,
    extraPayloadPolicy: 'fail_closed_reject_extra_fields',
  },
}, null, 2));

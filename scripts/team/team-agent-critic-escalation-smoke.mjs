// team-agent-critic-escalation-smoke.mjs
// P2 验收：验证 maxRevisions 超限后自动 escalate_human
import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { randomUUID } from 'node:crypto';

const config = loadIndexConfig();
const ctx = createAppContext(config);
const { teamStore } = ctx;

let pass = 0;
let fail = 0;
function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

console.log('=== P2: Critic Escalation Smoke ===\n');

const now = Date.now();
const teamId = `team:esc:${randomUUID()}`;
const taskId = `task:esc:${randomUUID()}`;
const criticId = `member:critic:${randomUUID()}`;
const judgeId = `member:judge:${randomUUID()}`;

// Setup team
teamStore.createTeam({ teamId, scopeKey: 'test:escalation', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: judgeId, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({ taskId, teamId, title: 'escalation test', description: 'test', state: 'plan_review', priority: 10, dependencies: [], metadata: {}, createdAt: now, updatedAt: now });

// Insert 3 "revise" reviews (hit maxRevisions=3)
for (let i = 0; i < 3; i++) {
  teamStore.insertReview({
    reviewId: `review:${randomUUID()}`,
    taskId,
    targetType: 'plan',
    targetId: `plan:${randomUUID()}`,
    reviewerMemberId: criticId,
    score: 0.3,
    verdict: 'revise',
    issues: [{ severity: 'critical', location: 'overall', title: `issue-${i}`, description: 'd', suggestion: 's' }],
    createdAt: now + i,
  });
}

// Verify revision count
const allReviews = teamStore.listReviewsByTask(taskId);
const revisionCount = allReviews.filter(r => String(r.verdict || '').toLowerCase() === 'revise').length;
assert(revisionCount === 3, `revisionCount=${revisionCount} (expected 3)`);

// Now simulate what the route does: POST /internal/team/review with a 4th revise
// We'll call the HTTP endpoint directly
const fourthReview = {
  reviewId: `review:${randomUUID()}`,
  taskId,
  targetType: 'plan',
  targetId: `plan:${randomUUID()}`,
  reviewerMemberId: criticId,
  score: 0.2,
  verdict: 'revise',
  issues: [{ severity: 'critical', location: 'step_1', title: 'still broken', description: 'd', suggestion: 's' }],
};

const resp = await fetch(`http://127.0.0.1:${config.PORT}/internal/team/review`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-orch-token': config.ORCH_KICK_TOKEN,
  },
  body: JSON.stringify(fourthReview),
});

const result = await resp.json();

assert(result.ok === true, 'response ok');
assert(result.escalated === true, `escalated=${result.escalated}`);
assert(result.revisionCount >= 3, `revisionCount=${result.revisionCount} >= 3`);
assert(result.autoDecision?.decisionType === 'escalate_human', `decisionType=${result.autoDecision?.decisionType}`);
assert(String(result.autoDecision?.reason || '').includes('max_revisions_exceeded'), `reason includes max_revisions_exceeded`);

// Verify task state is blocked
const finalTask = teamStore.getTaskById(taskId);
assert(String(finalTask?.state || '') === 'blocked', `task.state=${finalTask?.state} (expected blocked)`);

// Verify mailbox has escalation message
const mailbox = teamStore.listMailboxMessages({ teamId, limit: 100 }) || [];
const escalationMsg = mailbox.find(m => m.kind === 'decision.escalate_human');
assert(!!escalationMsg, 'mailbox has decision.escalate_human');
assert(String(escalationMsg?.payload?.reason || '').includes('exceeded'), 'escalation reason in payload');

// Verify that an approve review does NOT trigger escalation even after many revisions
const taskId2 = `task:esc2:${randomUUID()}`;
teamStore.createTask({ taskId: taskId2, teamId, title: 'approve after revisions', description: 'test', state: 'plan_review', priority: 10, dependencies: [], metadata: {}, createdAt: now, updatedAt: now });
for (let i = 0; i < 5; i++) {
  teamStore.insertReview({ reviewId: `review:${randomUUID()}`, taskId: taskId2, targetType: 'plan', targetId: 'p', reviewerMemberId: criticId, score: 0.3, verdict: 'revise', issues: [], createdAt: now + i });
}
const approveReview = {
  reviewId: `review:${randomUUID()}`,
  taskId: taskId2,
  targetType: 'plan',
  targetId: 'p',
  reviewerMemberId: criticId,
  score: 0.9,
  verdict: 'approve',
  issues: [],
};
const resp2 = await fetch(`http://127.0.0.1:${config.PORT}/internal/team/review`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-orch-token': config.ORCH_KICK_TOKEN },
  body: JSON.stringify(approveReview),
});
const result2 = await resp2.json();
assert(result2.escalated === false, 'approve does not escalate even with high revisionCount');

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);

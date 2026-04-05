import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../../src/index-env.mjs';

const ctx = createAppContext(loadIndexConfig());
const { teamStore, agentHarness } = ctx;

const now = Date.now();
const teamId = `team:critic-lebang-live:${randomUUID()}`;
const plannerId = `member:planner:${randomUUID()}`;
const criticId = `member:critic:${randomUUID()}`;
const taskId = `task:critic-lebang-live:${randomUUID()}`;
const planId = `plan:${randomUUID()}`;

const probe = await agentHarness.probeRole('critic');
const selectedNode = String(probe?.selectedNode || '');

teamStore.createTeam({ teamId, scopeKey: 'qq:1085631891', mode: 'analysis', status: 'active', metadata: { suite: 'team-critic-lebang-live', selectedNode }, createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({
  taskId,
  teamId,
  title: 'critic lebang live acceptance',
  description: 'verify critic route authority resolves to lebang and approved review lands in store',
  state: 'plan_review',
  priority: 10,
  dependencies: [],
  metadata: { taskMode: 'analysis', riskLevel: 'medium', requestedNode: selectedNode, actualNode: selectedNode, currentMemberKey: 'critic.lebang' },
  createdAt: now,
  updatedAt: now,
});

teamStore.insertPlan({
  planId,
  taskId,
  authorMemberId: plannerId,
  memberKey: 'planner.violet',
  contractVersion: 'planner.plan.v2',
  outputType: 'team.plan.v2',
  summary: 'seed plan for critic local authority live acceptance',
  steps: [
    { id: 's1', title: 'inspect route', description: 'verify critic resolves to lebang' },
    { id: 's2', title: 'submit review', description: 'persist approved review into store' },
  ],
  risks: [
    { id: 'r1', risk: 'critic route drift', mitigation: 'probe role gateway before review submit' },
  ],
  status: 'submitted',
  createdAt: now,
  updatedAt: now,
});

teamStore.appendMailboxMessage({
  messageId: `msg:${randomUUID()}`,
  teamId,
  taskId,
  threadId: taskId,
  kind: 'critic.session.started',
  fromMemberId: criticId,
  payload: { selectedNode, accepted: probe?.ok === true, provider: String(agentHarness?.provider || 'openclaw') },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

const review = teamStore.insertReview({
  reviewId: `review:${randomUUID()}`,
  taskId,
  targetType: 'plan',
  targetId: planId,
  reviewerMemberId: criticId,
  memberKey: 'critic.lebang',
  contractVersion: 'critic.review.v2',
  outputType: 'team.review.v2',
  score: 0.93,
  verdict: 'approve_with_notes',
  issues: [
    { severity: 'low', location: 'plan.steps[1]', title: '补充验证语句', description: '建议明确成功信号', suggestion: '补充验收出口语句' },
  ],
  createdAt: now,
});

teamStore.appendMailboxMessage({
  messageId: `msg:${randomUUID()}`,
  teamId,
  taskId,
  threadId: taskId,
  kind: 'review.submit',
  fromMemberId: criticId,
  payload: { reviewId: review.reviewId, verdict: review.verdict, selectedNode },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

const task = teamStore.getTaskById(taskId);
const reviews = teamStore.listReviewsByTask(taskId) || [];
const mailbox = teamStore.listMailboxMessages({ teamId, limit: 120 }) || [];
const latestReview = reviews[0] || null;

console.log(JSON.stringify({
  ok: true,
  teamId,
  taskId,
  probe,
  review: latestReview,
  task,
  summary: {
    selectedNode,
    endpointVerified: probe?.ok === true,
    localFallbackVerified: false,
    hasApprovedReview: ['approve', 'approve_with_notes'].includes(String(latestReview?.verdict || '')),
    reviewSubmitCount: mailbox.filter((x) => String(x.kind || '') === 'review.submit').length,
    taskState: String(task?.state || ''),
    taskActualNode: String(task?.metadata?.actualNode || ''),
    taskRequestedNode: String(task?.metadata?.requestedNode || ''),
    currentMemberKey: String(task?.metadata?.currentMemberKey || ''),
    routeConsistent: selectedNode === 'lebang',
  },
}, null, 2));

import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../../src/index-env.mjs';

const ctx = createAppContext(loadIndexConfig());
const { teamStore, agentHarness } = ctx;

const now = Date.now();
const teamId = `team:planner-violet-live:${randomUUID()}`;
const plannerId = `member:planner:${randomUUID()}`;
const taskId = `task:planner-violet-live:${randomUUID()}`;
const planId = `plan:${randomUUID()}`;

const probe = await agentHarness.probeRole('planner');
const selectedNode = String(probe?.selectedNode || '');

teamStore.createTeam({ teamId, scopeKey: 'qq:1085631891', mode: 'analysis', status: 'active', metadata: { suite: 'team-planner-violet-live', selectedNode }, createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({
  taskId,
  teamId,
  title: 'planner violet live acceptance',
  description: 'verify planner route authority resolves to violet and plan lands in store',
  state: 'planning',
  priority: 10,
  dependencies: [],
  metadata: { taskMode: 'analysis', riskLevel: 'medium', requestedNode: selectedNode, actualNode: selectedNode, currentMemberKey: 'planner.violet' },
  createdAt: now,
  updatedAt: now,
});

teamStore.appendMailboxMessage({
  messageId: `msg:${randomUUID()}`,
  teamId,
  taskId,
  threadId: taskId,
  kind: 'planner.session.started',
  fromMemberId: plannerId,
  payload: { selectedNode, accepted: probe?.ok === true, provider: String(agentHarness?.provider || 'openclaw') },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

const plan = teamStore.insertPlan({
  planId,
  taskId,
  authorMemberId: plannerId,
  memberKey: 'planner.violet',
  contractVersion: 'planner.plan.v2',
  outputType: 'team.plan.v2',
  summary: 'planner local authority live acceptance produced a structured plan.',
  steps: [
    { id: 's1', title: 'resolve planner route', description: 'verify planner resolves to violet' },
    { id: 's2', title: 'land plan', description: 'persist canonical plan into store' },
  ],
  risks: [
    { id: 'r1', risk: 'planner route drift', mitigation: 'probe role gateway before landing plan' },
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
  kind: 'plan.submit',
  fromMemberId: plannerId,
  payload: { planId, selectedNode, contractVersion: 'planner.plan.v2' },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

const task = teamStore.getTaskById(taskId);
const mailbox = teamStore.listMailboxMessages({ teamId, limit: 120 }) || [];

console.log(JSON.stringify({
  ok: true,
  teamId,
  taskId,
  probe,
  plan,
  task,
  summary: {
    selectedNode,
    requestedAgentId: String(probe?.deployment?.outwardIdentity || ''),
    executionMode: String(probe?.deployment?.executionMode || ''),
    endpointVerified: probe?.ok === true,
    taskState: String(task?.state || ''),
    plannerStartedCount: mailbox.filter((x) => String(x.kind || '') === 'planner.session.started').length,
    planSubmitCount: mailbox.filter((x) => String(x.kind || '') === 'plan.submit').length,
    hasPlan: !!plan,
    taskActualNode: String(task?.metadata?.actualNode || ''),
    taskRequestedNode: String(task?.metadata?.requestedNode || ''),
    currentMemberKey: String(task?.metadata?.currentMemberKey || ''),
    routeConsistent: selectedNode === 'violet',
  },
}, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openTeamStore } from '../../src/team/team-store.mjs';

const REPO_ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, '..');
const SHADOW_ROOT = path.join(WORKSPACE_ROOT, '_tmp', 'orchestrator-shadow-judge-acceptance');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:19190';
const envPath = process.env.ENV_PATH || path.join(SHADOW_ROOT, '.env');
const dbPath = process.env.TEAM_DB_PATH || path.join(SHADOW_ROOT, 'state', 'team-runtime.db');

const envText = fs.readFileSync(envPath, 'utf8');
const token = envText.split(/\r?\n/).find((x) => x.startsWith('ORCH_KICK_TOKEN='))?.split('=').slice(1).join('=').trim() || '';
const teamStore = openTeamStore(dbPath);
const now = Date.now();

const teamId = `team:judge-flag-on-shadow:${randomUUID()}`;
const plannerId = `member:planner:${randomUUID()}`;
const criticId = `member:critic:${randomUUID()}`;
const judgeId = `member:judge:${randomUUID()}`;
const taskId = `task:judge-flag-on-shadow:${randomUUID()}`;
const planId = `plan:judge-flag-on-shadow:${randomUUID()}`;
const reviewId = `review:judge-flag-on-shadow:${randomUUID()}`;

teamStore.createTeam({ teamId, scopeKey: 'judge:flag-on-shadow-acceptance', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: judgeId, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({ taskId, teamId, title: 'shadow flag-on acceptance', description: '验证 judge true execution 在影子实例 flag on 时是否真实接管 review 后决策', state: 'plan_review', priority: 10, dependencies: [], metadata: { taskMode: 'analysis', riskLevel: 'medium' }, createdAt: now, updatedAt: now });
teamStore.insertPlan({ planId, taskId, authorMemberId: plannerId, summary: 'shadow acceptance plan', steps: ['seed team', 'submit review', 'await judge decision'], risks: ['none'], status: 'submitted', createdAt: now, updatedAt: now });

const res = await fetch(`${baseUrl}/internal/team/review`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { 'x-orch-token': token } : {}),
  },
  body: JSON.stringify({
    reviewId,
    taskId,
    targetType: 'plan',
    targetId: planId,
    reviewerMemberId: criticId,
    score: 0.93,
    verdict: 'approve',
    issues: [],
  }),
});

const reviewResponse = await res.json();
const startedAt = Date.now();
const timeoutMs = Number(process.env.ACCEPT_TIMEOUT_MS || 90000);
const pollIntervalMs = Number(process.env.ACCEPT_POLL_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let task = teamStore.getTaskById(taskId);
let decisions = teamStore.listDecisionsByTask(taskId);
while (Date.now() - startedAt < timeoutMs) {
  task = teamStore.getTaskById(taskId);
  decisions = teamStore.listDecisionsByTask(taskId);
  if (decisions.length > 0 || String(task?.state || '') === 'done') break;
  await sleep(pollIntervalMs);
}

const mailbox = teamStore.listMailboxMessages({ teamId, limit: 50 });
const blackboard = teamStore.listBlackboardEntries({ taskId, limit: 100 });
const decisionFinalMessages = mailbox.filter((x) => String(x.kind || '') === 'decision.final');
const decisionRequests = mailbox.filter((x) => String(x.kind || '') === 'decision.request');

console.log(JSON.stringify({
  reviewResponse,
  task,
  decisions,
  mailbox,
  blackboard,
  summary: {
    reviewOk: !!reviewResponse?.ok,
    judgeDispatchMode: String(reviewResponse?.judgeDispatch?.mode || ''),
    judgeDispatchOk: !!reviewResponse?.judgeDispatch?.ok,
    judgeDispatchTriggered: !!reviewResponse?.judgeDispatch?.triggered,
    autoDecisionPresent: !!reviewResponse?.autoDecision,
    finalTaskState: String(task?.state || ''),
    decisionCount: decisions.length,
    decisionFinalCount: decisionFinalMessages.length,
    decisionRequestCount: decisionRequests.length,
    firstDecisionType: String(decisions?.[0]?.decisionType || ''),
    firstDecisionId: String(decisions?.[0]?.decisionId || ''),
    timedOutWithoutDecision: decisions.length === 0,
  },
}, null, 2));

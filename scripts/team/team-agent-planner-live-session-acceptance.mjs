import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { loadLiveEnvToken } from '../../src/index-host-config.mjs';

const config = loadIndexConfig();
process.env.ORCH_KICK_TOKEN = loadLiveEnvToken('ORCH_KICK_TOKEN', config);

const ctx = createAppContext(config);
const { teamStore, teamAgentSessionRunner, plannerFileCompletionProvider } = ctx;
const now = Date.now();
const teamId = `team:planner-live:${randomUUID()}`;
const plannerId = `member:planner:${randomUUID()}`;
const taskId = `task:planner-live:${randomUUID()}`;
teamStore.createTeam({ teamId, scopeKey: 'qq:1085631891', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({ taskId, teamId, title: 'planner live session acceptance', description: 'verify planner session runner can accept real completion and land plan', state: 'planning', priority: 10, dependencies: [], metadata: { taskMode: 'analysis', riskLevel: 'medium' }, createdAt: now, updatedAt: now });

const runPromise = teamAgentSessionRunner.runPlannerTask({ teamId, taskId, plannerMemberId: plannerId, timeoutMs: 120000 });
const mailboxWait = async () => {
  for (let i = 0; i < 120; i++) {
    const mailbox = teamStore.listMailboxMessages({ teamId, limit: 100 }) || [];
    const started = mailbox.find((x) => String(x.kind || '') === 'planner.session.started');
    if (started) return started;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};
const started = await mailboxWait();
if (!started) throw new Error('planner_session_not_started');
const runId = String(started?.payload?.runId || '');
const childSessionKey = String(started?.payload?.childSessionKey || '');
plannerFileCompletionProvider.publishPlannerCompletion({
  runId,
  childSessionKey,
  taskId,
  completion: {
    runId,
    childSessionKey,
    text: JSON.stringify({
      ok: true,
      type: 'team.plan.v2',
      contractVersion: 'planner.plan.v2',
      summary: 'planner live session acceptance produced a structured plan.',
      steps: ['inspect runtime wiring', 'publish completion', 'verify landed plan'],
      risks: ['session output contract may still drift'],
      successCriteria: ['plan_is_actionable', 'steps_are_ordered', 'risks_are_explicit'],
      evidenceRequirements: ['task_context_cited', 'steps_have_exit_criteria', 'risks_have_mitigation'],
      source: 'planner_live_session_acceptance',
    }),
  },
});
const out = await runPromise;
const plan = teamStore.getLatestPlanByTask(taskId);
const task = teamStore.getTaskById(taskId);
const mailbox = teamStore.listMailboxMessages({ teamId, limit: 100 }) || [];
console.log(JSON.stringify({
  out,
  plan,
  task,
  summary: {
    taskState: String(task?.state || ''),
    plannerStartedCount: mailbox.filter((x) => String(x.kind || '') === 'planner.session.started').length,
    planSubmitCount: mailbox.filter((x) => String(x.kind || '') === 'plan.submit').length,
    hasPlan: !!plan,
  },
  mailboxKinds: mailbox.map((x) => x.kind),
}, null, 2));

#!/usr/bin/env node
/**
 * team-executor-violet-live.mjs
 * Executor 正式链路验收脚本（干净版）
 *
 * 验证点：
 * 1. executor runner 可启动真实会话
 * 2. 路由/落点保持 violet
 * 3. completion provider + callback executor 可把结果送进 /internal/team/executor-result
 * 4. artifact / mailbox / task state 均发生真实副作用
 */
import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../../src/index-env.mjs';
import { loadLiveEnvToken } from '../../../src/index-host-config.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadLiveOrchKickToken() {
  return loadLiveEnvToken('ORCH_KICK_TOKEN', loadIndexConfig());
}

async function waitForExecutorStarted(teamStore, teamId, taskId, timeoutMs = 60000) {
  const deadline = Date.now() + Number(timeoutMs || 60000);
  while (Date.now() < deadline) {
    const mailbox = teamStore.listMailboxMessages({ teamId, limit: 200 }) || [];
    const hit = mailbox.find((x) => String(x?.taskId || '') === String(taskId) && String(x?.kind || '') === 'executor.session.started');
    if (hit?.payload?.runId || hit?.payload?.childSessionKey) return hit;
    await sleep(500);
  }
  return null;
}

async function main() {
  console.log('[executor-violet-live] Starting executor chain acceptance...\n');

  const liveToken = loadLiveOrchKickToken();
  if (liveToken) process.env.ORCH_KICK_TOKEN = liveToken;

  const ctx = createAppContext(loadIndexConfig());
  const {
    teamStore,
    executorSessionRunner,
    executorFileCompletionProvider,
    TEAM_ROLE_DEPLOYMENT,
  } = ctx;

  if (!teamStore) throw new Error('teamStore_not_available');
  if (!executorSessionRunner) throw new Error('executorSessionRunner_not_available');
  if (!executorFileCompletionProvider) throw new Error('executorFileCompletionProvider_not_available');

  console.log('[executor-violet-live] ✓ Components loaded');
  console.log(`  - executorSessionRunner.runExecutorTask: ${typeof executorSessionRunner.runExecutorTask === 'function' ? 'ok' : 'MISSING'}`);
  console.log(`  - executorFileCompletionProvider.publishPlannerCompletion: ${typeof executorFileCompletionProvider.publishPlannerCompletion === 'function' ? 'ok' : 'MISSING'}`);

  const deployment = TEAM_ROLE_DEPLOYMENT?.resolve ? TEAM_ROLE_DEPLOYMENT.resolve('executor') : null;
  console.log(`[executor-violet-live] Deployment selectedNode: ${deployment?.selectedNode || 'N/A'}`);

  const now = Date.now();
  const teamId = `team:executor-violet-live:${randomUUID()}`;
  const plannerId = `member:planner:${randomUUID()}`;
  const executorId = `member:executor:${randomUUID()}`;
  const taskId = `task:executor-violet-live:${randomUUID()}`;
  const planId = `plan:${randomUUID()}`;

  teamStore.createTeam({
    teamId,
    scopeKey: 'qq:1085631891',
    mode: 'execution',
    status: 'active',
    metadata: { suite: 'team-executor-violet-live' },
    createdAt: now,
    updatedAt: now,
  });
  teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
  teamStore.createMember({ memberId: executorId, teamId, agentRef: 'executor', role: 'executor', capabilities: ['execution'], status: 'idle', createdAt: now, updatedAt: now });
  teamStore.createTask({
    taskId,
    teamId,
    title: 'executor violet live acceptance',
    description: 'verify executor runner, file completion fallback, and internal executor callback side-effects',
    state: 'approved',
    ownerMemberId: plannerId,
    priority: 10,
    dependencies: [],
    metadata: {
      taskMode: 'execution',
      riskLevel: 'medium',
      requestedNode: 'violet',
      actualNode: 'violet',
      visibilityPolicy: { userVisible: false, teamVisible: true },
    },
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
    summary: 'Use runner.start -> file completion fallback -> internal executor callback -> verify artifact/mailbox/task side-effects.',
    steps: [
      { id: 'step_1', title: 'start executor run', description: 'spawn live executor session on violet' },
      { id: 'step_2', title: 'publish completion file', description: 'provide callback payload through file completion provider' },
      { id: 'step_3', title: 'verify side-effects', description: 'artifacts + mailbox + task state must all be correct' },
    ],
    risks: [
      { id: 'risk_1', risk: 'internal executor callback unauthorized', mitigation: 'load live ORCH_KICK_TOKEN from running orchestrator' },
      { id: 'risk_2', risk: 'fake green from zero side-effects', mitigation: 'require artifactCount>0 and mailboxCount>0 and task=done' },
    ],
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  });

  console.log('[executor-violet-live] ✓ Team/task/plan prepared');

  const runPromise = executorSessionRunner.runExecutorTask({
    teamId,
    taskId,
    executorMemberId: executorId,
    planId,
  });

  const startedMailbox = await waitForExecutorStarted(teamStore, teamId, taskId, 60000);
  if (!startedMailbox) {
    throw new Error(JSON.stringify({ error: 'executor_session_not_started', teamId, taskId }, null, 2));
  }

  const runId = String(startedMailbox?.payload?.runId || '');
  const childSessionKey = String(startedMailbox?.payload?.childSessionKey || '');
  console.log('[executor-violet-live] Session started');
  console.log(`  - runId: ${runId || 'N/A'}`);
  console.log(`  - childSessionKey: ${childSessionKey || 'N/A'}`);
  console.log(`  - accepted: ${startedMailbox?.payload?.accepted === true}`);

  if (!runId && !childSessionKey) {
    throw new Error(JSON.stringify({ error: 'executor_session_started_without_ids', startedMailbox }, null, 2));
  }

  const executorResult = {
    ok: true,
    taskId,
    executorMemberId: executorId,
    contractVersion: 'executor.result.v1',
    outputType: 'team.executor.result.v1',
    summary: 'executor violet live acceptance completed',
    artifacts: [
      { type: 'code', title: 'acceptance.js', body: 'console.log("executor violet live acceptance");' },
      { type: 'documentation', title: 'ACCEPTANCE.md', body: '# executor violet live\n\ncallback path verified.' },
    ],
    evidenceRequirements: ['output_matches_plan', 'artifacts_are_valid'],
  };

  executorFileCompletionProvider.publishPlannerCompletion({
    runId,
    childSessionKey,
    taskId,
    completion: {
      result: {
        taskId,
        executorMemberId: executorId,
        result: executorResult,
      },
    },
  });
  console.log('[executor-violet-live] ✓ File completion published');

  const out = await runPromise;

  const taskAfter = teamStore.getTaskById(taskId);
  const artifacts = teamStore.listArtifactsByTask({ taskId, limit: 200 }) || [];
  const executorArtifacts = artifacts.filter((x) => String(x?.role || '') === 'executor');
  const mailbox = teamStore.listMailboxMessages({ teamId, limit: 200 }) || [];
  const executorResultMailbox = mailbox.filter((x) => String(x?.taskId || '') === String(taskId) && String(x?.kind || '') === 'executor.result');
  const blackboard = teamStore.listBlackboardEntries({ taskId, limit: 200 }) || [];
  const executorTraceEntries = blackboard.filter((x) => String(x?.entryKey || '').includes('executor'));

  console.log('\n' + '='.repeat(60));
  console.log('[executor-violet-live] ACCEPTANCE SUMMARY');
  console.log('='.repeat(60));
  console.log(`taskId: ${taskId}`);
  console.log(`teamId: ${teamId}`);
  console.log(`runId: ${runId}`);
  console.log(`childSessionKey: ${childSessionKey}`);
  console.log(`taskState: ${taskAfter?.state || 'N/A'}`);
  console.log(`actualNode: ${taskAfter?.metadata?.actualNode || 'N/A'}`);
  console.log(`artifacts: ${executorArtifacts.length}`);
  console.log(`mailbox(executor.result): ${executorResultMailbox.length}`);
  console.log(`blackboard(executor*): ${executorTraceEntries.length}`);
  console.log(`delivered.ok: ${out?.delivered?.ok === true}`);

  if (!out?.ok || out?.delivered?.ok !== true) {
    throw new Error(JSON.stringify({ error: 'executor_delivery_failed', out }, null, 2));
  }
  if (String(taskAfter?.state || '') !== 'done') {
    throw new Error(JSON.stringify({ error: 'executor_task_not_done', taskState: taskAfter?.state, out }, null, 2));
  }
  if (String(taskAfter?.metadata?.actualNode || '') !== 'violet') {
    throw new Error(JSON.stringify({ error: 'executor_route_not_violet', actualNode: taskAfter?.metadata?.actualNode, taskAfter }, null, 2));
  }
  if (executorArtifacts.length === 0 || executorResultMailbox.length === 0) {
    throw new Error(JSON.stringify({ error: 'executor_side_effects_missing', artifactCount: executorArtifacts.length, mailboxCount: executorResultMailbox.length }, null, 2));
  }

  console.log('\n[executor-violet-live] ✓ ACCEPTANCE PASSED');
}

main().catch((err) => {
  console.error('[executor-violet-live] ERROR:', err);
  process.exit(1);
});

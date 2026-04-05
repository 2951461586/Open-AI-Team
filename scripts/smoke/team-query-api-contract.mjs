import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { tryHandleHealthStateRoute } from '../../src/routes/index-routes-health-state.mjs';

const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p34-query-api-'));
const dbPath = path.join(runDir, 'team.sqlite');
const now = () => Date.now();

function sendJson(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function fakeRes() {
  return {
    code: 0,
    headers: {},
    body: '',
    writeHead(code, headers = {}) { this.code = code; this.headers = headers; },
    end(body = '') { this.body = String(body || ''); },
  };
}

try {
  const teamStore = openTeamStore(dbPath);
  teamStore.createTeam({ teamId: 'team:p34', scopeKey: 'scope:p34', mode: 'analysis', status: 'active', metadata: {}, createdAt: now(), updatedAt: now() });
  teamStore.createTask({
    taskId: 'task:p34',
    teamId: 'team:p34',
    title: 'p34 stable api fixture',
    description: 'fixture',
    state: 'approved',
    ownerMemberId: 'planner',
    priority: 9,
    dependencies: [],
    metadata: {
      taskClass: 'prod',
      batchId: 'batch:p34',
      runGroup: 'scope:p34',
      phase: 'judge_started',
      currentDriver: 'judge',
      currentMemberKey: 'runtime.laoda',
      requestedRole: 'judge',
      requestedNode: 'laoda',
      actualNode: 'laoda',
      authoritativeNode: 'laoda',
      visibilityPolicy: { userVisible: true, teamVisible: true },
    },
    createdAt: now(),
    updatedAt: now(),
  });
  teamStore.insertPlan({
    planId: 'plan:p34',
    taskId: 'task:p34',
    authorMemberId: 'planner',
    memberKey: 'planner.laoda',
    contractVersion: 'planner.plan.v2',
    outputType: 'team.plan.v2',
    version: 1,
    summary: 'fixture plan',
    steps: ['a'],
    risks: ['r'],
    status: 'submitted',
    createdAt: now(),
    updatedAt: now(),
  });
  teamStore.insertReview({
    reviewId: 'review:p34',
    taskId: 'task:p34',
    targetType: 'plan',
    targetId: 'plan:p34',
    reviewerMemberId: 'critic',
    memberKey: 'critic.laoda',
    contractVersion: 'critic.review.v2',
    outputType: 'team.review.v2',
    score: 0.9,
    verdict: 'approve',
    issues: [],
    createdAt: now(),
  });
  teamStore.insertDecision({
    decisionId: 'decision:p34',
    taskId: 'task:p34',
    judgeMemberId: 'judge',
    memberKey: 'judge.laoda',
    contractVersion: 'judge.decision.v2',
    outputType: 'team.decision.v2',
    decisionType: 'approve',
    reason: 'fixture approve',
    payload: { nextState: 'done' },
    createdAt: now(),
  });

  function call(url) {
    const req = { method: 'GET', url, headers: {} };
    const res = fakeRes();
    const ok = tryHandleHealthStateRoute(req, res, {
      isDashboardAuthorized: () => true,
      sendJson,
      readRecent: () => [],
      parseUrlParam: (input, key) => new URL(input, 'http://127.0.0.1').searchParams.get(key) || '',
      now,
      debateSessions: new Map(),
      debateStore: { dbPath: dbPath + '.debate', count: () => 0, stats: () => ({}) },
      teamStore,
      TEAM_ROLE_DEPLOYMENT: { list: () => [] },
      teamNodeHealth: null,
      teamObserverRuntime: null,
      PORT: 19090,
      DEBATE_MAX_TURNS: 8,
      DEBATE_IDLE_TIMEOUT_MS: 120000,
      DEBATE_MAX_TIMEOUTS: 2,
      DEBATE_DB_CHECKPOINT_MS: 60000,
      DEBATE_DB_CHECKPOINT_MODE: 'passive',
      TEAM_JUDGE_TRUE_EXECUTION: false,
      JUDGE_TRUE_EXECUTION_WIRED: false,
      lastCheckpointAt: null,
    });
    assert.equal(ok, true, `route not handled: ${url}`);
    assert.equal(res.code, 200, `bad status for ${url}: ${res.code}`);
    return JSON.parse(String(res.body || '{}'));
  }

  const contracts = call('/state/team/contracts');
  const root = call('/state/team');
  const summary = call('/state/team/summary?taskId=task:p34');
  const workbench = call('/state/team/workbench?taskId=task:p34');
  const governance = call('/state/team/governance?taskId=task:p34&limit=20');
  const pipeline = call('/state/team/pipeline?taskId=task:p34');
  const board = call('/state/team/board?limit=10');
  const dashboard = call('/state/team/dashboard?limit=10');
  const archive = call('/state/team/archive?limit=10');
  const queue = call('/state/team/queue?limit=10');
  const tasks = call('/state/team/tasks?teamId=team:p34');
  const mailbox = call('/state/team/mailbox?teamId=team:p34&taskId=task:p34');
  const blackboard = call('/state/team/blackboard?taskId=task:p34');
  const artifacts = call('/state/team/artifacts?taskId=task:p34');
  const evidence = call('/state/team/evidence?taskId=task:p34');
  const control = call('/state/team/control?taskId=task:p34');
  const nodes = call('/state/team/nodes');
  const observer = call('/state/team/observer?node=violet');
  const config = call('/state/team/config');

  for (const [name, payload] of Object.entries({ contracts, root, summary, workbench, governance, pipeline, board, dashboard, archive, queue, tasks, mailbox, blackboard, artifacts, evidence, control, nodes, observer, config })) {
    assert.equal(String(payload?.api?.contract || ''), 'team.governance.query.v1', `${name}.api.contract`);
    assert.equal(String(payload?.api?.version || ''), 'v1', `${name}.api.version`);
    assert.ok(payload?.resource && typeof payload.resource === 'object', `${name}.resource`);
    assert.ok(payload?.query && typeof payload.query === 'object', `${name}.query`);
    assert.ok(payload?.links && typeof payload.links === 'object', `${name}.links`);
    assert.equal(String(payload?.links?.contracts || ''), '/state/team/contracts', `${name}.links.contracts`);
  }

  assert.equal(String(contracts?.queryContracts?.contract || ''), 'team.governance.query.v1');
  assert.ok(Array.isArray(contracts?.queryContracts?.featuredRouteKeys));
  assert.equal(String(contracts?.queryContracts?.featuredRoutes?.workbenchPayload?.path || ''), '/state/team/workbench');
  assert.equal(String(contracts?.queryContracts?.featuredRoutes?.residents?.path || ''), '/state/team/residents');
  assert.equal(String(contracts?.queryContracts?.routes?.outputInvestigate?.path || ''), '/state/team/output-investigate');
  assert.equal(String(contracts?.queryContracts?.routes?.workbenchPayload?.path || ''), '/state/team/workbench');
  assert.equal(String(contracts?.queryContracts?.routes?.residents?.path || ''), '/state/team/residents');
  assert.equal(String(summary?.resource?.resourceKind || summary?.api?.resourceKind || ''), 'task_summary');
  assert.equal(String(summary?.currentMemberKey || ''), 'runtime.laoda');
  assert.equal(String(summary?.protocolSource || ''), 'decision');
  assert.equal(String(workbench?.summary?.currentMemberKey || ''), 'runtime.laoda');
  assert.equal(String(workbench?.summary?.protocolSource || ''), 'decision');
  assert.equal(String(workbench?.summary?.protocol?.decision?.contractVersion || ''), 'judge.decision.v2');
  assert.equal(String(governance?.resource?.batchId || ''), 'batch:p34');
  assert.equal(String(governance?.currentMemberKey || ''), 'runtime.laoda');
  assert.equal(String(governance?.protocolSource || ''), 'decision');
  assert.equal(String(pipeline?.pipeline?.currentMemberKey || ''), 'runtime.laoda');
  assert.equal(String(pipeline?.pipeline?.protocolSource || ''), 'decision');
  assert.equal(String(pipeline?.roles?.judge?.contractVersion || ''), 'judge.decision.v2');
  assert.equal(String(board?.board?.columns?.approved?.[0]?.protocolSource || ''), 'decision');
  assert.equal(String(dashboard?.dashboard?.cards?.[0]?.currentMemberKey || ''), 'runtime.laoda');
  assert.equal(String(dashboard?.dashboard?.cards?.[0]?.protocolSource || ''), 'decision');
  assert.equal(String(dashboard?.api?.access || ''), 'dashboard_token');
  assert.equal(String(dashboard?.api?.sensitivity || ''), 'medium');
  assert.equal(String(workbench?.api?.access || ''), 'dashboard_token');
  assert.equal(String(workbench?.api?.sensitivity || ''), 'medium');
  assert.equal(String(mailbox?.api?.access || ''), 'dashboard_token');
  assert.equal(String(mailbox?.api?.sensitivity || ''), 'high');
  assert.equal(String(workbench?.board?.plan?.summary || ''), 'fixture plan');
  assert.equal(Number(workbench?.board?.mailboxCount || 0) >= 0, true);
  assert.equal(Number(queue?.queue?.count || 0) >= 1, true);
  assert.equal(Number(tasks?.resource?.count || 0) >= 1, true);
  assert.ok(Array.isArray(mailbox?.items));
  assert.ok(Array.isArray(blackboard?.items));
  assert.ok(Array.isArray(artifacts?.items));
  assert.ok(Array.isArray(evidence?.items));
  assert.ok(Array.isArray(control?.manualActions));
  assert.equal(String(control?.controlEndpoint || ''), '/internal/team/control');
  assert.ok(Array.isArray(control?.examples));
  assert.ok(nodes?.nodes && typeof nodes.nodes === 'object');
  assert.equal(String(observer?.resource?.node || ''), 'node-b');
  assert.ok(Array.isArray(archive?.archive?.items));
  assert.equal(String(config?.resource?.kind || ''), 'team_config');
  assert.equal(String(config?.configStatus?.resolution?.resolution || ''), 'primary');
  assert.equal(String(config?.configStatus?.resolution?.usedLegacy || ''), 'false');

  console.log(JSON.stringify({
    ok: true,
    summary: {
      routes: {
        contracts: contracts.api,
        root: root.api,
        summary: summary.api,
        workbench: workbench.api,
        governance: governance.api,
        pipeline: pipeline.api,
        board: board.api,
        dashboard: dashboard.api,
        archive: archive.api,
        queue: queue.api,
        tasks: tasks.api,
        mailbox: mailbox.api,
        blackboard: blackboard.api,
        artifacts: artifacts.api,
        evidence: evidence.api,
        control: control.api,
        nodes: nodes.api,
        observer: observer.api,
        config: config.api,
      },
      sample: {
        summaryResource: summary.resource,
        governanceResource: governance.resource,
        pipelineResource: pipeline.resource,
        boardLinks: board.links,
        dashboardLinks: dashboard.links,
        tasksResource: tasks.resource,
        mailboxResource: mailbox.resource,
        blackboardResource: blackboard.resource,
        artifactsResource: artifacts.resource,
        evidenceResource: evidence.resource,
        controlResource: control.resource,
        controlExamples: control.examples,
        nodesResource: nodes.resource,
        observerResource: observer.resource,
        configResource: config.resource,
        configStatus: config.configStatus,
      },
    },
  }, null, 2));
} finally {
  fs.rmSync(runDir, { recursive: true, force: true });
}

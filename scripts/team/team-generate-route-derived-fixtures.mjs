import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { tryHandleHealthStateRoute } from '../../src/routes/index-routes-health-state.mjs';

const root = process.cwd();
const outDir = path.join(root, 'fixtures', 'public-contracts', 'derived');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-public-fixtures-'));
const dbPath = path.join(tmpDir, 'team.sqlite');
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

function stripEnvelope(payload = {}) {
  const out = { ...(payload || {}) };
  delete out.api;
  delete out.resource;
  delete out.query;
  delete out.links;
  return out;
}

try {
  const teamStore = openTeamStore(dbPath);
  teamStore.createTeam({ teamId: 'team:fixture-derived', scopeKey: 'scope:fixture-derived', mode: 'analysis', status: 'active', metadata: {}, createdAt: now(), updatedAt: now() });
  teamStore.createTask({
    taskId: 'task:fixture-derived',
    teamId: 'team:fixture-derived',
    title: 'derived fixture task',
    description: 'derived fixture',
    state: 'approved',
    ownerMemberId: 'judge',
    priority: 9,
    dependencies: [],
    metadata: {
      taskClass: 'prod',
      batchId: 'batch:fixture-derived',
      runGroup: 'scope:fixture-derived',
      phase: 'judge_started',
      currentDriver: 'judge',
      currentMemberKey: 'runtime.node-a',
      requestedRole: 'judge',
      requestedNode: 'node-a',
      actualNode: 'node-a',
      authoritativeNode: 'node-a',
      sessionMode: 'session',
      sessionPersistent: true,
      sessionKey: 'agent:node-a:judge:1',
      sessionsByRole: { judge: 'agent:node-a:judge:1' },
      followupRoute: '/state/team/control?taskId=task:fixture-derived',
      visibilityPolicy: { userVisible: true, teamVisible: true },
    },
    createdAt: now(),
    updatedAt: now(),
  });
  teamStore.insertPlan({
    planId: 'plan:fixture-derived',
    taskId: 'task:fixture-derived',
    authorMemberId: 'planner',
    memberKey: 'planner.node-a',
    contractVersion: 'planner.plan.v2',
    outputType: 'team.plan.v2',
    version: 1,
    summary: 'derived fixture plan',
    steps: ['step-a'],
    risks: ['risk-a'],
    status: 'submitted',
    createdAt: now(),
    updatedAt: now(),
  });
  teamStore.insertReview({
    reviewId: 'review:fixture-derived',
    taskId: 'task:fixture-derived',
    targetType: 'plan',
    targetId: 'plan:fixture-derived',
    reviewerMemberId: 'critic',
    memberKey: 'critic.node-a',
    contractVersion: 'critic.review.v2',
    outputType: 'team.review.v2',
    score: 0.91,
    verdict: 'approve',
    issues: [{ severity: 'minor', title: 'fixture issue', location: 'plan.1', description: 'minor', suggestion: 'ok' }],
    createdAt: now(),
  });
  teamStore.insertDecision({
    decisionId: 'decision:fixture-derived',
    taskId: 'task:fixture-derived',
    judgeMemberId: 'judge',
    memberKey: 'judge.node-a',
    contractVersion: 'judge.decision.v2',
    outputType: 'team.decision.v2',
    decisionType: 'approve',
    reason: 'derived fixture approve',
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
      TEAM_ROLE_DEPLOYMENT: { list: () => ({ planner: ['node-a'], critic: ['node-a'], judge: ['node-a'] }) },
      teamNodeHealth: {
        getNodeStatusSync: () => ({
          ts: now(),
          'node-a': {
            key: 'node-a',
            label: 'node-a',
            reachable: true,
            latencyMs: 42,
            fallbackReady: true,
            probe: 'control_http',
            activeResidentCount: 3,
            activeResidentRoles: ['planner', 'critic', 'judge'],
            stats: {
              controlPlaneOk: true,
              controlPlaneStatus: 'healthy',
              host: 'node-a-host',
            },
          },
        }),
        computeNodeWeights: () => ({ 'node-a': { weight: 1, reason: 'healthy_primary' } }),
        selectBestNode: () => ({ selectedNode: 'node-a', degraded: false, degradedReason: '' }),
      },
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
    if (!ok || res.code !== 200) throw new Error(`route_failed ${url} status=${res.code}`);
    return JSON.parse(String(res.body || '{}'));
  }

  const derivedFixtures = {
    'dashboard-summary-payload.derived.fixture.json': stripEnvelope(call('/state/team/summary?taskId=task:fixture-derived')),
    'dashboard-workbench-payload.derived.fixture.json': stripEnvelope(call('/state/team/workbench?taskId=task:fixture-derived')),
    'dashboard-pipeline-payload.derived.fixture.json': stripEnvelope(call('/state/team/pipeline?taskId=task:fixture-derived')),
    'dashboard-control-payload.derived.fixture.json': stripEnvelope(call('/state/team/control?taskId=task:fixture-derived')),
    'dashboard-board-payload.derived.fixture.json': stripEnvelope(call('/state/team/board?limit=10')),
    'dashboard-dashboard-payload.derived.fixture.json': stripEnvelope(call('/state/team/dashboard?limit=10')),
    'dashboard-nodes-payload.derived.fixture.json': stripEnvelope(call('/state/team/nodes')),
    'dashboard-threads-payload.derived.fixture.json': stripEnvelope(call('/state/team/threads?taskId=task:fixture-derived&limit=10')),
    'dashboard-thread-detail-payload.derived.fixture.json': stripEnvelope(call('/state/team/thread-summary?threadId=task:fixture-derived')),
  };

  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, payload] of Object.entries(derivedFixtures)) {
    fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({ ok: true, outDir, files: Object.keys(derivedFixtures) }, null, 2));
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

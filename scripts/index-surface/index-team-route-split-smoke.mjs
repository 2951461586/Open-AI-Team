import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { openTeamStore } from '../../src/team/team-store.mjs';

const SOURCE_ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const WORKSPACE_ROOT = path.resolve(SOURCE_ROOT, '..');
const TMP_ROOT = path.join(WORKSPACE_ROOT, '_tmp');
const NODE_BIN = process.execPath;
const token = `team-route-split-${randomUUID()}`;

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const picked = typeof addr === 'object' && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(picked)));
    });
  });
}

const port = await getFreePort();
const runDir = path.join(TMP_ROOT, `index-team-route-split-${randomUUID()}`);
const shadowRoot = path.join(runDir, 'orchestrator-shadow');
fs.mkdirSync(runDir, { recursive: true });
fs.cpSync(SOURCE_ROOT, shadowRoot, { recursive: true });

const debateDb = path.join(runDir, 'debates.db');
const teamDb = path.join(runDir, 'team-runtime.db');
const logFile = path.join(runDir, 'server.log');
const envPath = path.join(shadowRoot, '.env');
const sourceEnvPath = fs.existsSync(path.join(SOURCE_ROOT, '.env'))
  ? path.join(SOURCE_ROOT, '.env')
  : path.join(SOURCE_ROOT, '.env.example');
const baseEnv = fs.existsSync(sourceEnvPath) ? fs.readFileSync(sourceEnvPath, 'utf8') : '';
fs.writeFileSync(
  envPath,
  `${baseEnv}\nPORT=${port}\nORCH_KICK_TOKEN=${token}\nDEBATE_DB_PATH=${debateDb}\nTEAM_DB_PATH=${teamDb}\nTEAM_REROUTE_JUDGE_STUB=1\nNODE_ENV=production\n`,
  'utf8',
);

function requestJson(method, targetPath, body = null, withToken = true) {
  return new Promise((resolve, reject) => {
    const raw = body == null ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (raw) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(raw.length);
    }
    if (withToken) headers['x-orch-token'] = token;
    const req = http.request({ hostname: '127.0.0.1', port, path: targetPath, method, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(buf || '{}') });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

async function waitForHealth() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const out = await requestJson('GET', '/health', null, false);
      if (out?.status === 200 && out?.body?.ok) return out;
    } catch {}
    await delay(200);
  }
  throw new Error('health_timeout');
}

const child = spawn(NODE_BIN, ['src/index.mjs'], {
  cwd: shadowRoot,
  env: {
    ...process.env,
    PORT: String(port),
    ORCH_KICK_TOKEN: token,
    DEBATE_DB_PATH: debateDb,
    TEAM_DB_PATH: teamDb,
    TEAM_REROUTE_JUDGE_STUB: '1',
    NODE_ENV: 'production',
    BIND: '0.0.0.0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (c) => fs.appendFileSync(logFile, c));
child.stderr.on('data', (c) => fs.appendFileSync(logFile, c));

try {
  const health = await waitForHealth();
  const teamStore = openTeamStore(teamDb);
  const now = Date.now();
  const teamId = `team:route-split:${randomUUID()}`;
  const plannerMemberId = `member:planner:${randomUUID()}`;
  const criticMemberId = `member:critic:${randomUUID()}`;
  const judgeMemberId = `member:judge:${randomUUID()}`;

  teamStore.createTeam({ teamId, scopeKey: 'group:1085631891', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
  teamStore.createMember({ memberId: plannerMemberId, teamId, role: 'planner', agentId: 'planner', capabilities: ['task.assign'], status: 'idle', createdAt: now, updatedAt: now });
  teamStore.createMember({ memberId: criticMemberId, teamId, role: 'critic', agentId: 'critic', capabilities: ['review.request'], status: 'idle', createdAt: now, updatedAt: now });
  teamStore.createMember({ memberId: judgeMemberId, teamId, role: 'judge', agentId: 'judge', capabilities: ['decision.request'], status: 'idle', createdAt: now, updatedAt: now });

  const seededTaskId = `task:route-split:${randomUUID()}`;
  const taskOut = await requestJson('POST', '/internal/team/task', {
    taskId: seededTaskId,
    teamId,
    title: 'verify index team route split',
    description: 'route split smoke',
    state: 'pending',
    priority: 10,
    metadata: { source: 'index-team-route-split-smoke' },
  });

  const taskId = String(taskOut?.body?.task?.taskId || taskOut?.body?.taskId || seededTaskId || '');
  const planOut = await requestJson('POST', '/internal/team/plan', {
    taskId,
    authorMemberId: plannerMemberId,
    summary: 'team route split plan smoke',
    steps: ['create task', 'create plan', 'create review'],
  });

  const reviewOut = await requestJson('POST', '/internal/team/review', {
    taskId,
    reviewerMemberId: criticMemberId,
    verdict: 'revise',
    score: 0.6,
    summary: 'needs revision',
    risks: ['smoke'],
    recommendations: ['iterate'],
  });

  const decisionOut = await requestJson('POST', '/internal/team/decision', {
    taskId,
    decisionType: 'approve',
    reason: 'route split smoke decision',
  });

  const unauthorizedReroute = await requestJson('POST', '/internal/team/reroute/consume', { taskId, rerouteRequestId: 'missing', actor: 'smoke' }, false);
  const authorizedBadReroute = await requestJson('POST', '/internal/team/reroute/consume', { actor: 'smoke' }, true);
  const task = taskId ? teamStore.getTaskById(taskId) : null;
  const mailbox = teamStore.listMailboxMessages({ teamId, limit: 120 });

  const summary = {
    healthOk: !!health?.body?.ok,
    healthPort: Number(health?.body?.port || 0),
    healthTeamDbMatches: String(health?.body?.team?.db?.path || '') === teamDb,
    taskStatus: taskOut.status,
    taskOk: !!taskOut?.body?.ok,
    taskCreated: !!taskId,
    planStatus: planOut.status,
    planRetired: planOut.status === 410 && String(planOut?.body?.error || '') === 'pipeline_retired',
    reviewStatus: reviewOut.status,
    reviewRetired: reviewOut.status === 410 && String(reviewOut?.body?.error || '') === 'pipeline_retired',
    decisionStatus: decisionOut.status,
    decisionRetired: decisionOut.status === 410 && String(decisionOut?.body?.error || '') === 'pipeline_retired',
    unauthorizedRerouteStatus: unauthorizedReroute.status,
    unauthorizedRerouteError: String(unauthorizedReroute?.body?.error || ''),
    authorizedBadRerouteStatus: authorizedBadReroute.status,
    authorizedBadRerouteError: String(authorizedBadReroute?.body?.error || ''),
    persistedTaskState: String(task?.state || ''),
    routingDecidedCount: mailbox.filter((x) => String(x.kind || '') === 'routing.decided').length,
    reviewRequestCount: mailbox.filter((x) => String(x.kind || '') === 'review.request').length,
    decisionRequestCount: mailbox.filter((x) => String(x.kind || '') === 'decision.request').length,
    logHasListening: fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes(`[orchestrator] listening on 0.0.0.0:${port}`),
    runDir,
  };

  const ok = summary.healthOk
    && summary.healthTeamDbMatches
    && summary.taskStatus === 200
    && summary.taskOk
    && summary.taskCreated
    && summary.planRetired
    && summary.reviewRetired
    && summary.decisionRetired
    && summary.unauthorizedRerouteStatus === 401
    && summary.unauthorizedRerouteError === 'unauthorized'
    && summary.authorizedBadRerouteStatus === 410
    && summary.authorizedBadRerouteError === 'pipeline_retired'
    && summary.logHasListening;

  console.log(JSON.stringify({ summary }, null, 2));
  if (!ok) process.exit(1);
} finally {
  child.kill('SIGTERM');
  await delay(300);
  if (!child.killed) child.kill('SIGKILL');
}

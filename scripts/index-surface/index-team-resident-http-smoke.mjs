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
const token = `team-resident-http-${randomUUID()}`;
const dashboardToken = `dashboard-${randomUUID()}`;
const runDir = path.join(TMP_ROOT, `index-team-resident-http-${randomUUID()}`);
const shadowRoot = path.join(runDir, 'orchestrator-shadow');
fs.mkdirSync(runDir, { recursive: true });
fs.cpSync(SOURCE_ROOT, shadowRoot, { recursive: true });

const debateDb = path.join(runDir, 'debates.db');
const teamDb = path.join(runDir, 'team-runtime.db');
const logFile = path.join(runDir, 'server.log');
const envPath = path.join(shadowRoot, '.env');

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
const baseEnv = fs.readFileSync(path.join(SOURCE_ROOT, '.env'), 'utf8');
fs.writeFileSync(
  envPath,
  `${baseEnv}\nPORT=${port}\nORCH_KICK_TOKEN=${token}\nDASHBOARD_TOKEN=${dashboardToken}\nDEBATE_DB_PATH=${debateDb}\nTEAM_DB_PATH=${teamDb}\nNODE_ENV=production\n`,
  'utf8',
);

function requestJson(method, targetPath, body = null, withToken = true, withDashboardToken = false) {
  return new Promise((resolve, reject) => {
    const raw = body == null ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (raw) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(raw.length);
    }
    if (withToken) headers['x-orch-token'] = token;
    if (withDashboardToken) {
      headers['x-dashboard-token'] = dashboardToken;
      headers.authorization = `Bearer ${dashboardToken}`;
    }
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

const child = spawn(NODE_BIN, ['apps/api-server/src/index.mjs'], {
  cwd: shadowRoot,
  env: {
    ...process.env,
    PORT: String(port),
    ORCH_KICK_TOKEN: token,
    DASHBOARD_TOKEN: dashboardToken,
    DEBATE_DB_PATH: debateDb,
    TEAM_DB_PATH: teamDb,
    NODE_ENV: 'production',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (c) => fs.appendFileSync(logFile, c));
child.stderr.on('data', (c) => fs.appendFileSync(logFile, c));

try {
  const health = await waitForHealth();
  const teamStore = openTeamStore(teamDb);
  const now = Date.now();
  const teamId = `team:resident-http:${randomUUID()}`;
  teamStore.createTeam({ teamId, scopeKey: 'acceptance:resident:http', mode: 'runtime', status: 'active', createdAt: now, updatedAt: now });

  const residentsBefore = await requestJson('GET', `/state/team/residents?teamId=${encodeURIComponent(teamId)}`);
  const directMsg = teamStore.appendMailboxMessage({
    messageId: `msg:${randomUUID()}`,
    teamId,
    taskId: 'task:resident-http',
    kind: 'review.request',
    fromMemberId: 'runtime',
    toMemberId: 'critic.lebang',
    payload: { source: 'acceptance' },
    status: 'delivered',
    createdAt: now,
    deliveredAt: now,
  });

  const heartbeat = await requestJson('POST', '/internal/team/resident/heartbeat', {
    teamId,
    role: 'critic',
    memberId: 'critic.lebang',
    taskId: 'task:resident-http',
    status: 'busy',
    node: 'lebang',
    memberKey: 'critic.lebang',
    runId: 'run:resident-http',
    childSessionKey: 'sess:resident-http',
    degraded: false,
    leaseMs: 500,
    mailboxKind: 'resident.heartbeat',
  }, true, false);

  await delay(20);
  const inbox = await requestJson('GET', `/state/team/inbox?teamId=${encodeURIComponent(teamId)}&memberId=${encodeURIComponent('critic.lebang')}&taskId=${encodeURIComponent('task:resident-http')}`, null, false);
  await delay(1200);
  const sweep = await requestJson('POST', '/internal/team/resident/sweep', { teamId, idleStatus: 'idle' });
  const residentsAfter = await requestJson('GET', `/state/team/residents?teamId=${encodeURIComponent(teamId)}`, null, false);
  const mailbox = await requestJson('GET', `/state/team/mailbox?teamId=${encodeURIComponent(teamId)}&taskId=${encodeURIComponent('task:resident-http')}`, null, false, true);

  const residentItemsBefore = residentsBefore?.body?.residents || [];
  const residentItemsAfter = residentsAfter?.body?.residents || [];
  const criticAfter = residentItemsAfter.find((x) => String(x?.memberId || '') === 'critic.lebang');
  const inboxItems = inbox?.body?.items || [];
  const mailboxItems = mailbox?.body?.items || [];

  const summary = {
    healthOk: !!health?.body?.ok,
    healthTeamDbMatches: String(health?.body?.team?.db?.path || '') === teamDb,
    residentsBeforeStatus: residentsBefore.status,
    residentsBootstrapped: residentItemsBefore.some((x) => String(x?.memberId || '') === 'critic.lebang'),
    directMsgKind: String(directMsg?.kind || ''),
    heartbeatStatus: heartbeat.status,
    heartbeatOk: !!heartbeat?.body?.ok,
    heartbeatResidentStatus: String(heartbeat?.body?.resident?.status || ''),
    inboxStatus: inbox.status,
    inboxKinds: inboxItems.map((x) => x.kind),
    sweepStatus: sweep.status,
    sweepOk: !!sweep?.body?.ok,
    sweepCount: Number(sweep?.body?.count || 0),
    residentsAfterStatus: residentsAfter.status,
    criticAfterStatus: String(criticAfter?.status || ''),
    criticAfterDegradedReason: String(criticAfter?.degradedReason || ''),
    mailboxKinds: mailboxItems.map((x) => x.kind),
    logHasListening: fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes(`:${port}`),
    runDir,
  };

  const pass = summary.healthOk
    && summary.healthTeamDbMatches
    && summary.residentsBootstrapped
    && summary.heartbeatStatus === 200
    && summary.heartbeatOk
    && summary.heartbeatResidentStatus === 'busy'
    && summary.inboxStatus === 200
    && summary.inboxKinds.includes('review.request')
    && summary.inboxKinds.includes('resident.heartbeat')
    && summary.sweepStatus === 200
    && summary.sweepOk
    && summary.sweepCount >= 1
    && summary.criticAfterStatus === 'idle'
    && summary.criticAfterDegradedReason === 'lease_expired'
    && summary.mailboxKinds.includes('resident.lease.expired')
    && summary.logHasListening;

  console.log(JSON.stringify({ summary }, null, 2));
  if (!pass) process.exit(1);
} finally {
  child.kill('SIGTERM');
  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(1000).then(() => false),
  ]);
  if (!exited) {
    child.kill('SIGKILL');
    await Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      delay(1000).then(() => false),
    ]);
  }
}

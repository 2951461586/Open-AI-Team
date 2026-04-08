import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const SOURCE_ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const WORKSPACE_ROOT = path.resolve(SOURCE_ROOT, '..');
const TMP_ROOT = path.join(WORKSPACE_ROOT, '_tmp');
const NODE_BIN = process.execPath;

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
const runDir = path.join(TMP_ROOT, `index-health-state-route-split-${randomUUID()}`);
const shadowRoot = path.join(runDir, 'orchestrator-shadow');
fs.mkdirSync(runDir, { recursive: true });
fs.cpSync(SOURCE_ROOT, shadowRoot, { recursive: true });

const teamDb = path.join(runDir, 'team-runtime.db');
const logFile = path.join(runDir, 'server.log');
const dashboardToken = `dashboard-${randomUUID()}`;
const envPath = path.join(shadowRoot, '.env');
const sourceEnvPath = fs.existsSync(path.join(SOURCE_ROOT, '.env'))
  ? path.join(SOURCE_ROOT, '.env')
  : path.join(SOURCE_ROOT, '.env.example');
const baseEnv = fs.existsSync(sourceEnvPath) ? fs.readFileSync(sourceEnvPath, 'utf8') : '';
fs.writeFileSync(
  envPath,
  `${baseEnv}\nPORT=${port}\nTEAM_DB_PATH=${teamDb}\nDASHBOARD_TOKEN=${dashboardToken}\nNODE_ENV=production\n`,
  'utf8',
);

function getJson(targetPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: targetPath, method: 'GET', headers }, (res) => {
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
    req.end();
  });
}

async function waitForHealth() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const out = await getJson('/health');
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
    TEAM_DB_PATH: teamDb,
    DASHBOARD_TOKEN: dashboardToken,
    NODE_ENV: 'production',
    BIND: '0.0.0.0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (c) => fs.appendFileSync(logFile, c));
child.stderr.on('data', (c) => fs.appendFileSync(logFile, c));

try {
  const health = await waitForHealth();
  const recent = await getJson('/state/recent');
  const debate = await getJson('/state/debate');
  const team = await getJson('/state/team');
  const tasks = await getJson('/state/team/tasks?teamId=missing');
  const mailbox = await getJson('/state/team/mailbox?teamId=missing', {
    authorization: `Bearer ${dashboardToken}`,
    'x-dashboard-token': dashboardToken,
  });
  const blackboard = await getJson('/state/team/blackboard?taskId=missing');

  console.log(JSON.stringify({
    summary: {
      healthOk: !!health?.body?.ok,
      healthPort: Number(health?.body?.port || 0),
      healthTeamDbMatches: String(health?.body?.team?.db?.path || '') === teamDb,
      recentRetired: recent.status === 404 && String(recent?.body?.error || '') === 'not_found',
      debateRetired: debate.status === 404 && String(debate?.body?.error || '') === 'not_found',
      teamOk: team.status === 200 && !!team?.body?.ok,
      teamDbMatches: String(team?.body?.db?.path || '') === teamDb,
      tasksOk: tasks.status === 200 && !!tasks?.body?.ok && Array.isArray(tasks?.body?.items),
      mailboxOk: mailbox.status === 200 && !!mailbox?.body?.ok && Array.isArray(mailbox?.body?.items),
      blackboardOk: blackboard.status === 200 && !!blackboard?.body?.ok && Array.isArray(blackboard?.body?.items),
      logHasListening: fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes(`[orchestrator] listening on 0.0.0.0:${port}`),
      runDir,
    },
  }, null, 2));
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

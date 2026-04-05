import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { openTeamStore } from '../../src/team/team-store.mjs';

const sourceRoot = path.resolve(new URL('../../', import.meta.url).pathname);
const workspaceRoot = path.resolve(sourceRoot, '..');
const token = `remaining-surface-${randomUUID()}`;

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
const runDir = path.join(workspaceRoot, '_tmp', `index-remaining-surface-split-${randomUUID()}`);
const shadowRoot = path.join(runDir, 'orchestrator-shadow');
fs.mkdirSync(runDir, { recursive: true });
fs.cpSync(sourceRoot, shadowRoot, { recursive: true });

const teamDb = path.join(runDir, 'team-runtime.db');
const logFile = path.join(runDir, 'server.log');
const envPath = path.join(shadowRoot, '.env');
const sourceEnvPath = fs.existsSync(path.join(sourceRoot, '.env'))
  ? path.join(sourceRoot, '.env')
  : path.join(sourceRoot, '.env.example');
const baseEnv = fs.existsSync(sourceEnvPath) ? fs.readFileSync(sourceEnvPath, 'utf8') : '';
fs.writeFileSync(
  envPath,
  `${baseEnv}
PORT=${port}
ORCH_KICK_TOKEN=${token}
TEAM_DB_PATH=${teamDb}
TEAM_REROUTE_JUDGE_STUB=1
NODE_ENV=production
`,
  'utf8',
);

function requestJson(method, targetPath, body = null, withToken = true, rawBody = null) {
  return new Promise((resolve, reject) => {
    const raw = rawBody != null ? Buffer.from(String(rawBody)) : (body == null ? null : Buffer.from(JSON.stringify(body)));
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
        let parsed = null;
        try { parsed = JSON.parse(buf || '{}'); } catch {}
        resolve({ status: res.statusCode || 0, body: parsed, raw: buf, headers: res.headers });
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

const child = spawn(process.execPath, ['src/index.mjs'], {
  cwd: shadowRoot,
  env: {
    ...process.env,
    PORT: String(port),
    ORCH_KICK_TOKEN: token,
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

  const webhookOut = await requestJson('POST', '/webhook/qq', {
    sender_id: '10001',
    senderId: '10001',
    text: '你好',
    message_type: 'private',
    room: 'dm-smoke',
    message_id: 'msg-simple',
    originNode: 'laoda',
  }, false);

  const ingressTeamOut = await requestJson('POST', '/internal/team/ingress', {
    kind: 'team.async_ingress.v1',
    payload: {
      messageId: 'msg-team',
      scopeKey: 'group:2999990002',
      deliveryTarget: '2999990002',
      recipientId: '2999990002',
      recipientType: 'group',
      senderId: '20001',
      originNode: 'violet',
      channel: 'external',
      text: '请深度分析 Orchestrator 升级为 AI Team Runtime 的路线图',
      taskMode: 'analysis',
      riskLevel: 'medium'
    }
  }, true);

  const governanceUnauthorized = await requestJson('GET', '/internal/debate/governance/debate:test', null, false);
  const governanceBad = await requestJson('GET', '/internal/debate/governance/', null, true);
  const governanceEmpty = await requestJson('GET', '/internal/debate/governance/debate:test?factsLimit=5&timelineLimit=10', null, true);
  const governanceSummaryUnauthorized = await requestJson('GET', '/internal/debate/governance', null, false);
  const governanceSummaryBad = await requestJson('GET', '/internal/debate/governance?limit=0', null, true);
  const governanceSummaryEmpty = await requestJson('GET', '/internal/debate/governance?limit=5', null, true);

  const receiptUnauthorized = await requestJson('POST', '/internal/commands/receipt', { ok: 1 }, false);
  const receiptBad = await requestJson('POST', '/internal/commands/receipt', {}, true);

  const summary = {
    healthOk: !!health?.body?.ok,
    healthPort: Number(health?.body?.port || 0),
    healthTeamDbMatches: String(health?.body?.team?.db?.path || '') === teamDb,
    webhookStatus: webhookOut.status,
    webhookJson: !!webhookOut.body,
    ingressTeamStatus: ingressTeamOut.status,
    ingressTeamHasTeam: !!ingressTeamOut.body?.team?.teamId,
    governanceUnauthorizedStatus: governanceUnauthorized.status,
    governanceBadStatus: governanceBad.status,
    governanceEmptyStatus: governanceEmpty.status,
    governanceSummaryUnauthorizedStatus: governanceSummaryUnauthorized.status,
    governanceSummaryBadStatus: governanceSummaryBad.status,
    governanceSummaryEmptyStatus: governanceSummaryEmpty.status,
    receiptUnauthorizedStatus: receiptUnauthorized.status,
    receiptBadStatus: receiptBad.status,
    logHasListening: fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes(`[orchestrator] listening on 0.0.0.0:${port}`),
    runDir,
    mailboxCount: teamStore.listMailboxMessages({ teamId: String(ingressTeamOut.body?.team?.teamId || ''), limit: 100 }).length,
  };

  console.log(JSON.stringify({ summary }, null, 2));
} finally {
  child.kill('SIGTERM');
  await delay(300);
  if (!child.killed) child.kill('SIGKILL');
}

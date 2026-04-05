import { loadIndexConfig } from '../../src/index-env.mjs';
import { loadHostRuntimeConfig, loadLiveEnvToken } from '../../src/index-host-config.mjs';

const config = loadIndexConfig();
const hostConfig = loadHostRuntimeConfig(config);
const base = String(hostConfig?.local?.controlBaseUrl || 'http://127.0.0.1:19090').replace(/\/$/, '');
const dashboardToken = loadLiveEnvToken('DASHBOARD_TOKEN', config);
if (!dashboardToken) {
  throw new Error('DASHBOARD_TOKEN required for sensitivity guard smoke');
}

async function call(path, headers = {}) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

const protectedPaths = [
  '/state/team/dashboard?limit=1',
  '/state/team/workbench?taskId=missing',
  '/state/team/mailbox?teamId=missing&limit=1',
];

const negative = [];
const positive = [];
for (const path of protectedPaths) {
  negative.push({ path, ...(await call(path)) });
  positive.push({
    path,
    ...(await call(path, {
      'x-dashboard-token': dashboardToken,
      Authorization: `Bearer ${dashboardToken}`,
    })),
  });
}

const ok = negative.every((x) => x.status === 401 && String(x?.data?.error || '') === 'dashboard_unauthorized')
  && positive.every((x) => [200, 404].includes(Number(x.status || 0)));

console.log(JSON.stringify({ ok, negative, positive }, null, 2));
if (!ok) process.exit(1);

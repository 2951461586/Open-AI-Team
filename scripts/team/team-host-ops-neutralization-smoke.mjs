import fs from 'node:fs';

const legacyEnvPath = ['/root', '.openclaw', 'workspace', 'orchestrator', '.env'].join('/');
function containsLegacyEnvRead(source) {
  return source.includes(`readFileSync('${legacyEnvPath}'`) || source.includes(`readFileSync("${legacyEnvPath}"`);
}

let passed = 0;
let failed = 0;
function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const hostConfig = fs.readFileSync(new URL('../../src/index-host-config.mjs', import.meta.url), 'utf8');
const querySdk = fs.readFileSync(new URL('../../src/team/query-api/sdk.mjs', import.meta.url), 'utf8');
const opsAudit = fs.readFileSync(new URL('../../scripts/ops/team-port-config-audit.mjs', import.meta.url), 'utf8');
const asyncIngress = fs.readFileSync(new URL('../../scripts/acceptance/canonical/team-async-ingress-smoke.mjs', import.meta.url), 'utf8');
const asyncIngressMissing = fs.readFileSync(new URL('../../scripts/acceptance/canonical/team-async-ingress-missing-delivery-mode-smoke.mjs', import.meta.url), 'utf8');
const rightpanel = fs.readFileSync(new URL('../../scripts/acceptance/canonical/team-dashboard-rightpanel-deeplink-smoke.mjs', import.meta.url), 'utf8');
const routingMatrix = fs.readFileSync(new URL('../../scripts/acceptance/canonical/team-role-routing-matrix-live.mjs', import.meta.url), 'utf8');
const dashboardGuard = fs.readFileSync(new URL('../../scripts/smoke/team-dashboard-sensitivity-guard.mjs', import.meta.url), 'utf8');
const plannerAcceptance = fs.readFileSync(new URL('../../scripts/team/team-agent-planner-live-session-acceptance.mjs', import.meta.url), 'utf8');
const allTrueAcceptance = fs.readFileSync(new URL('../../scripts/team/team-agent-all-true-joint-acceptance.mjs', import.meta.url), 'utf8');

assert(hostConfig.includes('export function loadLiveEnvToken'), 'host config exports shared live env token helper');
assert(hostConfig.includes('export function readServiceEnv'), 'host config exports shared service env helper');
assert(hostConfig.includes('export function resolveListeningPid'), 'host config exports shared listening pid helper');

assert(querySdk.includes('loadLiveEnvToken'), 'query sdk consumes shared host token helper');
assert(!containsLegacyEnvRead(querySdk), 'query sdk no longer reads orchestrator .env directly');
assert(!querySdk.includes('systemctl --user show -p MainPID --value orchestrator.service'), 'query sdk no longer shells service main pid directly');

assert(opsAudit.includes('loadHostRuntimeConfig'), 'ops audit consumes host runtime config surface');
assert(opsAudit.includes('readServiceEnv'), 'ops audit consumes shared service env helper');
assert(!opsAudit.includes('function readOrchestratorServiceEnv'), 'ops audit no longer defines local orchestrator service env helper');

for (const [label, source] of [
  ['async ingress acceptance', asyncIngress],
  ['async ingress missing-delivery acceptance', asyncIngressMissing],
  ['dashboard deeplink acceptance', rightpanel],
  ['role routing matrix acceptance', routingMatrix],
  ['dashboard sensitivity guard smoke', dashboardGuard],
  ['planner live acceptance', plannerAcceptance],
  ['all true joint acceptance', allTrueAcceptance],
]) {
  assert(source.includes('loadLiveEnvToken'), `${label} uses shared live token helper`);
  assert(!containsLegacyEnvRead(source), `${label} no longer hardcodes orchestrator .env path`);
  assert(!source.includes('systemctl --user show orchestrator.service'), `${label} no longer hardcodes orchestrator.service env probing`);
}

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-host-ops-neutralization.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);

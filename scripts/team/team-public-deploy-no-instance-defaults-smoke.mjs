import fs from 'node:fs';

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.error(`❌ ${label}`);
  }
}

const deploy = fs.readFileSync(new URL('../../scripts/deploy/dashboard-cloudbase.sh', import.meta.url), 'utf8');
const deployDoc = fs.readFileSync(new URL('../../dashboard/DEPLOY-OSS.md', import.meta.url), 'utf8');

assert(!deploy.includes('board.liziai.cloud'), 'deploy script has no board.liziai.cloud default');
assert(!deploy.includes('api.liziai.cloud'), 'deploy script has no api.liziai.cloud default');
assert(!deploy.includes('/root/.openclaw/credentials/tencent-cloud'), 'deploy script has no .openclaw credentials default');
assert(!deploy.includes('/root/.config/systemd/user/orchestrator.service.d/10-judge.conf'), 'deploy script has no systemd override default');
assert(deploy.includes('NEXT_PUBLIC_API_BASE is required'), 'deploy script fails fast on missing API base');
assert(deploy.includes('NEXT_PUBLIC_WS_URL is required'), 'deploy script fails fast on missing WS url');
assert(deployDoc.includes('https://api.example.com'), 'deploy OSS doc uses neutral example API');
assert(deployDoc.includes('/srv/example-dashboard'), 'deploy OSS doc uses neutral example static dir');

console.log(JSON.stringify({ ok: failed === 0, passed, failed }, null, 2));
if (failed > 0) process.exit(1);

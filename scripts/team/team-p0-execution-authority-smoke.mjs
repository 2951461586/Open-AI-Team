import fs from 'node:fs';

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

const selector = fs.readFileSync(new URL('../../src/integrations/host-bootstrap-selector.mjs', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../../src/index-bootstrap.mjs', import.meta.url), 'utf8');
const workbenchRoute = fs.readFileSync(new URL('../../src/routes/team-state/workbench.mjs', import.meta.url), 'utf8');
const summaryRoute = fs.readFileSync(new URL('../../src/routes/team-state/summary.mjs', import.meta.url), 'utf8');
const pipelineRoute = fs.readFileSync(new URL('../../src/routes/team-state/pipeline.mjs', import.meta.url), 'utf8');
const observability = fs.readFileSync(new URL('../../src/routes/team-state/task-observability-shared.mjs', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const architecture = fs.readFileSync(new URL('../../ARCHITECTURE.md', import.meta.url), 'utf8');
const authorityDoc = fs.readFileSync(new URL('../../docs/architecture/execution-state-and-read-model-authority.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(selector.includes("'none'"), 'remote-session integration default is explicit opt-in');
assert(bootstrap.includes('createControlPlaneClient'), 'host-agnostic bootstrap exposes neutral control-plane client contract');
assert(bootstrap.includes('sessionControlPlane,'), 'host-agnostic bootstrap returns sessionControlPlane surface');
assert(observability.includes('deliveryStatus'), 'shared observability derives deliveryStatus');
assert(observability.includes('interventionStatus'), 'shared observability derives interventionStatus');
assert(observability.includes('nextBestAction'), 'shared observability derives nextBestAction');
assert(workbenchRoute.includes('buildTaskObservability'), 'workbench route consumes shared observability authority');
assert(summaryRoute.includes('buildTaskObservability'), 'summary route consumes shared observability authority');
assert(pipelineRoute.includes('buildTaskObservability'), 'pipeline route consumes shared observability authority');
assert(authorityDoc.includes('Execution State and Read-Model Authority'), 'P0 authority doc exists');
assert(authorityDoc.includes('UI does not invent state authority'), 'P0 authority doc forbids UI authority guessing');
assert(readme.includes('execution-state-and-read-model-authority.md'), 'README links P0 execution authority doc');
assert(docsIndex.includes('architecture/execution-state-and-read-model-authority.md'), 'docs index links P0 execution authority doc');
assert(architecture.includes('docs/architecture/execution-state-and-read-model-authority.md'), 'architecture authority order includes P0 execution authority doc');
assert(mainline.includes('team-p0-execution-authority-smoke.mjs'), 'mainline includes P0 execution authority smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-p0-execution-authority.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);

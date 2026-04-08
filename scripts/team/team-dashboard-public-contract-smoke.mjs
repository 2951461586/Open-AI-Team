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

const dashboardTypes = fs.readFileSync(new URL('../../dashboard/src/lib/types.ts', import.meta.url), 'utf8');
const dashboardApi = fs.readFileSync(new URL('../../dashboard/src/lib/api.ts', import.meta.url), 'utf8');
const dashboardReadme = fs.readFileSync(new URL('../../dashboard/README.md', import.meta.url), 'utf8');
const dashboardNextConfig = fs.readFileSync(new URL('../../dashboard/next.config.js', import.meta.url), 'utf8');
const contractsDoc = fs.readFileSync(new URL('../../docs/archive/dashboard-contract-alignment.md', import.meta.url), 'utf8');
const publicSchemasSmoke = fs.readFileSync(new URL('./team-public-schema-fixtures-smoke.py', import.meta.url), 'utf8');
const fixtureGenerator = fs.readFileSync(new URL('./team-generate-route-derived-fixtures.mjs', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../smoke/team-mainline.mjs', import.meta.url), 'utf8');
const schemas = [
  'dashboard-board-payload.schema.json',
  'dashboard-dashboard-payload.schema.json',
  'dashboard-nodes-payload.schema.json',
  'dashboard-threads-payload.schema.json',
  'dashboard-thread-detail-payload.schema.json',
].map((name) => fs.readFileSync(new URL(`../../schemas/${name}`, import.meta.url), 'utf8'));

assert(dashboardTypes.includes('export interface TaskCard'), 'dashboard types export TaskCard');
assert(dashboardTypes.includes('export interface NodeSummary'), 'dashboard types export NodeSummary');
assert(dashboardTypes.includes('export interface ThreadSummaryItem'), 'dashboard types export ThreadSummaryItem');
assert(dashboardTypes.includes('export interface TimelineEntry'), 'dashboard types export TimelineEntry');
assert(dashboardTypes.includes('export interface DashboardResponse'), 'dashboard types export DashboardResponse');
assert(dashboardTypes.includes('export interface NodesResponse'), 'dashboard types export NodesResponse');
assert(dashboardTypes.includes('export interface ThreadSummaryResponse'), 'dashboard types export ThreadSummaryResponse');
assert(dashboardTypes.includes('export interface ThreadDetailResponse'), 'dashboard types export ThreadDetailResponse');
assert(dashboardTypes.includes('export interface WorkbenchSummary'), 'dashboard types export WorkbenchSummary');
assert(dashboardTypes.includes('export interface TaskFocusTarget'), 'dashboard types export task-focus target contract');

assert(dashboardApi.includes('fetchDashboard'), 'dashboard api exposes dashboard fetch');
assert(dashboardApi.includes('fetchNodes'), 'dashboard api exposes nodes fetch');
assert(dashboardApi.includes('fetchWorkbench'), 'dashboard api exposes workbench fetch');
assert(dashboardApi.includes('fetchSummary'), 'dashboard api exposes summary fetch');
assert(dashboardApi.includes('fetchControl'), 'dashboard api exposes control fetch');
assert(dashboardApi.includes('fetchPipeline'), 'dashboard api exposes pipeline fetch');
assert(dashboardApi.includes('fetchResidents'), 'dashboard api exposes residents fetch');
assert(dashboardApi.includes('fetchThreads'), 'dashboard api exposes threads fetch');
assert(dashboardApi.includes('fetchThreadSummary'), 'dashboard api exposes thread summary fetch');
assert(dashboardApi.includes("normalizeDashboardEnvelope"), 'dashboard api reuses shared dashboard envelope normalizer');
assert(dashboardApi.includes("normalizeNodesEnvelope"), 'dashboard api reuses shared nodes envelope normalizer');

for (const schema of schemas) {
  assert(schema.includes('$schema') && schema.includes('$id'), 'dashboard wrapper schema has JSON Schema metadata');
}

assert(publicSchemasSmoke.includes('dashboard-board-payload.schema.json'), 'public schema smoke validates board wrapper schema');
assert(publicSchemasSmoke.includes('dashboard-dashboard-payload.schema.json'), 'public schema smoke validates dashboard wrapper schema');
assert(publicSchemasSmoke.includes('dashboard-nodes-payload.schema.json'), 'public schema smoke validates nodes wrapper schema');
assert(publicSchemasSmoke.includes('dashboard-threads-payload.schema.json'), 'public schema smoke validates threads wrapper schema');
assert(publicSchemasSmoke.includes('dashboard-thread-detail-payload.schema.json'), 'public schema smoke validates thread detail wrapper schema');

assert(fixtureGenerator.includes('dashboard-board-payload.derived.fixture.json'), 'fixture generator emits board derived fixture');
assert(fixtureGenerator.includes('dashboard-dashboard-payload.derived.fixture.json'), 'fixture generator emits dashboard derived fixture');
assert(fixtureGenerator.includes('dashboard-nodes-payload.derived.fixture.json'), 'fixture generator emits nodes derived fixture');
assert(fixtureGenerator.includes('dashboard-threads-payload.derived.fixture.json'), 'fixture generator emits threads derived fixture');
assert(fixtureGenerator.includes('dashboard-thread-detail-payload.derived.fixture.json'), 'fixture generator emits thread detail derived fixture');

assert(dashboardReadme.includes('/state/team/dashboard') && dashboardReadme.includes('/state/team/nodes'), 'dashboard README declares public contract routes');
assert(dashboardReadme.includes('/state/team/threads') && dashboardReadme.includes('/state/team/thread-summary'), 'dashboard README declares thread routes');
assert(dashboardReadme.includes('single-repo build authority'), 'dashboard README documents single-repo build authority');
assert(dashboardNextConfig.includes('externalDir') && dashboardNextConfig.includes('@ai-team/team-core'), 'dashboard build config allows shared team-core read-model import');
assert(contractsDoc.includes('schemas/dashboard-task-card.schema.json'), 'dashboard contract doc references task card schema');
assert(contractsDoc.includes('schemas/dashboard-thread-summary.schema.json'), 'dashboard contract doc references thread summary schema');
assert(contractsDoc.includes('schemas/dashboard-node-summary.schema.json'), 'dashboard contract doc references node summary schema');
assert(mainline.includes('team-dashboard-public-contract-smoke.mjs'), 'mainline includes dashboard public contract smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-dashboard-public-contract.v2',
  },
}, null, 2));

if (failed > 0) process.exit(1);

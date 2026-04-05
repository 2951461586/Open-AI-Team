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

const obs = fs.readFileSync(new URL('../../src/routes/team-state/task-observability-shared.mjs', import.meta.url), 'utf8');
const summaryRoute = fs.readFileSync(new URL('../../src/routes/team-state/summary.mjs', import.meta.url), 'utf8');
const workbenchRoute = fs.readFileSync(new URL('../../src/routes/team-state/workbench.mjs', import.meta.url), 'utf8');
const pipelineRoute = fs.readFileSync(new URL('../../src/routes/team-state/pipeline.mjs', import.meta.url), 'utf8');
const rightPanel = fs.readFileSync(new URL('../../dashboard/src/components/RightPanel.tsx', import.meta.url), 'utf8');
const workbenchPanel = fs.readFileSync(new URL('../../dashboard/src/components/panels/WorkbenchPanel.tsx', import.meta.url), 'utf8');
const types = fs.readFileSync(new URL('../../dashboard/src/lib/types.ts', import.meta.url), 'utf8');
const summarySchema = fs.readFileSync(new URL('../../schemas/dashboard-summary-payload.schema.json', import.meta.url), 'utf8');
const workbenchSchema = fs.readFileSync(new URL('../../schemas/dashboard-workbench-payload.schema.json', import.meta.url), 'utf8');
const pipelineSchema = fs.readFileSync(new URL('../../schemas/dashboard-pipeline-payload.schema.json', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../../docs/architecture/execution-product-surface-and-delivery-closure.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(obs.includes('const deliveryClosure = {'), 'shared observability defines deliveryClosure object');
assert(obs.includes('recommendedSurface'), 'deliveryClosure includes recommendedSurface');
assert(summaryRoute.includes('deliveryClosure: obs.deliveryClosure'), 'summary route exports deliveryClosure');
assert(workbenchRoute.includes('deliveryClosure: obs.deliveryClosure'), 'workbench route exports deliveryClosure');
assert(pipelineRoute.includes('deliveryClosure: obs.deliveryClosure'), 'pipeline route exports deliveryClosure');
assert(types.includes('export interface DeliveryClosure'), 'dashboard types export DeliveryClosure');
assert(types.includes('deliveryClosure?: DeliveryClosure'), 'dashboard types attach deliveryClosure to workbench summary');
assert(workbenchPanel.includes('const deliveryClosure ='), 'workbench panel reads shared deliveryClosure object');
assert(rightPanel.includes("mission: ['mission', 'timeline']"), 'right panel exposes timeline under mission tab group');
assert(rightPanel.includes("detailTab === 'timeline'"), 'right panel renders timeline panel directly');
assert(summarySchema.includes('"deliveryClosure"'), 'summary schema exposes deliveryClosure');
assert(workbenchSchema.includes('"deliveryClosure"'), 'workbench schema exposes deliveryClosure');
assert(pipelineSchema.includes('"deliveryClosure"'), 'pipeline schema exposes deliveryClosure');
assert(doc.includes('single shared delivery-closure object'), 'P1 authority doc exists');
assert(mainline.includes('team-p1-product-surface-delivery-closure-smoke.mjs'), 'mainline includes P1 delivery-closure smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-p1-product-surface-delivery-closure.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);

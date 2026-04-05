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

const healthState = fs.readFileSync(new URL('../../src/routes/index-routes-health-state.mjs', import.meta.url), 'utf8');
const taskTypes = fs.readFileSync(new URL('../../dashboard/src/lib/types.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../../dashboard/src/lib/api.ts', import.meta.url), 'utf8');
const taskCard = fs.readFileSync(new URL('../../dashboard/src/components/TaskCard.tsx', import.meta.url), 'utf8');
const rightPanel = fs.readFileSync(new URL('../../dashboard/src/components/RightPanel.tsx', import.meta.url), 'utf8');
const workbenchDelivery = fs.readFileSync(new URL('../../dashboard/src/components/panels/WorkbenchDeliveryOverviewSection.tsx', import.meta.url), 'utf8');
const taskCardSchema = fs.readFileSync(new URL('../../schemas/dashboard-task-card.schema.json', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../../docs/architecture/mission-workbench-deliverables-boundary.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(healthState.includes('recommendedSurface: obs.deliveryClosure?.recommendedSurface || \'mission\''), 'dashboard/board cards expose recommendedSurface from shared observability');
assert(taskTypes.includes('recommendedSurface?: string'), 'task-card type exposes recommendedSurface');
assert(api.includes('recommendedSurface: String(raw?.recommendedSurface || \'\')'), 'dashboard api normalizes recommendedSurface');
assert(taskCardSchema.includes('"recommendedSurface"'), 'task-card schema exposes recommendedSurface');
assert(rightPanel.includes('normalizeRecommendedDetailTab'), 'right panel normalizes recommended surface');
assert(rightPanel.includes('const preferredTab = normalizeRecommendedDetailTab(selectedTask?.recommendedSurface)'), 'right panel defaults to recommended surface');
assert(taskCard.includes('const surfaceLabel = task.recommendedSurface === \'deliverables\''), 'task-card CTA maps recommended surface labels');
assert(taskCard.includes('进入${surfaceLabel}'), 'task-card CTA copy follows recommended surface');
assert(workbenchDelivery.includes('推进概览'), 'workbench keeps progress-oriented overview label');
assert(workbenchDelivery.includes('请切到交付面确认'), 'workbench defers final acceptance to deliverables');
assert(doc.includes('Mission judges, Workbench drives, Deliverables closes.'), 'P2 boundary authority doc exists');
assert(docsIndex.includes('architecture/mission-workbench-deliverables-boundary.md'), 'docs index includes P2 boundary doc');
assert(mainline.includes('team-p2-mission-workbench-deliverables-boundary-smoke.mjs'), 'mainline includes P2 boundary smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-p2-mission-workbench-deliverables-boundary.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);

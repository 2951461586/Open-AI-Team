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
const utils = fs.readFileSync(new URL('../../dashboard/src/lib/utils.ts', import.meta.url), 'utf8');
const taskCard = fs.readFileSync(new URL('../../dashboard/src/components/TaskCard.tsx', import.meta.url), 'utf8');
const rightPanel = fs.readFileSync(new URL('../../dashboard/src/components/RightPanel.tsx', import.meta.url), 'utf8');
const artifactsPanel = fs.readFileSync(new URL('../../dashboard/src/components/panels/ArtifactsPanel.tsx', import.meta.url), 'utf8');
const workbenchAction = fs.readFileSync(new URL('../../dashboard/src/components/panels/WorkbenchActionSection.tsx', import.meta.url), 'utf8');
const mission = fs.readFileSync(new URL('../../dashboard/src/components/panels/MissionControlPanel.tsx', import.meta.url), 'utf8');
const taskCardSchema = fs.readFileSync(new URL('../../schemas/dashboard-task-card.schema.json', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../../docs/architecture/deliverables-evidence-acceptance-authority.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(healthState.includes('acceptanceState: obs.deliveryClosure?.acceptanceState || \'in_progress\''), 'dashboard/board cards expose acceptanceState from shared observability');
assert(taskTypes.includes('acceptanceState?: string'), 'task-card type exposes acceptanceState');
assert(api.includes('acceptanceState: String(raw?.acceptanceState || \'\')'), 'dashboard api normalizes acceptanceState');
assert(taskCardSchema.includes('"acceptanceState"'), 'task-card schema exposes acceptanceState');
assert(utils.includes('export function acceptanceStateLabel'), 'frontend exposes acceptanceState label helper');
assert(taskCard.includes('const acceptancePulse = task.acceptanceState === \'ready_for_acceptance\''), 'task-card maps acceptance pulse from shared state');
assert(rightPanel.includes('验收态：{acceptanceStateLabel(selectedTask.acceptanceState)}'), 'right panel shows acceptance state chip');
assert(artifactsPanel.includes('最终验收'), 'deliverables panel is framed as final acceptance surface');
assert(artifactsPanel.includes('验收判断：'), 'deliverables panel owns acceptance judgment copy');
assert(artifactsPanel.includes('阻塞证据'), 'deliverables panel exposes blocking evidence cue');
assert(workbenchAction.includes('交付导流'), 'workbench action panel downgrades from closure authority to routing guidance');
assert(mission.includes('建议切到交付面验收'), 'mission panel routes toward deliverables instead of replacing acceptance');
assert(doc.includes('Deliverables is the acceptance authority surface'), 'P3 authority doc exists');
assert(docsIndex.includes('architecture/deliverables-evidence-acceptance-authority.md'), 'docs index includes P3 authority doc');
assert(readme.includes('Deliverables / Evidence / Acceptance authority'), 'README links P3 authority doc');
assert(mainline.includes('team-p3-deliverables-evidence-acceptance-smoke.mjs'), 'mainline includes P3 smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-p3-deliverables-evidence-acceptance.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);

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

const shared = fs.readFileSync(new URL('../../src/routes/team-state/task-observability-shared.mjs', import.meta.url), 'utf8');
const workbench = fs.readFileSync(new URL('../../src/routes/team-state/workbench.mjs', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../../dashboard/src/lib/api.ts', import.meta.url), 'utf8');
const types = fs.readFileSync(new URL('../../dashboard/src/lib/types.ts', import.meta.url), 'utf8');
const artifactsPanel = fs.readFileSync(new URL('../../dashboard/src/components/panels/ArtifactsPanel.tsx', import.meta.url), 'utf8');
const summarySchema = fs.readFileSync(new URL('../../schemas/dashboard-summary-payload.schema.json', import.meta.url), 'utf8');
const workbenchSchema = fs.readFileSync(new URL('../../schemas/dashboard-workbench-payload.schema.json', import.meta.url), 'utf8');
const pipelineSchema = fs.readFileSync(new URL('../../schemas/dashboard-pipeline-payload.schema.json', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../../docs/architecture/terminal-state-archive-evidence-boundary.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(shared.includes('const terminalState = {'), 'shared observability exposes terminalState');
assert(shared.includes('const evidenceRetrieval = {'), 'shared observability exposes evidenceRetrieval');
assert(shared.includes('archiveRoute: \'/state/team/archive?limit=200\''), 'shared observability exposes archive route');
assert(workbench.includes('evidence: `/state/team/evidence?taskId='), 'workbench summaryLinks expose evidence route');
assert(api.includes('export async function fetchTaskEvidence'), 'frontend api exposes evidence fetcher');
assert(types.includes('export interface EvidenceItem'), 'frontend types expose evidence item');
assert(types.includes('terminalState?: TerminalState'), 'deliveryClosure type exposes terminalState');
assert(types.includes('evidenceRetrieval?: EvidenceRetrieval'), 'deliveryClosure type exposes evidenceRetrieval');
assert(artifactsPanel.includes('关键证据'), 'deliverables panel exposes evidence section');
assert(artifactsPanel.includes('阻塞证据'), 'deliverables panel exposes blocking evidence partition');
assert(artifactsPanel.includes('支撑证据'), 'deliverables panel exposes supporting evidence partition');
assert(summarySchema.includes('"terminalState"'), 'summary schema exposes terminalState');
assert(summarySchema.includes('"evidenceRetrieval"'), 'summary schema exposes evidenceRetrieval');
assert(workbenchSchema.includes('"terminalState"'), 'workbench schema exposes terminalState');
assert(workbenchSchema.includes('"evidenceRetrieval"'), 'workbench schema exposes evidenceRetrieval');
assert(pipelineSchema.includes('"terminalState"'), 'pipeline schema exposes terminalState');
assert(pipelineSchema.includes('"evidenceRetrieval"'), 'pipeline schema exposes evidenceRetrieval');
assert(doc.includes('Terminal-state meaning comes from shared observability'), 'P4 boundary doc exists');
assert(docsIndex.includes('architecture/terminal-state-archive-evidence-boundary.md'), 'docs index includes P4 authority doc');
assert(readme.includes('Terminal-state / Archive / Evidence boundary'), 'README links P4 authority doc');
assert(mainline.includes('team-p4-terminal-state-archive-evidence-smoke.mjs'), 'mainline includes P4 smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-p4-terminal-state-archive-evidence.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);

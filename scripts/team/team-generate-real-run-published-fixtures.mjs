import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fixtureRoot = path.join(root, 'fixtures', 'public-contracts', 'real-run');
const sampleRunDir = path.join(root, 'examples', 'oss-minimal', '.runs', 'run-2026-04-03_11-44-09-748');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
  }
  if (typeof value === 'string') {
    return value.split(root).join('/workspace/project');
  }
  return value;
}

const bridgeState = sanitize(readJson(path.join(sampleRunDir, 'runtime', 'bridge', 'bridge-state.json')));
const eventLog = sanitize(readJson(path.join(sampleRunDir, 'runtime', 'event-log.json')));
const runStateRaw = sanitize(readJson(path.join(sampleRunDir, 'runtime', 'run-state.json')));

const runState = {
  ...runStateRaw,
  eventLog: Array.isArray(runStateRaw.eventLog) ? runStateRaw.eventLog.slice(0, 60) : [],
  toolRuns: Array.isArray(runStateRaw.toolRuns) ? runStateRaw.toolRuns.slice(0, 20) : [],
};
const eventLogFuller = Array.isArray(eventLog) ? eventLog.slice(0, 80) : [];

const outputs = {
  'bridge-state.real-run.fixture.json': bridgeState,
  'event-log.real-run.fixture.json': eventLogFuller,
  'run-state.real-run.fixture.json': runState,
};

const provenance = {
  kind: 'published_fixture_provenance',
  sourceRunId: path.basename(sampleRunDir),
  sourceRunDir: sanitize(sampleRunDir),
  generationScript: 'scripts/team/team-generate-real-run-published-fixtures.mjs',
  sanitization: {
    rootPathReplacement: {
      from: root,
      to: '/workspace/orchestrator',
    },
  },
  sampling: {
    'bridge-state.real-run.fixture.json': {
      mode: 'full_object_copy',
      note: 'bridge-state kept whole after path sanitization',
    },
    'event-log.real-run.fixture.json': {
      mode: 'array_slice',
      start: 0,
      limit: 80,
      note: 'first 80 events from runtime/event-log.json',
    },
    'run-state.real-run.fixture.json': {
      mode: 'full_object_copy_with_nested_caps',
      nestedCaps: {
        eventLog: { start: 0, limit: 60 },
        toolRuns: { start: 0, limit: 20 },
      },
    },
  },
  observedCounts: {
    bridgeState: {
      ingress: Array.isArray(bridgeState?.ingress) ? bridgeState.ingress.length : 0,
      egress: Array.isArray(bridgeState?.egress) ? bridgeState.egress.length : 0,
      routes: Array.isArray(bridgeState?.routes) ? bridgeState.routes.length : 0,
    },
    eventLog: {
      count: Array.isArray(eventLogFuller) ? eventLogFuller.length : 0,
    },
    runState: {
      results: Array.isArray(runState?.results) ? runState.results.length : 0,
      eventLog: Array.isArray(runState?.eventLog) ? runState.eventLog.length : 0,
      toolRuns: Array.isArray(runState?.toolRuns) ? runState.toolRuns.length : 0,
      durableArtifacts: Array.isArray(runState?.durableArtifacts) ? runState.durableArtifacts.length : 0,
    },
  },
  files: Object.keys(outputs),
};

fs.mkdirSync(fixtureRoot, { recursive: true });
for (const [name, payload] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(fixtureRoot, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
fs.writeFileSync(path.join(fixtureRoot, 'fixture-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: true, fixtureRoot, files: [...Object.keys(outputs), 'fixture-provenance.json'] }, null, 2));

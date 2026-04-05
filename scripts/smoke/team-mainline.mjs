import { spawn } from 'node:child_process';
import { acquireSingleFlight, releaseSingleFlight, makeBatchId } from '../team/_team-governance.mjs';

const STEPS = [
  { key: 'governanceWiring', label: 'governance wiring smoke', cmd: ['node', 'scripts/team/team-governance-wiring-smoke.mjs'] },
  { key: 'teamCoreAuthority', label: 'team core authority smoke', cmd: ['node', 'scripts/team/team-core-authority-smoke.mjs'] },
  { key: 'singleFlight', label: 'single-flight mainline smoke', cmd: ['node', 'scripts/team/team-single-flight-mainline-smoke.mjs'] },
  { key: 'roleCapability', label: 'role capability contract smoke', cmd: ['node', 'scripts/team/team-role-capability-contract-smoke.mjs'] },
  { key: 'executionSurface', label: 'execution surface contract smoke', cmd: ['node', 'scripts/team/team-execution-surface-contract-smoke.mjs'] },
  { key: 'harnessAuthority', label: 'harness authority smoke', cmd: ['node', 'scripts/team/team-harness-authority-smoke.mjs'] },
  { key: 'hostOpsNeutralization', label: 'host / ops neutralization smoke', cmd: ['node', 'scripts/team/team-host-ops-neutralization-smoke.mjs'] },
  { key: 'uatObservabilityNeutralization', label: 'uat / observability neutralization smoke', cmd: ['node', 'scripts/team/team-uat-observability-neutralization-smoke.mjs'] },
  { key: 'dashboardPublicContract', label: 'dashboard public-contract smoke', cmd: ['node', 'scripts/team/team-dashboard-public-contract-smoke.mjs'] },
  { key: 'dashboardSingleRepoBuild', label: 'dashboard single-repo build smoke', cmd: ['node', 'scripts/team/team-dashboard-single-repo-build-smoke.mjs'] },
  { key: 'independentAgentOnboarding', label: 'independent agent onboarding smoke', cmd: ['node', 'scripts/team/team-independent-agent-onboarding-smoke.mjs'] },
  { key: 'thirdPartyAgentTemplate', label: 'third-party agent template smoke', cmd: ['node', 'scripts/team/team-third-party-agent-template-smoke.mjs'] },
  { key: 'ossReleaseBaseline', label: 'OSS release baseline smoke', cmd: ['node', 'scripts/team/team-oss-release-baseline-smoke.mjs'] },
  { key: 'maintainerPrivateOpsBoundary', label: 'maintainer/private-ops boundary smoke', cmd: ['node', 'scripts/team/team-maintainer-private-ops-boundary-smoke.mjs'] },
  { key: 'releaseEngineeringCi', label: 'release engineering / ci smoke', cmd: ['node', 'scripts/team/team-release-engineering-ci-smoke.mjs'] },
  { key: 'releaseArtifactPublish', label: 'release artifact / publish smoke', cmd: ['node', 'scripts/team/team-release-artifact-publish-smoke.mjs'] },
  { key: 'releaseNotesProvenanceVersion', label: 'release notes / provenance / version-story smoke', cmd: ['node', 'scripts/team/team-release-notes-provenance-version-smoke.mjs'] },
  { key: 'compatBoundary', label: 'compat boundary smoke', cmd: ['node', 'scripts/team/team-compat-boundary-smoke.mjs'] },
  { key: 'standaloneBrokerMainline', label: 'standalone broker mainline smoke', cmd: ['node', 'scripts/team/team-standalone-broker-mainline-smoke.mjs'] },
  { key: 'standaloneSessionBus', label: 'standalone session bus smoke', cmd: ['node', 'scripts/team/team-standalone-session-bus-smoke.mjs'] },
  { key: 'standaloneProductCapability', label: 'standalone product capability smoke', cmd: ['node', 'scripts/team/team-standalone-product-capability-smoke.mjs'] },
  { key: 'ossMinimal', label: 'OSS minimal runnable smoke', cmd: ['node', 'scripts/team/team-oss-minimal-smoke.mjs'] },
  { key: 'ossMinimalCrashResume', label: 'OSS minimal crash-resume smoke', cmd: ['node', 'scripts/team/team-oss-minimal-crash-resume-smoke.mjs'] },
  { key: 'searchEvidenceSafety', label: 'search evidence safety smoke', cmd: ['node', 'scripts/team/team-search-evidence-safety-smoke.mjs'] },
  { key: 'memoryLayers', label: 'three-layer memory smoke', cmd: ['node', 'scripts/team/team-memory-three-layer-smoke.mjs'] },
  { key: 'dagFailFast', label: 'DAG fail-fast smoke', cmd: ['node', 'scripts/team/team-dag-fail-fast-smoke.mjs'] },
  { key: 'followupFallback', label: 'follow-up fallback smoke', cmd: ['node', 'scripts/team/team-followup-fallback-mainline-smoke.mjs'] },
  { key: 'sessionCapabilityDocs', label: 'session capability doc boundary smoke', cmd: ['node', 'scripts/team/team-session-capability-doc-boundary-smoke.mjs'] },
  { key: 'sessionCompletion', label: 'session completion event smoke', cmd: ['node', 'scripts/team/team-session-completion-event-smoke.mjs'] },
];

const REPO_ROOT = new URL('../../', import.meta.url);

function runCommand(cmd, timeoutMs = 240000) {
  return new Promise((resolve) => {
    const [bin, ...args] = cmd;
    const child = spawn(bin, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stdout, stderr });
    });
  });
}

function extractTrailingJson(text = '') {
  const s = String(text || '').trim();
  if (!s) return null;
  const starts = [];
  for (let i = 0; i < s.length; i += 1) if (s[i] === '{') starts.push(i);
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(s.slice(starts[i])); } catch {}
  }
  return null;
}

function deriveSemanticOk(parsed) {
  if (!parsed || typeof parsed !== 'object') return true;
  if (typeof parsed.ok === 'boolean') return parsed.ok === true;
  if (typeof parsed.failed === 'number') return parsed.failed === 0;
  if (typeof parsed.summary?.ok === 'boolean') return parsed.summary.ok === true;
  return true;
}

const startedAt = Date.now();
const batchId = makeBatchId('team-mainline');
const singleFlight = acquireSingleFlight('team-mainline-smoke', { batchId, script: 'scripts/smoke/team-mainline.mjs' });
if (!singleFlight.ok) {
  console.error(JSON.stringify({ ok: false, error: 'single_flight_active', batchId, active: singleFlight.active }, null, 2));
  process.exit(2);
}
process.on('exit', () => releaseSingleFlight(singleFlight));
process.on('SIGINT', () => { releaseSingleFlight(singleFlight); process.exit(130); });
process.on('SIGTERM', () => { releaseSingleFlight(singleFlight); process.exit(143); });

const results = [];
for (const step of STEPS) {
  const out = await runCommand(step.cmd);
  const parsed = extractTrailingJson(`${out.stdout || ''}\n${out.stderr || ''}`);
  const ok = !out.timedOut && Number(out.code || 0) === 0 && deriveSemanticOk(parsed);
  results.push({
    key: step.key,
    label: step.label,
    ok,
    timedOut: out.timedOut,
    exitCode: out.code,
    signal: out.signal,
    summary: parsed?.summary || parsed?.results || parsed || null,
    stderrTail: String(out.stderr || '').trim().split('\n').slice(-12),
  });
  if (!ok) break;
}

const ok = results.length === STEPS.length && results.every((r) => r.ok);
const firstFailure = results.find((r) => !r.ok) || null;
console.log(JSON.stringify({
  ok,
  batchId,
  baseline: 'team-mainline-canonical.v4',
  startedAt,
  finishedAt: Date.now(),
  durationMs: Date.now() - startedAt,
  summary: {
    ok,
    baseline: 'team-mainline-canonical.v4',
    stepCount: results.length,
    passedStepCount: results.filter((r) => r.ok).length,
    firstFailureKey: firstFailure?.key || '',
  },
  firstFailure: firstFailure ? { key: firstFailure.key, label: firstFailure.label } : null,
  results,
}, null, 2));

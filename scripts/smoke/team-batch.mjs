import { spawn } from 'node:child_process';
import { acquireSingleFlight, releaseSingleFlight, makeBatchId } from '../team/_team-governance.mjs';

const STEPS = [
  { key: 'mainlineSmoke', label: 'team mainline smoke', cmd: ['npm', 'run', 'smoke:team'] },
  { key: 'controlPlane', label: 'team control plane smoke', cmd: ['node', 'scripts/team/team-control-plane-smoke.mjs'] },
  { key: 'workbench', label: 'team workbench smoke', cmd: ['node', 'scripts/team/team-workbench-smoke.mjs'] },
  { key: 'standaloneSessionBus', label: 'standalone session bus smoke', cmd: ['node', 'scripts/team/team-standalone-session-bus-smoke.mjs'] },
];

const REPO_ROOT = new URL('../../', import.meta.url);

function run(cmd, timeoutMs = 240000) {
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

const batchId = makeBatchId('team-batch');
const singleFlight = acquireSingleFlight('team-batch-runner', { batchId, script: 'scripts/smoke/team-batch.mjs' });
if (!singleFlight.ok) {
  console.error(JSON.stringify({ ok: false, error: 'single_flight_active', batchId, active: singleFlight.active }, null, 2));
  process.exit(2);
}
process.on('exit', () => releaseSingleFlight(singleFlight));
process.on('SIGINT', () => { releaseSingleFlight(singleFlight); process.exit(130); });
process.on('SIGTERM', () => { releaseSingleFlight(singleFlight); process.exit(143); });

const results = [];
for (const step of STEPS) {
  const out = await run(step.cmd);
  const parsed = extractTrailingJson(`${out.stdout || ''}\n${out.stderr || ''}`);
  const ok = !out.timedOut && Number(out.code || 0) === 0 && deriveSemanticOk(parsed);
  results.push({
    key: step.key,
    label: step.label,
    ok,
    timedOut: out.timedOut,
    exitCode: out.code,
    signal: out.signal,
    summary: parsed?.summary || parsed || null,
    stderrTail: String(out.stderr || '').trim().split('\n').slice(-10),
  });
  if (!ok) break;
}

const ok = results.every((r) => r.ok);
const firstFailure = results.find((r) => !r.ok) || null;
console.log(JSON.stringify({
  ok,
  batchId,
  batch: 'team-smoke-batch.v3',
  summary: {
    ok,
    batch: 'team-smoke-batch.v3',
    stepCount: results.length,
    passedStepCount: results.filter((r) => r.ok).length,
    firstFailureKey: firstFailure?.key || '',
  },
  firstFailure: firstFailure ? { key: firstFailure.key, label: firstFailure.label } : null,
  results,
}, null, 2));

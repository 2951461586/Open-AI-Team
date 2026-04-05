import { spawn } from 'node:child_process';

const REPO_ROOT = new URL('../../', import.meta.url);

function runCommand(cmd, timeoutMs = 120000) {
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

function parseJson(text = '') {
  try {
    return JSON.parse(String(text || '').trim());
  } catch {
    return null;
  }
}

const started = await runCommand(['node', 'examples/oss-minimal/run-demo.mjs', '--start-only'], 120000);
const startedJson = parseJson(started.stdout);

const crashed = await runCommand([
  'node',
  'examples/oss-minimal/run-demo.mjs',
  '--resume',
  String(startedJson?.runDir || ''),
  '--drain',
  '--stream',
  '--crash-after-completions',
  '1',
], 120000);
const crashedJson = parseJson(crashed.stdout);

const recovered = await runCommand([
  'node',
  'examples/oss-minimal/run-demo.mjs',
  '--resume',
  String(startedJson?.runDir || ''),
  '--drain',
  '--stream',
], 180000);
const parsed = parseJson(recovered.stdout);

const ok = !started.timedOut
  && Number(started.code || 0) === 0
  && startedJson?.status === 'pending'
  && !crashed.timedOut
  && Number(crashed.code || 0) === 0
  && (crashedJson?.status === 'completed' || crashedJson?.status === 'paused')
  && !recovered.timedOut
  && Number(recovered.code || 0) === 0
  && parsed?.ok === true
  && parsed?.status === 'completed'
  && parsed?.summary?.ok === true
  && parsed?.summary?.recoveryReady === true
  && parsed?.summary?.recoverySourceFirstReady === true
  && Array.isArray(parsed?.results)
  && parsed.results.length >= 6
  && Number(parsed?.continuation?.resumeCount || 0) >= 1;

console.log(JSON.stringify({
  ok,
  summary: {
    ok,
    crashedExitCode: crashed.code,
    recoveredStatus: parsed?.status || '',
    brokerRecoveredCount: parsed?.runtimeEvidence?.brokerRecoveredCount || 0,
    recoveredResultCount: Array.isArray(parsed?.results) ? parsed.results.length : 0,
    resumeCount: parsed?.continuation?.resumeCount || 0,
    crashRecoveryReady: parsed?.summary?.recoveryReady === true && parsed?.summary?.recoverySourceFirstReady === true,
  },
  diagnostics: {
    startedExitCode: started.code,
    crashedExitCode: crashed.code,
    recoveredExitCode: recovered.code,
    crashedTimedOut: crashed.timedOut,
    recoveredTimedOut: recovered.timedOut,
    crashedStderrTail: String(crashed.stderr || '').trim().split('\n').slice(-12),
    recoveredStderrTail: String(recovered.stderr || '').trim().split('\n').slice(-12),
  },
}, null, 2));

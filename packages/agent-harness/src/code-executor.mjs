import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const LANGUAGE_META = {
  javascript: { ext: '.mjs', command: 'node' },
  js: { ext: '.mjs', command: 'node' },
  python: { ext: '.py', command: 'python3' },
  py: { ext: '.py', command: 'python3' },
  shell: { ext: '.sh', command: 'bash' },
  sh: { ext: '.sh', command: 'bash' },
};

function normalizeLanguage(language = 'javascript') {
  const key = String(language || 'javascript').trim().toLowerCase();
  if (!LANGUAGE_META[key]) throw new Error(`unsupported_language: ${language}`);
  return key;
}

function clamp(min, value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, num);
}

function truncateBytes(value = '', maxBytes = 65536) {
  const text = String(value || '');
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.byteLength <= maxBytes) return text;
  return buffer.subarray(0, maxBytes).toString('utf8');
}

function buildInlineResourceWrapper({ command = '', scriptPath = '', cpuSeconds = 2, extraArgs = [] } = {}) {
  const cpu = Math.max(1, Number(cpuSeconds || 2));
  const shellSafePath = String(scriptPath || '').replace(/'/g, `'\\''`);
  const shellSafeCommand = String(command || '').replace(/'/g, `'\\''`);
  const argText = (Array.isArray(extraArgs) ? extraArgs : [])
    .map((item) => `'${String(item || '').replace(/'/g, `'\\''`)}'`)
    .join(' ');
  return `ulimit -t ${cpu}; exec '${shellSafeCommand}'${argText ? ` ${argText}` : ''} '${shellSafePath}'`;
}

export function createCodeExecutor({ workspaceDir = '', sandbox = null, defaultOptions = {} } = {}) {
  const baseDir = path.resolve(String(workspaceDir || sandbox?.baseDir || '.'));
  const executionDir = path.join(baseDir, '.sandbox-runtime');
  const defaultTimeoutMs = clamp(100, defaultOptions.timeoutMs, 5000);
  const defaultCpuSeconds = clamp(1, defaultOptions.cpuSeconds, 2);
  const defaultMemoryMb = clamp(64, defaultOptions.memoryMb, 256);
  const maxStdoutBytes = clamp(1024, defaultOptions.maxStdoutBytes, 131072);
  const maxStderrBytes = clamp(1024, defaultOptions.maxStderrBytes, 131072);

  async function execute(code = '', options = {}) {
    const language = normalizeLanguage(options.language || 'javascript');
    const meta = LANGUAGE_META[language];
    const timeoutMs = clamp(100, options.timeoutMs, defaultTimeoutMs);
    const cpuSeconds = clamp(1, options.cpuSeconds, defaultCpuSeconds);
    const memoryMb = clamp(64, options.memoryMb, defaultMemoryMb);
    const env = options.env && typeof options.env === 'object' ? { ...options.env } : {};

    await fs.mkdir(executionDir, { recursive: true });
    const tempRoot = await fs.mkdtemp(path.join(executionDir, 'exec-'));
    const scriptPath = path.join(tempRoot, `main${meta.ext}`);
    await fs.writeFile(scriptPath, String(code || ''), { encoding: 'utf8', mode: 0o700 });

    const extraArgs = [];
    if (meta.command === 'node') {
      extraArgs.push(`--max-old-space-size=${Math.max(32, memoryMb)}`);
    }

    const wrapper = buildInlineResourceWrapper({
      command: meta.command,
      scriptPath,
      cpuSeconds,
      extraArgs,
    });

    return new Promise((resolve) => {
      const child = spawn('bash', ['-lc', wrapper], {
        cwd: String(options.cwd || baseDir),
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          TMPDIR: tempRoot,
          ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;
      const startedAt = Date.now();
      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 500).unref();
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout = truncateBytes(stdout + String(chunk || ''), maxStdoutBytes);
      });
      child.stderr.on('data', (chunk) => {
        stderr = truncateBytes(stderr + String(chunk || ''), maxStderrBytes);
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          language,
          stdout,
          stderr: truncateBytes(`${stderr}\n${String(err?.message || err || 'spawn_failed')}`.trim(), maxStderrBytes),
          exitCode: -1,
          signal: '',
          timedOut,
          killed,
          durationMs: Date.now() - startedAt,
          limits: { timeoutMs, cpuSeconds, memoryMb },
          runtime: { command: meta.command, cwd: String(options.cwd || baseDir), mode: 'host-process' },
        });
      });
      child.on('close', async (codeValue, signal) => {
        clearTimeout(timer);
        try { await fs.rm(tempRoot, { recursive: true, force: true }); } catch {}
        resolve({
          ok: !timedOut && Number(codeValue || 0) === 0,
          language,
          stdout,
          stderr,
          exitCode: Number(codeValue ?? -1),
          signal: signal || '',
          timedOut,
          killed,
          durationMs: Date.now() - startedAt,
          limits: { timeoutMs, cpuSeconds, memoryMb },
          runtime: { command: meta.command, cwd: String(options.cwd || baseDir), mode: 'host-process' },
        });
      });
    });
  }

  return {
    kind: 'code_executor',
    baseDir,
    executionDir,
    execute,
    async inspectRuntime() {
      return {
        baseDir,
        executionDir,
        platform: os.platform(),
        defaults: { timeoutMs: defaultTimeoutMs, cpuSeconds: defaultCpuSeconds, memoryMb: defaultMemoryMb },
      };
    },
  };
}

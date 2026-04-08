import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createSandboxPolicy } from './sandbox-policy.mjs';
import { createCodeExecutor } from './code-executor.mjs';

function normalizePrefixList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').replace(/^\.\//, '').replace(/^\//, '').trim())
    .filter(Boolean)
    .map((item) => item.endsWith('/') ? item : `${item}/`);
}

function matchesPrefix(relPath = '', prefixes = []) {
  const normalized = String(relPath || '').replace(/^\.\//, '').replace(/^\//, '').trim();
  return prefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function detectDockerBinary() {
  const probe = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8', timeout: 2500 });
  if (probe.error) return { available: false, reason: probe.error.message };
  if (Number(probe.status || 1) !== 0) return { available: false, reason: String(probe.stderr || probe.stdout || 'docker_unavailable').trim() };
  return { available: true, binary: 'docker', version: String(probe.stdout || '').trim() };
}

async function pathExists(target = '') {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function createSandboxCore({ workspaceDir = '', policy = {}, mode = 'auto', docker = {}, executorDefaults = {} } = {}) {
  const baseDir = path.resolve(String(workspaceDir || '.'));
  const sandboxPolicy = createSandboxPolicy({ workspaceDir: baseDir, policy });
  const codeExecutor = createCodeExecutor({ workspaceDir: baseDir, defaultOptions: executorDefaults });
  const writablePrefixes = normalizePrefixList(policy.writablePrefixes || ['artifacts', 'memory', 'desk']);
  const searchExcludePrefixes = normalizePrefixList(policy.searchExcludePrefixes || ['desk/outbox']);
  const snapshotExcludePrefixes = normalizePrefixList(policy.snapshotExcludePrefixes || ['desk/outbox']);
  const maxWriteBytes = Math.max(1024, Number(policy.maxWriteBytes || 65536));
  const maxReadBytes = Math.max(1024, Number(policy.maxReadBytes || 262144));
  const dockerInfo = mode === 'pathguard' ? { available: false, reason: 'mode_forced_pathguard' } : detectDockerBinary();
  const requestedMode = String(mode || 'auto').trim().toLowerCase();
  const effectiveMode = requestedMode === 'docker'
    ? (dockerInfo.available ? 'docker' : 'pathguard')
    : (requestedMode === 'pathguard' ? 'pathguard' : (dockerInfo.available ? 'docker' : 'pathguard'));

  function resolvePath(targetPath = '.') {
    return sandboxPolicy.resolvePath(targetPath);
  }

  function toRel(targetPath = '.') {
    return sandboxPolicy.toRelative(targetPath);
  }

  async function ensureDir(targetPath = '.') {
    const resolved = resolvePath(targetPath);
    await fs.mkdir(resolved, { recursive: true });
  }

  async function writeText(targetPath = '', content = '') {
    const body = String(content || '');
    if (Buffer.byteLength(body, 'utf8') > maxWriteBytes) throw new Error(`sandbox_write_too_large: ${targetPath}`);
    const resolved = sandboxPolicy.assertWritable(targetPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, body, 'utf8');
    return resolved;
  }

  async function appendText(targetPath = '', content = '') {
    const body = String(content || '');
    if (Buffer.byteLength(body, 'utf8') > maxWriteBytes) throw new Error(`sandbox_append_too_large: ${targetPath}`);
    const resolved = sandboxPolicy.assertWritable(targetPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.appendFile(resolved, body, 'utf8');
    return resolved;
  }

  async function readText(targetPath = '') {
    const resolved = sandboxPolicy.assertReadable(targetPath);
    const stat = await fs.stat(resolved);
    if (Number(stat.size || 0) > maxReadBytes) throw new Error(`sandbox_read_too_large: ${targetPath}`);
    return fs.readFile(resolved, 'utf8');
  }

  async function list(targetPath = '.', { recursive = false, excludePrefixes = [] } = {}) {
    const root = sandboxPolicy.assertReadable(targetPath);
    const mergedExcludes = normalizePrefixList([...(Array.isArray(excludePrefixes) ? excludePrefixes : [])]);
    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const rows = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full).replace(/\\/g, '/') || '.';
        if (matchesPrefix(rel, mergedExcludes)) continue;
        if (entry.isDirectory()) {
          rows.push({ path: rel, type: 'dir' });
          if (recursive) rows.push(...await walk(full));
        } else {
          rows.push({ path: rel, type: 'file' });
        }
      }
      return rows;
    }
    return walk(root);
  }

  async function searchText(targetPath = '.', query = '', { excludePrefixes = [] } = {}) {
    const mergedExcludes = [...searchExcludePrefixes, ...normalizePrefixList(excludePrefixes)];
    const rows = await list(targetPath, { recursive: true, excludePrefixes: mergedExcludes });
    const needle = String(query || '').trim();
    const hits = [];
    for (const row of rows) {
      if (row.type !== 'file') continue;
      try {
        const text = await readText(row.path);
        if (needle && text.includes(needle)) hits.push({ path: row.path, match: needle });
      } catch {}
    }
    return hits;
  }

  async function execute(code = '', options = {}) {
    const language = String(options.language || 'javascript').trim().toLowerCase();
    const timeoutMs = Math.max(100, Number(options.timeoutMs || executorDefaults.timeoutMs || 5000));
    const cpuSeconds = Math.max(1, Number(options.cpuSeconds || executorDefaults.cpuSeconds || 2));
    const memoryMb = Math.max(64, Number(options.memoryMb || executorDefaults.memoryMb || 256));

    if (effectiveMode !== 'docker') {
      const result = await codeExecutor.execute(code, { ...options, language, timeoutMs, cpuSeconds, memoryMb });
      return {
        ...result,
        sandbox: {
          mode: 'pathguard',
          requestedMode,
          effectiveMode,
          baseDir,
          policy: sandboxPolicy.summarize(),
          dockerAvailable: dockerInfo.available,
        },
      };
    }

    const image = String(docker.image || options.dockerImage || 'node:22-alpine').trim();
    const workdir = '/workspace';
    const runRoot = path.join(baseDir, '.sandbox-runtime', 'docker');
    await fs.mkdir(runRoot, { recursive: true });
    const tempDir = await fs.mkdtemp(path.join(runRoot, 'exec-'));
    const extension = language === 'python' || language === 'py' ? '.py' : (language === 'shell' || language === 'sh' ? '.sh' : '.mjs');
    const filename = `main${extension}`;
    const scriptHostPath = path.join(tempDir, filename);
    await fs.writeFile(scriptHostPath, String(code || ''), { encoding: 'utf8', mode: 0o700 });

    const entryCommand = language === 'python' || language === 'py'
      ? ['python3', `${workdir}/${filename}`]
      : (language === 'shell' || language === 'sh' ? ['sh', `${workdir}/${filename}`] : ['node', `${workdir}/${filename}`]);

    const dockerArgs = [
      'run', '--rm',
      '--cpus', String(Math.max(0.1, Number(options.cpus || cpuSeconds))),
      '--memory', `${memoryMb}m`,
      '--memory-swap', `${memoryMb}m`,
      '--ulimit', `cpu=${cpuSeconds}:${cpuSeconds}`,
      ...sandboxPolicy.buildDockerSecurityArgs(),
      '-v', `${baseDir}:${workdir}:rw`,
      '-v', `${tempDir}:${workdir}:ro`,
      '-w', workdir,
      image,
      ...entryCommand,
    ];

    const child = spawn('docker', dockerArgs, {
      cwd: baseDir,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return await new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const startedAt = Date.now();
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 500).unref();
      }, timeoutMs);
      child.stdout.on('data', (chunk) => { stdout += String(chunk || ''); });
      child.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
      child.on('close', async (codeValue, signal) => {
        clearTimeout(timer);
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
        resolve({
          ok: !timedOut && Number(codeValue || 0) === 0,
          language,
          stdout,
          stderr,
          exitCode: Number(codeValue ?? -1),
          signal: signal || '',
          timedOut,
          killed: timedOut,
          durationMs: Date.now() - startedAt,
          limits: { timeoutMs, cpuSeconds, memoryMb },
          runtime: { command: 'docker', args: dockerArgs, cwd: baseDir, image, mode: 'docker' },
          sandbox: {
            mode: 'docker',
            requestedMode,
            effectiveMode,
            baseDir,
            policy: sandboxPolicy.summarize(),
            dockerAvailable: dockerInfo.available,
            dockerVersion: dockerInfo.version || '',
          },
        });
      });
    });
  }

  return {
    kind: 'sandbox_core',
    guarded: true,
    baseDir,
    mode: effectiveMode,
    requestedMode,
    docker: dockerInfo,
    policySummary: {
      ...sandboxPolicy.summarize(),
      maxWriteBytes,
      maxReadBytes,
    },
    resolvePath,
    ensureDir,
    writeText,
    appendText,
    readText,
    list(targetPath = '.', opts = {}) {
      const merged = {
        ...opts,
        excludePrefixes: [...snapshotExcludePrefixes, ...(Array.isArray(opts.excludePrefixes) ? opts.excludePrefixes : [])],
      };
      return list(targetPath, merged);
    },
    searchText,
    execute,
    getPolicy() {
      return sandboxPolicy;
    },
    async inspect() {
      return {
        kind: 'sandbox_core',
        baseDir,
        requestedMode,
        effectiveMode,
        docker: dockerInfo,
        policy: sandboxPolicy.summarize(),
        runtimeDirExists: await pathExists(path.join(baseDir, '.sandbox-runtime')),
      };
    },
  };
}

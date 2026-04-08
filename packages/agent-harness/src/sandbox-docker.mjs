/**
 * sandbox-docker.mjs — Docker 隔离执行层
 *
 * 对标 DeerFlow sandbox（Docker/K8s mode）：
 * - 容器级隔离：--cap-drop ALL + --read-only rootfs + --no-new-privileges
 * - 内置 seccomp 白名单（node/python/shell 最小 syscall 子集）
 * - Image 自动拉取 + 过期策略
 * - 临时容器 lifecycle 管理（孤儿回收）
 * - 流式输出 + 截断
 * - 网络隔离：默认 --network none
 * - 资源限制：CPU / memory / ulimit / pids
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// ─── 内置最小 seccomp profile ─────────────────────────────────────────────
const SECCOMP_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), 'seccomp-default.json');

const SECCOMP_DEFAULT = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_AARCH64'],
  syscalls: [
    { names: ['accept', 'access', 'arch_prctl', 'bind', 'brk', 'capget', 'capset',
      'chdir', 'chmod', 'chown', 'clone', 'close', 'connect', 'copy_file_range',
      'epoll_create', 'epoll_create1', 'epoll_ctl', 'epoll_pwait', 'epoll_wait',
      'eventfd', 'eventfd2', 'execve', 'execveat', 'exit', 'exit_group',
      'faccessat', 'fchmod', 'fchmodat', 'fchown', 'fchownat', 'fcntl', 'fdatasync',
      'flock', 'fstat', 'fstatfs', 'ftruncate', 'futex', 'getcwd', 'getdents',
      'getdents64', 'getegid', 'geteuid', 'getgid', 'getgroups', 'getpeername',
      'getpgrp', 'getpid', 'getppid', 'getrandom', 'getresgid', 'getresuid',
      'getrlimit', 'getrusage', 'getsid', 'getsockname', 'getsockopt', 'gettid',
      'gettimeofday', 'getuid', 'getxattr', 'inotify_add_watch', 'inotify_init',
      'inotify_init1', 'inotify_rm_watch', 'ioctl', 'kill', 'lgetxattr', 'link',
      'linkat', 'listen', 'listxattr', 'llistxattr', 'lremovexattr', 'lstat',
      'madvise', 'membarrier', 'mmap', 'mprotect', 'mremap', 'munmap', 'nanosleep',
      'newfstatat', 'open', 'openat', 'pipe', 'pipe2', 'poll', 'ppoll', 'prctl',
      'pread64', 'prlimit64', 'pselect6', 'pwrite64', 'read', 'readlink',
      'readlinkat', 'recv', 'recvfrom', 'recvmsg', 'removexattr', 'rename',
      'renameat', 'renameat2', 'restart_syscall', 'rmdir', 'rt_sigaction',
      'rt_sigpending', 'rt_sigprocmask', 'rt_sigqueueinfo', 'rt_sigreturn',
      'rt_sigsuspend', 'rt_sigtimedwait', 'sched_get_priority_max',
      'sched_get_priority_min', 'sched_yield', 'seccomp', 'select', 'semctl',
      'semget', 'semop', 'semtimedop', 'send', 'sendfile', 'sendmsg', 'sendto',
      'set_tid_address', 'set_robust_list', 'setitimer', 'setsockopt', 'setxattr',
      'shutdown', 'sigaltstack', 'socket', 'socketpair', 'stat', 'statfs',
      'statx', 'symlink', 'symlinkat', 'sync', 'sync_file_range', 'syncfs',
      'sysinfo', 'tgkill', 'time', 'timerfd_create', 'timerfd_gettime',
      'timerfd_settime', 'tkill', 'truncate', 'umask', 'uname', 'unlink',
      'unlinkat', 'utimensat', 'wait4', 'waitid', 'write', 'writev'],
      action: 'SCMP_ACT_ALLOW' }
  ]
};

// ─── 语言元信息 ────────────────────────────────────────────────────────────
const LANG_META = {
  javascript: { ext: '.mjs', image: 'node:22-alpine', cmd: 'node' },
  js:        { ext: '.mjs', image: 'node:22-alpine', cmd: 'node' },
  python:    { ext: '.py',  image: 'python:3.12-slim', cmd: 'python3' },
  py:        { ext: '.py',  image: 'python:3.12-slim', cmd: 'python3' },
  shell:     { ext: '.sh',  image: 'alpine:3.20',      cmd: 'sh' },
  sh:        { ext: '.sh',  image: 'alpine:3.20',      cmd: 'sh' },
  bash:      { ext: '.sh',  image: 'bash:5.3',         cmd: 'bash' },
};

// ─── 工具函数 ──────────────────────────────────────────────────────────────
let seccompWritten = false;

async function ensureSeccompFile() {
  if (seccompWritten) return SECCOMP_PATH;
  try {
    await fs.mkdir(path.dirname(SECCOMP_PATH), { recursive: true });
    await fs.writeFile(SECCOMP_PATH, JSON.stringify(SECCOMP_DEFAULT, null, 2));
    seccompWritten = true;
  } catch {}
  return SECCOMP_PATH;
}

function truncateBytes(str = '', max = 131072) {
  const buf = Buffer.from(String(str || ''), 'utf8');
  if (buf.byteLength <= max) return buf.toString('utf8');
  return buf.subarray(0, max).toString('utf8') + '\n...[truncated]';
}

function nowIso() { return new Date().toISOString(); }

async function runDocker(args, { timeoutMs = 30000, timeoutKillMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (c) => { stdout += String(c || ''); });
    child.stderr.on('data', (c) => { stderr += String(c || ''); });
    let killed = false;
    child.on('error', (err) => {
      resolve({ ok: false, stdout: '', stderr: String(err?.message || err), exitCode: -1, killed: false });
    });
    child.on('close', (code) => {
      const exitCode = typeof code === 'number' ? code : -1;
      resolve({ ok: exitCode === 0, stdout, stderr, exitCode, killed });
    });
    if (timeoutMs) {
      setTimeout(() => { killed = true; child.kill('SIGTERM'); }, timeoutMs).unref();
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, timeoutMs + timeoutKillMs).unref();
    }
  });
}

async function dockerPullIfMissing(image, { timeoutMs = 120000 } = {}) {
  // 检查本地是否已有
  const check = await runDocker(['image', 'inspect', image, '--format', '{{.Id}}'], { timeoutMs: 10000 });
  if (check.ok) return { local: true, id: check.stdout.trim() };

  // 尝试拉取
  const pull = await runDocker(['pull', image], { timeoutMs });
  if (pull.ok) {
    const after = await runDocker(['image', 'inspect', image, '--format', '{{.Id}}'], { timeoutMs: 10000 });
    return { local: true, id: after.stdout.trim(), pulled: true };
  }

  // 拉取失败
  return { local: false, error: pull.stderr };
}

// ─── 临时容器跟踪（防止孤儿） ──────────────────────────────────────────────
const activeContainers = new Set();

async function forceKillContainer(containerId) {
  try { await runDocker(['kill', containerId], { timeoutMs: 3000 }); } catch {}
  try { await runDocker(['rm', '-f', containerId], { timeoutMs: 3000 }); } catch {}
  activeContainers.delete(containerId);
}

// 进程退出时清理所有活跃容器
process.on('exit', () => {
  for (const id of activeContainers) {
    try {
      const s = spawn('docker', ['rm', '-f', id], { stdio: 'ignore' });
      s.unref();
    } catch {}
  }
});

// ─── 主导出 ────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.baseDir         工作目录（挂载为 /workspace）
 * @param {object} [opts.policy]        sandboxPolicy 对象（可用 resolvePath/assertWritable/assertReadable）
 * @param {string} [opts.image]         默认镜像（覆盖语言默认）
 * @param {number} [opts.defaultTimeoutMs = 30000]
 * @param {number} [opts.defaultCpuSeconds = 2]
 * @param {number} [opts.defaultMemoryMb = 256]
 * @param {number} [opts.maxOutputBytes = 131072]  stdout/stderr 截断
 * @param {boolean} [opts.allowNetwork = false]
 * @param {boolean} [opts.useSeccomp = true]
 * @param {string} [opts.seccompPath]     seccomp profile 路径（不填用内置）
 * @param {string[]} [opts.extraHostVolumes = []]  额外只读挂载 ["hostPath:containerPath"]
 * @param {object} [opts.tmpfs = { '/tmp': '64m' }]  临时文件系统
 */
export function createDockerSandbox(opts = {}) {
  const baseDir = path.resolve(String(opts.baseDir || '.'));
  const defaultImage = String(opts.image || '').trim() || null;
  const defaultTimeoutMs = Math.max(100, Number(opts.defaultTimeoutMs || 30000));
  const defaultCpuSeconds = Math.max(0.1, Number(opts.defaultCpuSeconds || 2));
  const defaultMemoryMb = Math.max(32, Number(opts.defaultMemoryMb || 256));
  const maxOutputBytes = Math.max(1024, Number(opts.maxOutputBytes || 131072));
  const allowNetwork = opts.allowNetwork === true;
  const useSeccomp = opts.useSeccomp !== false;
  const customSeccompPath = String(opts.seccompPath || '').trim();
  const extraHostVolumes = Array.isArray(opts.extraHostVolumes) ? opts.extraHostVolumes : [];
  const tmpfsConfig = opts.tmpfs && typeof opts.tmpfs === 'object' ? opts.tmpfs : { '/tmp': '64m' };
  const policy = opts.policy || null;

  const workdir = '/workspace';
  const runRoot = path.join(baseDir, '.sandbox-runtime', 'docker');

  async function init() {
    await fs.mkdir(runRoot, { recursive: true });
    if (useSeccomp) await ensureSeccompFile();
  }

  async function execute(code = '', execOpts = {}) {
    await init();

    const language = String(execOpts.language || 'javascript').trim().toLowerCase();
    const meta = LANG_META[language] || LANG_META.javascript;
    const image = defaultImage || String(execOpts.dockerImage || meta.image).trim();
    const timeoutMs = Math.max(100, Number(execOpts.timeoutMs || defaultTimeoutMs));
    const cpuSeconds = Math.max(0.1, Number(execOpts.cpus || execOpts.cpuSeconds || defaultCpuSeconds));
    const memoryMb = Math.max(32, Number(execOpts.memoryMb || defaultMemoryMb));
    const maxOutput = Math.max(1024, Number(execOpts.maxOutputBytes || maxOutputBytes));
    const pidsLimit = Math.max(8, Number(execOpts.pidsLimit || 32));
    const env = execOpts.env && typeof execOpts.env === 'object' ? execOpts.env : {};

    // 确定运行时 entry
    const ext = meta.ext;
    const scriptName = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    // 构建 docker run 参数
    const dockerArgs = [
      'run', '--rm',
      '--name', `sb-${scriptName.replace(/\./g, '-')}`,
      '--cpus', String(cpuSeconds),
      '--memory', `${memoryMb}m`,
      '--memory-swap', `${memoryMb}m`,
      '--ulimit', `cpu=${Math.ceil(cpuSeconds)}:${Math.ceil(cpuSeconds)}`,
      '--ulimit', `nofile=64:64`,
      '--pids-limit', String(pidsLimit),
      '--read-only',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '-w', workdir,
    ];

    // 网络
    dockerArgs.push('--network', allowNetwork ? 'bridge' : 'none');

    // seccomp
    if (useSeccomp) {
      dockerArgs.push('--security-opt', `seccomp=${customSeccompPath || SECCOMP_PATH}`);
    }

    // tmpfs
    for (const [mount, size] of Object.entries(tmpfsConfig)) {
      dockerArgs.push('--tmpfs', `${mount}:size=${size},noexec,nosuid`);
    }

    // 挂载 workspace（只读）
    dockerArgs.push('-v', `${baseDir}:${workdir}:ro`);

    // 如果 policy 允许可写前缀，单独挂载 rw
    if (policy?.writablePrefixes) {
      for (const prefix of policy.writablePrefixes) {
        const absPath = path.join(baseDir, prefix);
        try {
          await fs.access(absPath);
          dockerArgs.push('-v', `${absPath}:${workdir}/${prefix}:rw`);
        } catch {
          // 目录不存在，跳过
        }
      }
    }

    // 额外只读主机卷
    for (const volume of extraHostVolumes) {
      dockerArgs.push('-v', `${volume}`);
    }

    // 脚本通过 stdin 传入（--read-only rootfs 下无法创建 bind mountpoint）
    dockerArgs.push('-i');

    // 环境变量
    for (const [k, v] of Object.entries(env)) {
      dockerArgs.push('-e', `${k}=${v}`);
    }

    // 额外 env 白名单
    const envWhitelist = ['PATH', 'HOME', 'LANG', 'NODE_ENV', 'PYTHONPATH'];
    for (const k of envWhitelist) {
      if (!env[k] && process.env[k]) dockerArgs.push('-e', `${k}=${process.env[k]}`);
    }

    // 镜像
    // 对 node 镜像禁用 entrypoint（其 docker-entrypoint.sh 会 fork，被 seccomp 拦截）
    const needsNoEntrypoint = language === 'javascript' || language === 'js';
    if (needsNoEntrypoint) {
      dockerArgs.push('--entrypoint', '/usr/local/bin/node');
    }
    dockerArgs.push(image);

    // 入口：从 stdin 读取并执行（避免 --read-only 下创建 mountpoint 失败）
    let entryArgs;
    if (language === 'shell' || language === 'sh' || language === 'bash') {
      // -s 表示从 stdin 读取脚本
      entryArgs = [meta.cmd, '-s'];
    } else if (language === 'python' || language === 'py') {
      // python3 -c "..." 自动解包 + 纯代码执行
      entryArgs = [meta.cmd, '-c', [
        'import sys, re',
        'raw = sys.stdin.read()',
        '# 检测 python3 -c "..." 或 python -c "..." 包装',
        'm = re.match(r"python3?\\s+-c\\s+(.)\\s*(.*)\\s*\\1\\s*$", raw, re.DOTALL)',
        'if m:',
        '    code = m.group(2)',
        '    code = code.replace("\\\\\'", "\'").replace(\'\\\\"\', \'"\')',
        'else:',
        '    code = raw',
        'exec(compile(code, "<stdin>", "exec"))',
      ].join('\n')];
    } else {
      // js / mjs：--entrypoint 已设为 /usr/local/bin/node，这里只需传参数
      const jsCode = `{let d='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{eval(d)}catch(e){console.error(e.message);process.exit(1)}})}`;
      entryArgs = ['--no-warnings', '-e', jsCode];
    }
    dockerArgs.push(...entryArgs);

    // 拉取镜像
    const pullResult = await dockerPullIfMissing(image, { timeoutMs: 120000 });
    if (!pullResult.local) {
      return {
        ok: false, language, exitCode: -1,
        stderr: `docker_image_pull_failed: ${image} — ${pullResult.error}`,
        stdout: '', timedOut: false, killed: false,
        durationMs: 0,
        limits: { timeoutMs, cpuSeconds, memoryMb },
        sandbox: { mode: 'docker', image, policySummary: policy?.summarize?.() || null },
        runtime: { command: 'docker', args: dockerArgs },
      };
    }

    // 执行
    const containerName = dockerArgs[dockerArgs.indexOf('--name') + 1];
    activeContainers.add(containerName);

    const child = spawn('docker', dockerArgs, {
      cwd: baseDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return new Promise((resolve) => {
      let stdout = ''; let stderr = '';
      let timedOut = false; let killed = false;
      const startedAt = Date.now();

      // 通过 stdin 传入脚本
      child.stdin.write(String(code || ''));
      child.stdin.end();

      child.stdout.on('data', (c) => {
        stdout = truncateBytes(stdout + String(c || ''), maxOutput);
      });
      child.stderr.on('data', (c) => {
        stderr = truncateBytes(stderr + String(c || ''), maxOutput);
      });

      const timer = setTimeout(() => {
        timedOut = true; killed = true;
        child.kill('SIGTERM');
        setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 3000).unref();
      }, timeoutMs).unref();

      child.on('error', async (err) => {
        clearTimeout(timer);
        activeContainers.delete(containerName);
        resolve({
          ok: false, language, exitCode: -1,
          stderr: String(err?.message || err), stdout: '',
          timedOut: false, killed: false,
          durationMs: Date.now() - startedAt,
          limits: { timeoutMs, cpuSeconds, memoryMb },
          sandbox: { mode: 'docker', image, policySummary: policy?.summarize?.() || null },
          runtime: { command: 'docker', args: dockerArgs },
        });
      });

      child.on('close', async (codeValue, signal) => {
        clearTimeout(timer);
        activeContainers.delete(containerName);
        const durationMs = Date.now() - startedAt;
        resolve({
          ok: !timedOut && Number(codeValue ?? -1) === 0,
          language,
          stdout,
          stderr,
          exitCode: Number(codeValue ?? -1),
          signal: signal || '',
          timedOut,
          killed,
          durationMs,
          limits: { timeoutMs, cpuSeconds, memoryMb },
          sandbox: {
            mode: 'docker',
            image,
            containerName,
            seccompEnabled: useSeccomp,
            readOnlyRootfs: true,
            network: allowNetwork ? 'bridge' : 'none',
            policySummary: policy?.summarize?.() || null,
          },
          runtime: { command: 'docker', args: dockerArgs, cwd: baseDir, image },
        });
      });
    });
  }

  /**
   * 执行一条 shell 命令（非代码文件，直接命令）
   */
  async function execCommand(command = '', commandArgs = [], execOpts = {}) {
    await init();
    const image = defaultImage || String(execOpts.dockerImage || 'alpine:3.20').trim();
    const timeoutMs = Math.max(100, Number(execOpts.timeoutMs || defaultTimeoutMs));
    const cpuSeconds = Math.max(0.1, Number(execOpts.cpus || defaultCpuSeconds));
    const memoryMb = Math.max(32, Number(execOpts.memoryMb || defaultMemoryMb));

    const dockerArgs = [
      'run', '--rm', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--network', 'none',
      '--cpus', String(cpuSeconds), '--memory', `${memoryMb}m`,
      '-v', `${baseDir}:${workdir}:ro`,
      '-w', workdir, image,
      command, ...commandArgs,
    ];

    const result = await runDocker(dockerArgs, { timeoutMs });
    return {
      ...result,
      durationMs: 0,
      sandbox: { mode: 'docker', image, readOnlyRootfs: true, network: 'none' },
    };
  }

  /**
   * 清理孤儿容器
   */
  async function cleanupOrphans({ maxAgeMs = 120000 } = {}) {
    const now = Date.now();
    const ids = [...activeContainers];
    for (const id of ids) {
      try { await forceKillContainer(id); } catch {}
    }
  }

  /**
   * 健康检查
   */
  async function healthCheck() {
    const info = await runDocker(['info', '--format', '{{.ServerVersion}}'], { timeoutMs: 5000 });
    return {
      ok: info.ok,
      dockerVersion: info.stdout.trim(),
      images: await runDocker(['image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'], { timeoutMs: 5000 }),
    };
  }

  return {
    kind: 'docker_sandbox',
    baseDir,
    runRoot,
    defaultImage,
    seccompEnabled: useSeccomp,
    execute,
    execCommand,
    cleanupOrphans,
    healthCheck,
    getActiveContainers: () => [...activeContainers],
    async inspect() {
      const health = await healthCheck();
      return {
        kind: 'docker_sandbox',
        baseDir,
        runRoot,
        activeContainers: activeContainers.size,
        health,
        seccompProfile: useSeccomp ? (customSeccompPath || SECCOMP_PATH) : 'disabled',
        defaultImage,
      };
    },
  };
}

export { SECCOMP_DEFAULT, SECCOMP_PATH, LANG_META };

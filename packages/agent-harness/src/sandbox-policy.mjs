import path from 'node:path';

const DEFAULT_SENSITIVE_PATHS = [
  '/etc',
  '/root/.ssh',
  '/root/.gnupg',
  '/root/.aws',
  '/proc',
  '/sys',
  '/dev',
  '/var/run/docker.sock',
];

function toArray(value = []) {
  return Array.isArray(value) ? value : [];
}

function normalizeAbsList(items = []) {
  return toArray(items)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
}

function normalizeRelPrefixes(items = [], { allowWorkspaceRoot = false } = {}) {
  const normalized = toArray(items)
    .map((item) => String(item || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').trim())
    .filter((item) => allowWorkspaceRoot ? item === '' || Boolean(item) : Boolean(item))
    .map((item) => item === '' ? '' : (item.endsWith('/') ? item : `${item}/`));
  return normalized;
}

function isWithin(baseDir = '', candidate = '') {
  const base = path.resolve(String(baseDir || '.'));
  const target = path.resolve(String(candidate || '.'));
  return target === base || target.startsWith(`${base}${path.sep}`);
}

function matchesPrefix(relPath = '', prefixes = []) {
  const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').trim();
  return prefixes.some((prefix) => prefix === '' || normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

export function createSandboxPolicy({ workspaceDir = '', policy = {} } = {}) {
  const baseDir = path.resolve(String(workspaceDir || '.'));
  const writablePrefixes = normalizeRelPrefixes(policy.writablePrefixes || ['artifacts', 'memory', 'desk', 'bridge']);
  const readablePrefixes = normalizeRelPrefixes(policy.readablePrefixes || [''], { allowWorkspaceRoot: true });
  const searchExcludePrefixes = normalizeRelPrefixes(policy.searchExcludePrefixes || ['desk/outbox']);
  const snapshotExcludePrefixes = normalizeRelPrefixes(policy.snapshotExcludePrefixes || ['desk/outbox']);
  const allowNetwork = policy.allowNetwork === true;
  const seccompProfilePath = String(policy.seccompProfilePath || '').trim();
  const allowedSyscalls = toArray(policy.allowedSyscalls).map((x) => String(x || '').trim()).filter(Boolean);
  const deniedSyscalls = toArray(policy.deniedSyscalls).map((x) => String(x || '').trim()).filter(Boolean);
  const sensitiveAbsPaths = normalizeAbsList([...(policy.sensitivePaths || []), ...DEFAULT_SENSITIVE_PATHS]);

  function resolvePath(targetPath = '.') {
    const resolved = path.resolve(baseDir, String(targetPath || '.'));
    if (!isWithin(baseDir, resolved)) {
      throw new Error(`sandbox_path_escape: ${targetPath}`);
    }
    return resolved;
  }

  function toRelative(targetPath = '.') {
    const resolved = resolvePath(targetPath);
    const rel = path.relative(baseDir, resolved).replace(/\\/g, '/');
    return rel || '.';
  }

  function assertNotSensitive(targetPath = '.') {
    const resolved = path.resolve(String(targetPath || '.'));
    for (const blocked of sensitiveAbsPaths) {
      if (resolved === blocked || resolved.startsWith(`${blocked}${path.sep}`)) {
        throw new Error(`sandbox_sensitive_path_forbidden: ${resolved}`);
      }
    }
  }

  function assertReadable(targetPath = '.') {
    const resolved = resolvePath(targetPath);
    assertNotSensitive(resolved);
    const rel = toRelative(targetPath);
    if (!matchesPrefix(rel, readablePrefixes)) {
      throw new Error(`sandbox_read_forbidden: ${rel}`);
    }
    return resolved;
  }

  function assertWritable(targetPath = '.') {
    const resolved = resolvePath(targetPath);
    assertNotSensitive(resolved);
    const rel = toRelative(targetPath);
    if (rel === '.') throw new Error('sandbox_write_root_forbidden');
    if (!matchesPrefix(rel, writablePrefixes)) {
      throw new Error(`sandbox_write_forbidden: ${rel}`);
    }
    return resolved;
  }

  function buildDockerSecurityArgs() {
    const args = [
      '--network', allowNetwork ? 'bridge' : 'none',
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',
      '--pids-limit', String(Math.max(16, Number(policy.pidsLimit || 64))),
    ];
    if (seccompProfilePath) {
      args.push('--security-opt', `seccomp=${seccompProfilePath}`);
    }
    return args;
  }

  return {
    kind: 'sandbox_policy',
    baseDir,
    writablePrefixes,
    readablePrefixes,
    searchExcludePrefixes,
    snapshotExcludePrefixes,
    sensitiveAbsPaths,
    network: {
      mode: allowNetwork ? 'allow' : 'deny',
      allow: allowNetwork,
    },
    syscall: {
      mode: seccompProfilePath ? 'docker-seccomp' : 'advisory',
      seccompProfilePath,
      allowedSyscalls,
      deniedSyscalls,
    },
    resolvePath,
    toRelative,
    assertReadable,
    assertWritable,
    assertNotSensitive,
    buildDockerSecurityArgs,
    summarize() {
      return {
        baseDir,
        writablePrefixes,
        readablePrefixes,
        searchExcludePrefixes,
        snapshotExcludePrefixes,
        networkMode: allowNetwork ? 'allow' : 'deny',
        syscallMode: seccompProfilePath ? 'docker-seccomp' : 'advisory',
      };
    },
  };
}

export function buildDefaultSandboxPolicy(workspaceDir = '', overrides = {}) {
  return createSandboxPolicy({ workspaceDir, policy: overrides });
}

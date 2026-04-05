import fs from 'node:fs/promises';
import path from 'node:path';

function normalizeBase(baseDir = '') {
  return path.resolve(String(baseDir || '.'));
}

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

export function createWorkspaceSandbox({ workspaceDir = '', policy = {} } = {}) {
  const baseDir = normalizeBase(workspaceDir);
  const writablePrefixes = normalizePrefixList(policy.writablePrefixes || ['artifacts', 'memory', 'desk']);
  const searchExcludePrefixes = normalizePrefixList(policy.searchExcludePrefixes || ['desk/outbox']);
  const snapshotExcludePrefixes = normalizePrefixList(policy.snapshotExcludePrefixes || ['desk/outbox']);
  const maxWriteBytes = Math.max(1024, Number(policy.maxWriteBytes || 65536));
  const maxReadBytes = Math.max(1024, Number(policy.maxReadBytes || 262144));

  function resolvePath(targetPath = '.') {
    const resolved = path.resolve(baseDir, String(targetPath || '.'));
    if (resolved !== baseDir && !resolved.startsWith(`${baseDir}${path.sep}`)) {
      throw new Error(`sandbox_path_escape: ${targetPath}`);
    }
    return resolved;
  }

  function toRel(targetPath = '.') {
    const rel = path.relative(baseDir, resolvePath(targetPath)) || '.';
    return rel === '' ? '.' : rel;
  }

  function assertWriteAllowed(targetPath = '') {
    const rel = toRel(targetPath);
    if (rel === '.') throw new Error('sandbox_write_root_forbidden');
    if (!matchesPrefix(rel, writablePrefixes)) {
      throw new Error(`sandbox_write_forbidden: ${rel}`);
    }
  }

  async function ensureDir(targetPath = '.') {
    await fs.mkdir(resolvePath(targetPath), { recursive: true });
  }

  async function writeText(targetPath = '', content = '') {
    assertWriteAllowed(targetPath);
    const body = String(content || '');
    if (Buffer.byteLength(body, 'utf8') > maxWriteBytes) {
      throw new Error(`sandbox_write_too_large: ${targetPath}`);
    }
    const resolved = resolvePath(targetPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, body, 'utf8');
    return resolved;
  }

  async function appendText(targetPath = '', content = '') {
    assertWriteAllowed(targetPath);
    const body = String(content || '');
    if (Buffer.byteLength(body, 'utf8') > maxWriteBytes) {
      throw new Error(`sandbox_append_too_large: ${targetPath}`);
    }
    const resolved = resolvePath(targetPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.appendFile(resolved, body, 'utf8');
    return resolved;
  }

  async function readText(targetPath = '') {
    const resolved = resolvePath(targetPath);
    const stat = await fs.stat(resolved);
    if (Number(stat.size || 0) > maxReadBytes) {
      throw new Error(`sandbox_read_too_large: ${targetPath}`);
    }
    return fs.readFile(resolved, 'utf8');
  }

  async function list(targetPath = '.', { recursive = false, excludePrefixes = [] } = {}) {
    const root = resolvePath(targetPath);
    const mergedExcludes = normalizePrefixList([...(Array.isArray(excludePrefixes) ? excludePrefixes : [])]);
    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const rows = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full) || '.';
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
        if (needle && text.includes(needle)) {
          hits.push({ path: row.path, match: needle });
        }
      } catch {}
    }
    return hits;
  }

  return {
    kind: 'workspace_sandbox',
    guarded: true,
    baseDir,
    policySummary: {
      writablePrefixes,
      searchExcludePrefixes,
      snapshotExcludePrefixes,
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
  };
}

import fs from 'node:fs/promises';
import path from 'node:path';

function nowIso() {
  return new Date().toISOString();
}

function normalizeJson(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || '',
    };
  }
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJson(item)]));
  }
  if (typeof value === 'function') return '[function]';
  return value;
}

async function ensureParent(filePath = '') {
  if (!filePath) return;
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

export function createToolAuditLog({ filePath = '', eventBus = null, initialEntries = [] } = {}) {
  const resolvedPath = filePath ? path.resolve(filePath) : '';
  const entries = Array.isArray(initialEntries) ? initialEntries.map((entry) => normalizeJson(entry)) : [];
  let counter = entries.length;

  async function append(entry = {}) {
    const normalized = {
      auditId: String(entry.auditId || `tool-audit:${++counter}`),
      ts: String(entry.ts || nowIso()),
      ...normalizeJson(entry),
    };
    entries.push(normalized);
    if (resolvedPath) {
      await ensureParent(resolvedPath);
      await fs.appendFile(resolvedPath, `${JSON.stringify(normalized)}\n`, 'utf8');
    }
    eventBus?.emit?.({
      type: 'tool.audit.appended',
      auditId: normalized.auditId,
      tool: normalized.tool,
      ok: normalized.ok,
      ts: normalized.ts,
    });
    return normalized;
  }

  async function readAll() {
    if (!resolvedPath) return [...entries];
    try {
      const raw = await fs.readFile(resolvedPath, 'utf8');
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line, parseError: true };
          }
        });
    } catch (error) {
      if (error?.code === 'ENOENT') return [...entries];
      throw error;
    }
  }

  async function flushSnapshot({ snapshotPath = '' } = {}) {
    const target = snapshotPath ? path.resolve(snapshotPath) : resolvedPath ? `${resolvedPath}.snapshot.json` : '';
    if (!target) return { snapshotPath: '', count: entries.length };
    await ensureParent(target);
    await fs.writeFile(target, JSON.stringify({ entries }, null, 2), 'utf8');
    return { snapshotPath: target, count: entries.length };
  }

  return {
    kind: 'tool_audit_log',
    path: resolvedPath,
    append,
    readAll,
    flushSnapshot,
    listEntries() {
      return [...entries];
    },
  };
}

export async function appendToolAuditEntry({ filePath = '', entry = {}, eventBus = null } = {}) {
  const log = createToolAuditLog({ filePath, eventBus });
  return log.append(entry);
}

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function noop() {}
function nowIso() { return new Date().toISOString(); }
function toArray(value) { return Array.isArray(value) ? value : (value == null ? [] : [value]); }
function normalizeLevel(level = 'info') {
  const v = String(level || 'info').toLowerCase();
  if (['debug', 'info', 'warn', 'error', 'critical'].includes(v)) return v;
  return 'info';
}
function normalizeAuditType(type = '') {
  const value = String(type || '').trim().toLowerCase();
  return value || 'governance.unknown';
}
function ensureDirSync(dirPath = '') {
  if (!dirPath) return;
  fs.mkdirSync(dirPath, { recursive: true });
}
function safeJsonParse(line = '') {
  try { return JSON.parse(line); } catch { return null; }
}
function matchValue(actual, expected) {
  if (expected == null) return true;
  if (Array.isArray(expected)) return expected.some((item) => matchValue(actual, item));
  if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
  if (typeof expected === 'function') return !!expected(actual);
  if (typeof expected === 'string' && expected.includes('*')) {
    const source = `^${expected.split('*').map((p) => p.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('.*')}$`;
    return new RegExp(source, 'i').test(String(actual ?? ''));
  }
  return String(actual ?? '') === String(expected);
}
function filterRecord(record = {}, query = {}) {
  if (!query || typeof query !== 'object') return true;
  if (query.type && !matchValue(record.type, query.type)) return false;
  if (query.action && !matchValue(record.action, query.action)) return false;
  if (query.level && !matchValue(record.level, query.level)) return false;
  if (query.taskId && !matchValue(record.taskId, query.taskId)) return false;
  if (query.childTaskId && !matchValue(record.childTaskId, query.childTaskId)) return false;
  if (query.assignmentId && !matchValue(record.assignmentId, query.assignmentId)) return false;
  if (query.agentId && !matchValue(record.agent?.id, query.agentId)) return false;
  if (query.role && !matchValue(record.agent?.role, query.role)) return false;
  if (query.riskLevel && !matchValue(record.risk?.level, query.riskLevel)) return false;
  if (query.policyDecision && !matchValue(record.policy?.decision, query.policyDecision)) return false;
  if (query.sensitive && !!record.sensitive !== !!query.sensitive) return false;
  if (query.overreach && !!record.behavior?.overreach !== !!query.overreach) return false;
  if (query.since && String(record.timestamp || '') < String(query.since)) return false;
  if (query.until && String(record.timestamp || '') > String(query.until)) return false;
  return true;
}

export class GovernanceAuditor {
  constructor(options = {}) {
    this.options = options;
    this.enabled = options.enabled !== false;
    this.auditDir = path.resolve(String(options.auditDir || path.resolve(process.cwd(), 'state/governance/audit')));
    this.auditLogPath = String(options.auditLogPath || path.join(this.auditDir, 'audit.jsonl'));
    this.eventBus = options.eventBus || null;
    this.onError = typeof options.onError === 'function' ? options.onError : noop;
    this.retention = {
      maxEntries: Number(options?.retention?.maxEntries || 5000),
    };
    ensureDirSync(this.auditDir);
  }

  getConfig() {
    return {
      enabled: this.enabled,
      auditDir: this.auditDir,
      auditLogPath: this.auditLogPath,
      retention: { ...this.retention },
    };
  }

  createRecord(input = {}) {
    const timestamp = String(input.timestamp || nowIso());
    const type = normalizeAuditType(input.type);
    const record = {
      id: String(input.id || `audit_${randomUUID()}`),
      timestamp,
      type,
      action: String(input.action || ''),
      status: String(input.status || ''),
      level: normalizeLevel(input.level || (input.behavior?.overreach ? 'warn' : 'info')),
      message: String(input.message || ''),
      taskId: input.taskId ? String(input.taskId) : '',
      childTaskId: input.childTaskId ? String(input.childTaskId) : '',
      assignmentId: input.assignmentId ? String(input.assignmentId) : '',
      teamId: input.teamId ? String(input.teamId) : '',
      scopeKey: input.scopeKey ? String(input.scopeKey) : '',
      agent: {
        id: input.agent?.id ? String(input.agent.id) : '',
        role: input.agent?.role ? String(input.agent.role) : '',
        node: input.agent?.node ? String(input.agent.node) : '',
        sessionKey: input.agent?.sessionKey ? String(input.agent.sessionKey) : '',
      },
      behavior: {
        overreach: !!input.behavior?.overreach,
        sensitiveOperation: !!input.behavior?.sensitiveOperation,
        categories: toArray(input.behavior?.categories).map((v) => String(v)),
      },
      target: input.target && typeof input.target === 'object' ? input.target : {},
      risk: input.risk && typeof input.risk === 'object' ? input.risk : {},
      policy: input.policy && typeof input.policy === 'object' ? input.policy : {},
      sensitive: !!input.sensitive,
      tags: toArray(input.tags).map((v) => String(v)),
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    };
    return record;
  }

  async log(input = {}) {
    if (!this.enabled) return { ok: true, skipped: true, reason: 'disabled' };
    const record = this.createRecord(input);
    await fsp.mkdir(this.auditDir, { recursive: true });
    await fsp.appendFile(this.auditLogPath, `${JSON.stringify(record)}\n`, 'utf8');
    if (this.eventBus?.publish) {
      try {
        await this.eventBus.publish({
          type: 'governance.audit.logged',
          visibility: 'audit',
          important: record.level === 'critical' || record.level === 'error',
          priority: record.level === 'critical' ? 'critical' : 'normal',
          payload: record,
          meta: {
            taskId: record.taskId,
            childTaskId: record.childTaskId,
            assignmentId: record.assignmentId,
            auditId: record.id,
          },
        });
      } catch (err) {
        this.onError(err, record);
      }
    }
    return { ok: true, record, path: this.auditLogPath };
  }

  async logTaskLifecycle({ action = '', status = '', taskId = '', childTaskId = '', assignmentId = '', teamId = '', role = '', agentId = '', scopeKey = '', message = '', risk = {}, policy = {}, metadata = {} } = {}) {
    return this.log({
      type: 'governance.task.lifecycle',
      action,
      status,
      taskId,
      childTaskId,
      assignmentId,
      teamId,
      scopeKey,
      message,
      agent: { id: agentId || role, role },
      risk,
      policy,
      metadata,
      tags: ['task', action || 'unknown'],
    });
  }

  async logAgentBehavior({ action = '', taskId = '', childTaskId = '', assignmentId = '', teamId = '', role = '', agentId = '', message = '', overreach = false, sensitiveOperation = false, categories = [], target = {}, risk = {}, policy = {}, metadata = {} } = {}) {
    return this.log({
      type: 'governance.agent.behavior',
      action,
      status: overreach ? 'flagged' : 'observed',
      taskId,
      childTaskId,
      assignmentId,
      teamId,
      message,
      sensitive: !!sensitiveOperation,
      level: overreach ? 'warn' : (sensitiveOperation ? 'info' : 'debug'),
      agent: { id: agentId || role, role },
      behavior: { overreach, sensitiveOperation, categories },
      target,
      risk,
      policy,
      metadata,
      tags: ['agent-behavior', action || 'observed'],
    });
  }

  async query(query = {}) {
    const limit = Math.max(1, Number(query.limit || 100));
    if (!fs.existsSync(this.auditLogPath)) {
      return { ok: true, records: [], total: 0, path: this.auditLogPath };
    }
    const raw = await fsp.readFile(this.auditLogPath, 'utf8');
    const lines = String(raw || '').split(/\r?\n/).filter(Boolean);
    const records = [];
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const parsed = safeJsonParse(lines[i]);
      if (!parsed) continue;
      if (!filterRecord(parsed, query)) continue;
      records.push(parsed);
      if (records.length >= limit) break;
    }
    return { ok: true, records, total: records.length, path: this.auditLogPath };
  }

  async listRecent(limit = 50) {
    return this.query({ limit });
  }
}

export function createGovernanceAuditor(options = {}) {
  return new GovernanceAuditor(options);
}

export default { GovernanceAuditor, createGovernanceAuditor };

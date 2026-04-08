import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function nowIso() { return new Date().toISOString(); }
function ensureDirSync(dirPath = '') {
  if (!dirPath) return;
  fs.mkdirSync(dirPath, { recursive: true });
}
function safeJsonParse(text = '', fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}
function normalizeStatus(status = 'pending') {
  const value = String(status || 'pending').trim().toLowerCase();
  return ['pending', 'approved', 'rejected'].includes(value) ? value : 'pending';
}
function normalizeRiskLevel(level = 'low') {
  const value = String(level || 'low').trim().toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(value) ? value : 'low';
}
function resolveScope(input = {}) {
  return String(
    input.scope
    || input.scopeKey
    || input.details?.scope
    || input.details?.scopeKey
    || input.metadata?.scope
    || input.metadata?.scopeKey
    || ''
  ).trim();
}
function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export class GovernanceApprovalQueue {
  constructor(options = {}) {
    this.options = options;
    this.pendingDir = path.resolve(String(options.pendingDir || path.resolve(process.cwd(), 'state/governance/pending')));
    this.auditor = options.auditor || null;
    this.teamStore = options.teamStore || null;
    this.items = new Map();
    ensureDirSync(this.pendingDir);
    this.loadFromDisk();
  }

  getConfig() {
    return {
      pendingDir: this.pendingDir,
      count: this.items.size,
    };
  }

  loadFromDisk() {
    ensureDirSync(this.pendingDir);
    const names = fs.readdirSync(this.pendingDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort();
    for (const name of names) {
      const filePath = path.join(this.pendingDir, name);
      const parsed = safeJsonParse(fs.readFileSync(filePath, 'utf8'), null);
      if (!parsed?.approvalId) continue;
      const normalized = this.normalizeRecord(parsed);
      this.items.set(normalized.approvalId, normalized);
    }
  }

  normalizeRecord(input = {}) {
    const status = normalizeStatus(input.status || 'pending');
    const createdAt = String(input.createdAt || nowIso());
    const updatedAt = String(input.updatedAt || createdAt);
    const approvalId = String(input.approvalId || `approval_${randomUUID()}`);
    const scope = resolveScope(input);
    return {
      approvalId,
      taskId: String(input.taskId || ''),
      riskLevel: normalizeRiskLevel(input.riskLevel || 'low'),
      reason: String(input.reason || ''),
      operator: String(input.operator || ''),
      scope,
      status,
      comment: String(input.comment || ''),
      details: input.details && typeof input.details === 'object' ? clone(input.details) : {},
      metadata: input.metadata && typeof input.metadata === 'object' ? clone(input.metadata) : {},
      createdAt,
      updatedAt,
      decidedAt: input.decidedAt ? String(input.decidedAt) : '',
      approvedBy: input.approvedBy ? String(input.approvedBy) : '',
      rejectedBy: input.rejectedBy ? String(input.rejectedBy) : '',
    };
  }

  getFilePath(approvalId = '') {
    return path.join(this.pendingDir, `${String(approvalId || '').trim()}.json`);
  }

  persist(record = {}) {
    const normalized = this.normalizeRecord(record);
    ensureDirSync(this.pendingDir);
    fs.writeFileSync(this.getFilePath(normalized.approvalId), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    this.items.set(normalized.approvalId, normalized);
    return normalized;
  }

  emitAudit(type = '', record = {}, extra = {}) {
    if (!this.auditor?.log) return;
    void this.auditor.log({
      type,
      action: String(extra.action || ''),
      status: String(record.status || ''),
      level: record.status === 'rejected' ? 'warn' : 'info',
      message: String(extra.message || record.reason || ''),
      taskId: record.taskId,
      scopeKey: record.scope,
      risk: { level: record.riskLevel },
      policy: { decision: record.status === 'pending' ? 'require-approval' : record.status },
      metadata: {
        approvalId: record.approvalId,
        operator: record.operator,
        approvedBy: record.approvedBy,
        rejectedBy: record.rejectedBy,
        comment: record.comment,
        details: record.details,
        ...clone(extra.metadata || {}),
      },
      tags: ['approval', String(record.status || 'unknown')],
    });
  }

  maybeUpdateTask(record = {}) {
    if (!record?.taskId || !this.teamStore?.getTaskById || !this.teamStore?.updateTaskMetadata) return;
    const task = this.teamStore.getTaskById(String(record.taskId || ''));
    if (!task) return;
    const existing = task?.metadata?.governanceApproval || {};
    this.teamStore.updateTaskMetadata({
      taskId: record.taskId,
      metadata: {
        governanceApproval: {
          ...existing,
          approvalId: record.approvalId,
          status: record.status,
          riskLevel: record.riskLevel,
          scope: record.scope,
          reason: record.reason,
          operator: record.operator,
          comment: record.comment,
          updatedAt: record.updatedAt,
          decidedAt: record.decidedAt,
          approvedBy: record.approvedBy,
          rejectedBy: record.rejectedBy,
        },
      },
      updatedAt: Date.now(),
    });
  }

  submitApprovalRequest({ taskId, riskLevel, reason, operator, details = {}, metadata = {}, scope } = {}) {
    const approvalId = `approval_${randomUUID()}`;
    const createdAt = nowIso();
    const record = this.persist({
      approvalId,
      taskId,
      riskLevel,
      reason,
      operator,
      details,
      metadata,
      scope,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    });
    this.maybeUpdateTask(record);
    this.emitAudit('governance.approval.submitted', record, {
      action: 'approval_request_submitted',
      message: reason,
    });
    return { ok: true, approvalId: record.approvalId, record: clone(record) };
  }

  listPending(scope = '') {
    const normalizedScope = String(scope || '').trim();
    const items = [...this.items.values()]
      .filter((item) => item.status === 'pending')
      .filter((item) => !normalizedScope || item.scope === normalizedScope)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .map((item) => clone(item));
    return { ok: true, items, total: items.length, scope: normalizedScope };
  }

  getApprovalById(approvalId = '') {
    const item = this.items.get(String(approvalId || '').trim());
    return item ? clone(item) : null;
  }

  transition(approvalId, nextStatus, actorField, actor, comment = '') {
    const existing = this.items.get(String(approvalId || '').trim());
    if (!existing) throw new Error('approval_not_found');
    if (existing.status !== 'pending') throw new Error('approval_already_decided');
    const decidedAt = nowIso();
    const record = this.persist({
      ...existing,
      status: nextStatus,
      comment: String(comment || ''),
      [actorField]: String(actor || ''),
      decidedAt,
      updatedAt: decidedAt,
    });
    this.maybeUpdateTask(record);
    this.emitAudit(
      nextStatus === 'approved' ? 'governance.approval.approved' : 'governance.approval.rejected',
      record,
      {
        action: nextStatus === 'approved' ? 'approval_request_approved' : 'approval_request_rejected',
        message: String(comment || record.reason || ''),
      },
    );
    return { ok: true, approvalId: record.approvalId, record: clone(record) };
  }

  approve(approvalId, approvedBy, comment = '') {
    return this.transition(approvalId, 'approved', 'approvedBy', approvedBy, comment);
  }

  reject(approvalId, rejectedBy, comment = '') {
    return this.transition(approvalId, 'rejected', 'rejectedBy', rejectedBy, comment);
  }
}

export function createGovernanceApprovalQueue(options = {}) {
  return new GovernanceApprovalQueue(options);
}

export default { GovernanceApprovalQueue, createGovernanceApprovalQueue };

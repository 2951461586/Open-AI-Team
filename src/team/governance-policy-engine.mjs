import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function toArray(value) { return Array.isArray(value) ? value : (value == null ? [] : [value]); }
function wildcardToRegExp(pattern = '*') {
  const escaped = String(pattern || '*').replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}
function matchPattern(actual, expected) {
  if (expected == null || expected === '') return true;
  if (Array.isArray(expected)) return expected.some((item) => matchPattern(actual, item));
  if (typeof expected === 'string' && expected.includes('*')) return wildcardToRegExp(expected).test(String(actual ?? ''));
  return String(actual ?? '') === String(expected);
}
function getByPath(source = {}, pathExpr = '') {
  return String(pathExpr || '').split('.').filter(Boolean).reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
}
function evaluatePredicate(predicate = {}, context = {}) {
  if (!predicate || typeof predicate !== 'object') return true;
  const field = String(predicate.field || '').trim();
  const op = String(predicate.op || 'eq').trim().toLowerCase();
  const expected = predicate.value;
  const actual = field ? getByPath(context, field) : undefined;
  switch (op) {
    case 'eq': return String(actual ?? '') === String(expected ?? '');
    case 'neq': return String(actual ?? '') !== String(expected ?? '');
    case 'in': return toArray(expected).map(String).includes(String(actual ?? ''));
    case 'not-in': return !toArray(expected).map(String).includes(String(actual ?? ''));
    case 'includes': return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'matches': return matchPattern(actual, expected);
    case 'exists': return actual !== undefined && actual !== null && actual !== '';
    default: return false;
  }
}

export class GovernancePolicyEngine {
  constructor(options = {}) {
    this.options = options;
    this.eventBus = options.eventBus || null;
    this.policyPath = path.resolve(String(options.policyPath || path.resolve(process.cwd(), 'config/team/governance-policies.json')));
    this.defaultDecision = String(options.defaultDecision || 'allow');
    this.version = 'unloaded';
    this.policies = [];
    this.metadata = {};
    this.loadPoliciesSync();
  }

  loadPoliciesSync() {
    try {
      if (!fs.existsSync(this.policyPath)) {
        this.version = 'missing';
        this.policies = [];
        this.metadata = { path: this.policyPath, loaded: false };
        return this.metadata;
      }
      const parsed = JSON.parse(fs.readFileSync(this.policyPath, 'utf8'));
      this.version = String(parsed.version || '1');
      this.policies = toArray(parsed.rules).map((rule, index) => ({
        id: String(rule.id || `rule_${index + 1}`),
        description: String(rule.description || ''),
        decision: String(rule.decision || 'allow'),
        priority: Number(rule.priority || 1000 + index),
        match: rule.match && typeof rule.match === 'object' ? rule.match : {},
        conditions: toArray(rule.conditions || []),
        metadata: rule.metadata && typeof rule.metadata === 'object' ? rule.metadata : {},
      })).sort((a, b) => a.priority - b.priority);
      this.metadata = {
        path: this.policyPath,
        loaded: true,
        version: this.version,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        ruleCount: this.policies.length,
      };
      return this.metadata;
    } catch (err) {
      this.version = 'error';
      this.policies = [];
      this.metadata = { path: this.policyPath, loaded: false, error: String(err?.message || err) };
      return this.metadata;
    }
  }

  async reload() {
    const meta = this.loadPoliciesSync();
    if (this.eventBus?.publish) {
      await this.eventBus.publish({
        type: 'governance.policy.reloaded',
        visibility: 'audit',
        payload: meta,
        meta: { version: meta.version || '', path: this.policyPath },
      }).catch(() => {});
    }
    return meta;
  }

  getVersion() { return this.version; }
  getMetadata() { return { ...this.metadata }; }
  listRules() { return this.policies.map((rule) => ({ ...rule })); }

  matchesRule(rule = {}, context = {}) {
    const match = rule.match || {};
    if (match.taskMode && !matchPattern(context.taskMode, match.taskMode)) return false;
    if (match.role && !matchPattern(context.role, match.role)) return false;
    if (match.operationType && !matchPattern(context.operationType, match.operationType)) return false;
    if (match.riskLevel && !matchPattern(context.riskLevel, match.riskLevel)) return false;
    if (match.tool && !matchPattern(context.tool, match.tool)) return false;
    if (match.path && !matchPattern(context.path, match.path)) return false;
    if (match.url && !matchPattern(context.url, match.url)) return false;
    return toArray(rule.conditions).every((predicate) => evaluatePredicate(predicate, context));
  }

  evaluate(context = {}) {
    for (const rule of this.policies) {
      if (!this.matchesRule(rule, context)) continue;
      return {
        matched: true,
        decision: rule.decision,
        ruleId: rule.id,
        description: rule.description,
        version: this.version,
        metadata: rule.metadata || {},
      };
    }
    return {
      matched: false,
      decision: this.defaultDecision,
      ruleId: '',
      description: 'default_policy',
      version: this.version,
      metadata: {},
    };
  }
}

export function createGovernancePolicyEngine(options = {}) {
  return new GovernancePolicyEngine(options);
}

export default { GovernancePolicyEngine, createGovernancePolicyEngine };

/**
 * team-governance-runtime.mjs
 *
 * P6: Unified governance runtime — loads governance.json and provides
 * a single API for all pipeline stage decisions.
 *
 * Replaces scattered logic across team-policy.mjs, team-runtime-*.mjs,
 * and team-governance-config.mjs with a single source of truth.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGovernanceAuditor } from './governance-auditor.mjs';
import { createGovernanceRiskAssessment } from './governance-risk-assessment.mjs';
import { createGovernancePolicyEngine } from './governance-policy-engine.mjs';
import { createGovernanceApprovalQueue } from './governance-approval-queue.mjs';

const __dirname = typeof import.meta?.url === 'string'
  ? dirname(fileURLToPath(import.meta.url))
  : process.cwd();

/**
 * Load and validate the governance contract.
 * @param {string} [configPath] - Path to governance.json
 * @returns {object} Parsed governance config
 */
function loadGovernanceConfig(configPath) {
  const explicitPath = configPath instanceof URL
    ? fileURLToPath(configPath)
    : (typeof configPath === 'string' && configPath.trim() ? configPath.trim() : '');

  const candidates = explicitPath
    ? [explicitPath]
    : [
        join(__dirname, '..', '..', 'config', 'team', 'governance.json'),
        join(__dirname, '..', '..', 'config', 'governance.json'),
      ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      if (!existsSync(candidate)) continue;
      const raw = readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        config: parsed,
        meta: {
          path: candidate,
          explicit: !!explicitPath,
          usedFallback: !explicitPath && i > 0,
        },
      };
    } catch (err) {
      console.warn(`[governance] Failed to load governance config from ${candidate}: ${err?.message || err}`);
      if (explicitPath) break;
    }
  }

  if (explicitPath) {
    console.warn(`[governance] Failed to load explicit governance config: ${explicitPath}; using defaults`);
  } else {
    console.warn('[governance] Failed to load governance config from default paths; using defaults');
  }
  return {
    config: null,
    meta: {
      path: explicitPath || '',
      explicit: !!explicitPath,
      usedFallback: false,
    },
  };
}

/**
 * Evaluate a simple condition expression against a context object.
 * Supports: ==, !=, >=, &&, ||, parentheses NOT supported (keep conditions flat).
 */
function evaluateCondition(expr = '', ctx = {}) {
  const s = String(expr || '').trim();
  if (!s) return false;

  // Handle && and ||
  if (s.includes('&&')) {
    return s.split('&&').every((part) => evaluateCondition(part.trim(), ctx));
  }
  if (s.includes('||')) {
    return s.split('||').some((part) => evaluateCondition(part.trim(), ctx));
  }

  // Simple comparison: key op value
  const match = s.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*['"]*([^'"]*)['"]*$/);
  if (!match) return false;
  const [, key, op, val] = match;
  const actual = ctx[key];
  const expected = isNaN(Number(val)) ? val : Number(val);
  const actualNum = typeof actual === 'number' ? actual : Number(actual);

  switch (op) {
    case '==': return String(actual) === String(expected);
    case '!=': return String(actual) !== String(expected);
    case '>=': return actualNum >= Number(expected);
    case '<=': return actualNum <= Number(expected);
    case '>': return actualNum > Number(expected);
    case '<': return actualNum < Number(expected);
    default: return false;
  }
}

export function createGovernanceRuntime(configPath, options = {}) {
  const loaded = loadGovernanceConfig(configPath);
  const config = loaded?.config || null;
  const configMeta = loaded?.meta || { path: '', explicit: false, usedFallback: false };
  const pipeline = config?.pipeline || {};
  const stageRules = pipeline?.stageRules || {};
  const reviewLoop = pipeline?.reviewLoop || {};
  const dynamicReplan = pipeline?.dynamicReplan || {};
  const escalation = config?.escalation || {};
  const routing = config?.routing || {};
  const lifecycle = config?.lifecycle || {};
  const observability = config?.observability || {};
  const errorRecovery = config?.errorRecovery || {};
  const governanceRuntimeConfig = config?.governanceRuntime || {};
  const runtimeRoot = join(__dirname, '..', '..');
  const resolveFromRoot = (value, fallback) => resolve(runtimeRoot, String(value || fallback || ''));
  const auditor = options.auditor || createGovernanceAuditor({
    ...(governanceRuntimeConfig.audit || {}),
    auditDir: resolveFromRoot(governanceRuntimeConfig?.audit?.auditDir, 'state/governance/audit'),
    auditLogPath: resolveFromRoot(governanceRuntimeConfig?.audit?.auditLogPath, 'state/governance/audit/audit.jsonl'),
    eventBus: options.eventBus,
  });
  const riskAssessment = createGovernanceRiskAssessment(governanceRuntimeConfig.risk || {});
  const policyEngine = createGovernancePolicyEngine({
    ...(governanceRuntimeConfig.policy || {}),
    policyPath: resolveFromRoot(governanceRuntimeConfig?.policy?.policyPath, 'config/team/governance-policies.json'),
    eventBus: options.eventBus,
  });
  const approvalQueue = createGovernanceApprovalQueue({
    ...(governanceRuntimeConfig.approvals || {}),
    pendingDir: resolveFromRoot(governanceRuntimeConfig?.approvals?.pendingDir, 'state/governance/pending'),
    auditor,
    teamStore: options.teamStore,
  });

  function mapRiskToOperationType(task = {}) {
    const surfaces = Array.isArray(task?.executionSurfaces) ? task.executionSurfaces : [];
    if (surfaces.some((s) => String(s?.type || s).toLowerCase() === 'exec')) return 'exec';
    if (surfaces.some((s) => String(s?.type || s).toLowerCase() === 'network')) return 'network';
    if (surfaces.some((s) => String(s?.type || s).toLowerCase() === 'filesystem')) return 'filesystem';
    return String(task?.operationType || '').toLowerCase();
  }

  /**
   * Check if a pipeline stage should be skipped for a given task context.
   * @param {string} stage - e.g. 'critic', 'judge'
   * @param {object} ctx - { taskMode, riskLevel, ... }
   * @returns {{ skip: boolean, reason: string }}
   */
  function shouldSkipStage(stage = '', ctx = {}) {
    const rules = stageRules[stage];
    if (!rules) return { skip: false, reason: '' };
    if (rules.required) return { skip: false, reason: 'required_stage' };
    for (const cond of (rules.skipConditions || [])) {
      if (evaluateCondition(cond.when, ctx)) {
        return { skip: true, reason: String(cond.reason || cond.when) };
      }
    }
    return { skip: false, reason: '' };
  }

  /**
   * Get timeout for a stage.
   */
  function getStageTimeout(stage = '') {
    const rules = stageRules[stage];
    return {
      defaultMs: Number(rules?.timeout?.defaultMs || 120000),
      maxMs: Number(rules?.timeout?.maxMs || 300000),
    };
  }

  /**
   * Get retry config for a stage.
   */
  function getStageRetry(stage = '') {
    const rules = stageRules[stage];
    return {
      maxAttempts: Number(rules?.retry?.maxAttempts || 1),
      backoffMs: Number(rules?.retry?.backoffMs || 5000),
    };
  }

  /**
   * Check if escalation to human is needed.
   */
  function shouldEscalateToHuman(ctx = {}) {
    for (const cond of (escalation?.escalateToHuman?.conditions || [])) {
      if (evaluateCondition(cond.when, ctx)) {
        return { escalate: true, action: cond.action, reason: cond.when };
      }
    }
    return { escalate: false, action: '', reason: '' };
  }

  /**
   * Get routing configuration.
   */
  function getRoutingConfig() {
    return {
      strategy: String(routing.strategy || 'static'),
      affinityBonus: Number(routing.affinityBonus || 15),
      fallbackPolicy: String(routing.fallbackPolicy || 'degrade_to_available'),
      nodeConstraints: routing.nodeConstraints || {},
    };
  }

  /**
   * Check if a node can accept more tasks.
   */
  function canNodeAcceptTask(node = '', currentTaskCount = 0) {
    const constraints = routing.nodeConstraints?.[node];
    if (!constraints) return true;
    const max = Number(constraints.maxConcurrentTasks || Infinity);
    return currentTaskCount < max;
  }

  /**
   * Check if a role is allowed on a node.
   */
  function isRoleAllowedOnNode(role = '', node = '') {
    const constraints = routing.nodeConstraints?.[node];
    if (!constraints) return true;
    if (constraints.roles === 'all') return true;
    if (Array.isArray(constraints.roles)) return constraints.roles.includes(role);
    return true;
  }

  /**
   * Get lifecycle timings.
   */
  function getLifecycleConfig() {
    return {
      heartbeatIntervalMs: Number(lifecycle.heartbeatIntervalMs || 60000),
      leaseDefaultMs: Number(lifecycle.leaseDefaultMs || 300000),
      gracePeriodMs: Number(lifecycle.gracePeriodMs || 90000),
      sweepIntervalMs: Number(lifecycle.sweepIntervalMs || 30000),
    };
  }

  /**
   * Get the full config for inspection.
   */
  function getConfig() {
    return config;
  }

  function getConfigMeta() {
    return {
      ...configMeta,
      version: String(config?.version || ''),
      loaded: !!config,
    };
  }

  /**
   * Get review loop configuration.
   */
  function getReviewLoopConfig() {
    return {
      enabled: reviewLoop.enabled !== false,
      maxRevisions: Number(reviewLoop.maxRevisions || 2),
      triggerOnVerdict: Array.isArray(reviewLoop.triggerOnVerdict) ? reviewLoop.triggerOnVerdict : ['revise'],
      skipOnVerdict: Array.isArray(reviewLoop.skipOnVerdict) ? reviewLoop.skipOnVerdict : ['approve', 'approve_with_notes'],
      escalateOnVerdict: Array.isArray(reviewLoop.escalateOnVerdict) ? reviewLoop.escalateOnVerdict : ['escalate_human'],
      revisionTimeoutMs: Number(reviewLoop.revisionTimeoutMs || 300000),
    };
  }

  /**
   * Check if a review verdict triggers revision loop.
   * @param {string} verdict - e.g. 'revise', 'approve', 'escalate_human'
   * @returns {{ action: 'revise'|'approve'|'escalate', reason: string }}
   */
  function resolveReviewVerdict(verdict = '') {
    const v = String(verdict || '').trim().toLowerCase();
    const cfg = getReviewLoopConfig();
    if (!cfg.enabled) return { action: 'approve', reason: 'review_loop_disabled' };
    if (cfg.escalateOnVerdict.includes(v)) return { action: 'escalate', reason: `verdict_${v}` };
    if (cfg.triggerOnVerdict.includes(v)) return { action: 'revise', reason: `verdict_${v}` };
    return { action: 'approve', reason: `verdict_${v}_passthrough` };
  }

  /**
   * Get error recovery configuration.
   */
  function getErrorRecoveryConfig() {
    const autoRetry = errorRecovery?.autoRetry || {};
    const partialSuccess = errorRecovery?.partialSuccess || {};
    const degradation = errorRecovery?.degradation || {};
    return {
      autoRetry: {
        enabled: autoRetry.enabled !== false,
        maxRetries: Number(autoRetry.maxRetries || 2),
        retryableErrors: Array.isArray(autoRetry.retryableErrors) ? autoRetry.retryableErrors : ['timeout', 'spawn_failed', 'session_failed'],
        backoffMs: Number(autoRetry.backoffMs || 5000),
      },
      partialSuccess: {
        enabled: partialSuccess.enabled !== false,
        preserveCompletedResults: partialSuccess.preserveCompletedResults !== false,
        retryFailedOnly: partialSuccess.retryFailedOnly !== false,
      },
      degradation: {
        enabled: degradation.enabled !== false,
        fallbackToNativeChat: degradation.fallbackToNativeChat !== false,
        fallbackToTLDirect: degradation.fallbackToTLDirect !== false,
      },
    };
  }

  /**
   * Check if an error is retryable based on config.
   */
  function isRetryableError(errorText = '') {
    const cfg = getErrorRecoveryConfig();
    if (!cfg.autoRetry.enabled) return false;
    const lower = String(errorText || '').toLowerCase();
    return cfg.autoRetry.retryableErrors.some((pattern) => lower.includes(pattern));
  }

  /**
   * Get dynamic replan configuration.
   */
  function getDynamicReplanConfig() {
    return {
      enabled: dynamicReplan.enabled !== false,
      maxDynamicLayers: Number(dynamicReplan.maxDynamicLayers || 3),
      maxDynamicWorkItems: Number(dynamicReplan.maxDynamicWorkItems || 8),
      allowedRoles: Array.isArray(dynamicReplan.allowedRoles) ? dynamicReplan.allowedRoles : ['executor'],
      requireTLApproval: !!dynamicReplan.requireTLApproval,
    };
  }

  function evaluateTaskRisk(task = {}) {
    return riskAssessment.assessTask(task);
  }

  function evaluatePolicy(context = {}) {
    return policyEngine.evaluate(context);
  }

  function checkExecutionPermission(task = {}) {
    const risk = evaluateTaskRisk(task);
    const operationType = mapRiskToOperationType(task);
    const policy = evaluatePolicy({
      ...task,
      operationType,
      riskLevel: risk.level,
    });
    const decision = policy.decision === 'deny'
      ? 'deny'
      : ((policy.decision === 'require-approval' || risk.requiresApproval) ? 'require-approval' : 'allow');

    let approval = null;
    if (decision === 'require-approval') {
      const submitted = approvalQueue.submitApprovalRequest({
        taskId: task.taskId,
        riskLevel: risk.level,
        reason: [
          String(policy.reason || '').trim(),
          ...(Array.isArray(risk.reasons) ? risk.reasons : []),
        ].filter(Boolean).join(', ') || 'approval_required',
        operator: String(task.role || task.operator || task.agentId || 'unknown'),
        scope: String(task.scope || task.scopeKey || ''),
        details: {
          assignmentId: String(task.assignmentId || ''),
          childTaskId: String(task.childTaskId || ''),
          taskMode: String(task.taskMode || ''),
          operationType,
          command: String(task.command || ''),
          path: String(task.path || ''),
          url: String(task.url || ''),
          method: String(task.method || ''),
          executionSurfaces: Array.isArray(task.executionSurfaces) ? task.executionSurfaces : [],
          risk,
          policy,
        },
      });
      approval = { approvalId: submitted.approvalId, status: 'pending' };
    }

    return {
      ok: decision !== 'deny',
      decision,
      risk,
      policy: { ...policy, decision },
      requiresApproval: decision === 'require-approval',
      blocked: decision === 'deny' || risk.blocked,
      approval,
      approvalId: approval?.approvalId || '',
    };
  }

  async function auditTaskEvent(payload = {}) {
    return auditor.logTaskLifecycle(payload);
  }

  async function auditAgentBehavior(payload = {}) {
    return auditor.logAgentBehavior(payload);
  }

  async function queryAuditTrail(query = {}) {
    return auditor.query(query);
  }

  async function reloadPolicies() {
    return policyEngine.reload();
  }

  function listPendingApprovals(scope = '') {
    return approvalQueue.listPending(scope);
  }

  function approvePending(approvalId = '', approvedBy = '', comment = '') {
    return approvalQueue.approve(approvalId, approvedBy, comment);
  }

  function rejectPending(approvalId = '', rejectedBy = '', comment = '') {
    return approvalQueue.reject(approvalId, rejectedBy, comment);
  }

  return {
    shouldSkipStage,
    getStageTimeout,
    getStageRetry,
    shouldEscalateToHuman,
    getRoutingConfig,
    canNodeAcceptTask,
    isRoleAllowedOnNode,
    getLifecycleConfig,
    getConfig,
    getConfigMeta,
    getReviewLoopConfig,
    resolveReviewVerdict,
    getErrorRecoveryConfig,
    isRetryableError,
    getDynamicReplanConfig,
    evaluateTaskRisk,
    evaluatePolicy,
    checkExecutionPermission,
    auditTaskEvent,
    auditAgentBehavior,
    queryAuditTrail,
    reloadPolicies,
    listPendingApprovals,
    approvePending,
    rejectPending,
    auditor,
    riskAssessment,
    policyEngine,
    approvalQueue,
    observability,
  };
}

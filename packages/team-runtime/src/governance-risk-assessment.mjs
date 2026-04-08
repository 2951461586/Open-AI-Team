function normalizeRiskLevel(level = 'low') {
  const value = String(level || 'low').trim().toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(value) ? value : 'low';
}

function riskScoreToLevel(score = 0, thresholds = {}) {
  const criticalMin = Number(thresholds.criticalMin ?? 90);
  const highMin = Number(thresholds.highMin ?? 65);
  const mediumMin = Number(thresholds.mediumMin ?? 30);
  if (score >= criticalMin) return 'critical';
  if (score >= highMin) return 'high';
  if (score >= mediumMin) return 'medium';
  return 'low';
}

function toArray(value) {
  return Array.isArray(value) ? value : (value == null ? [] : [value]);
}

function includesAny(text = '', patterns = []) {
  const lower = String(text || '').toLowerCase();
  return toArray(patterns).some((item) => lower.includes(String(item || '').toLowerCase()));
}

export class GovernanceRiskAssessment {
  constructor(options = {}) {
    this.options = options;
    this.enabled = options.enabled !== false;
    this.thresholds = {
      mediumMin: Number(options?.thresholds?.mediumMin ?? 30),
      highMin: Number(options?.thresholds?.highMin ?? 65),
      criticalMin: Number(options?.thresholds?.criticalMin ?? 90),
      approvalMinLevel: normalizeRiskLevel(options?.thresholds?.approvalMinLevel || 'high'),
      blockMinLevel: normalizeRiskLevel(options?.thresholds?.blockMinLevel || 'critical'),
    };
    this.weights = {
      exec: Number(options?.weights?.exec ?? 35),
      network: Number(options?.weights?.network ?? 25),
      filesystem: Number(options?.weights?.filesystem ?? 20),
      destructive: Number(options?.weights?.destructive ?? 30),
      privileged: Number(options?.weights?.privileged ?? 25),
      externalWrite: Number(options?.weights?.externalWrite ?? 20),
      unknownTool: Number(options?.weights?.unknownTool ?? 15),
      sensitivePath: Number(options?.weights?.sensitivePath ?? 15),
    };
    this.indicators = {
      destructiveCommands: toArray(options?.indicators?.destructiveCommands || ['rm ', 'mkfs', 'dd ', 'shutdown', 'reboot', 'chmod 777', 'chown -R', 'iptables', 'ufw reset']),
      privilegedCommands: toArray(options?.indicators?.privilegedCommands || ['sudo ', 'su ', 'doas ']),
      networkCommands: toArray(options?.indicators?.networkCommands || ['curl ', 'wget ', 'nc ', 'ssh ', 'scp ', 'rsync ', 'http://', 'https://']),
      sensitivePaths: toArray(options?.indicators?.sensitivePaths || ['/etc/', '/root/', '~/.ssh', '.env', 'id_rsa', 'authorized_keys']),
    };
  }

  getConfig() {
    return {
      enabled: this.enabled,
      thresholds: { ...this.thresholds },
      weights: { ...this.weights },
      indicators: { ...this.indicators },
    };
  }

  assessOperation(operation = {}) {
    const reasons = [];
    let score = 0;
    const type = String(operation.type || operation.operationType || '').toLowerCase();
    const command = String(operation.command || operation.shell || '').trim();
    const targetPath = String(operation.path || operation.targetPath || '').trim();
    const url = String(operation.url || '').trim();
    const method = String(operation.method || '').trim().toUpperCase();

    if (type === 'exec' || command) {
      score += this.weights.exec;
      reasons.push('operation.exec');
      if (includesAny(command, this.indicators.destructiveCommands)) {
        score += this.weights.destructive;
        reasons.push('exec.destructive');
      }
      if (includesAny(command, this.indicators.privilegedCommands)) {
        score += this.weights.privileged;
        reasons.push('exec.privileged');
      }
      if (includesAny(command, this.indicators.networkCommands)) {
        score += this.weights.network;
        reasons.push('exec.network');
      }
    }

    if (type === 'network' || url) {
      score += this.weights.network;
      reasons.push('operation.network');
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        score += this.weights.externalWrite;
        reasons.push('network.external_write');
      }
    }

    if (type === 'filesystem' || targetPath) {
      score += this.weights.filesystem;
      reasons.push('operation.filesystem');
      if (includesAny(targetPath, this.indicators.sensitivePaths)) {
        score += this.weights.sensitivePath;
        reasons.push('filesystem.sensitive_path');
      }
    }

    if (!type && !command && !targetPath && !url) {
      score += this.weights.unknownTool;
      reasons.push('operation.unknown');
    }

    const level = riskScoreToLevel(score, this.thresholds);
    return {
      score,
      level,
      reasons,
      requiresApproval: this.requiresApproval(level),
      blocked: this.shouldBlock(level),
    };
  }

  assessTask(task = {}) {
    if (!this.enabled) {
      return { ok: true, score: 0, level: 'low', reasons: ['risk_assessment_disabled'], requiresApproval: false, blocked: false, operations: [] };
    }
    const operations = [];
    const surfaces = toArray(task.operations || task.executionSurfaces || task.tools || []);
    for (const item of surfaces) {
      if (typeof item === 'string') {
        operations.push(this.assessOperation({ type: item }));
      } else if (item && typeof item === 'object') {
        operations.push(this.assessOperation(item));
      }
    }
    if (operations.length === 0) operations.push(this.assessOperation(task));

    const score = operations.reduce((sum, item) => sum + Number(item.score || 0), 0);
    const level = normalizeRiskLevel(task.riskLevel || riskScoreToLevel(score, this.thresholds));
    const reasons = [...new Set(operations.flatMap((item) => item.reasons || []))];
    const requiresApproval = this.requiresApproval(level) || operations.some((item) => item.requiresApproval);
    const blocked = this.shouldBlock(level) || operations.some((item) => item.blocked);
    return {
      ok: true,
      score,
      level,
      reasons,
      requiresApproval,
      blocked,
      operations,
      threshold: {
        approvalMinLevel: this.thresholds.approvalMinLevel,
        blockMinLevel: this.thresholds.blockMinLevel,
      },
    };
  }

  requiresApproval(level = 'low') {
    const order = { low: 1, medium: 2, high: 3, critical: 4 };
    return (order[normalizeRiskLevel(level)] || 1) >= (order[this.thresholds.approvalMinLevel] || 3);
  }

  shouldBlock(level = 'low') {
    const order = { low: 1, medium: 2, high: 3, critical: 4 };
    return (order[normalizeRiskLevel(level)] || 1) >= (order[this.thresholds.blockMinLevel] || 4);
  }

  createExecutionGate(task = {}) {
    const assessment = this.assessTask(task);
    const decision = assessment.blocked
      ? 'deny'
      : (assessment.requiresApproval ? 'require-approval' : 'allow');
    return {
      ok: decision !== 'deny',
      decision,
      assessment,
      reason: assessment.reasons.join(',') || 'risk_assessed',
    };
  }
}

export function createGovernanceRiskAssessment(options = {}) {
  return new GovernanceRiskAssessment(options);
}

export default { GovernanceRiskAssessment, createGovernanceRiskAssessment };

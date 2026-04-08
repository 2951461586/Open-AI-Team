function looksLikeComplexTask(text = '', evt = {}, defaults = {}) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.length >= Number(defaults.longTextThreshold || 400)) return true;
  if (/(架构|设计|分析|方案|改造|重构|编排|系统|路线图|实现|落地|对比报告|深度分析)/.test(t)) return true;
  if (/(DDL|API|patch|diff|伪代码|代码骨架|数据模型|状态机)/i.test(t)) return true;
  if (/(多 Agent|multi-agent|orchestrator|bridge|relay|runtime)/i.test(t)) return true;
  return false;
}

export function loadTeamPolicy(env = {}) {
  const defaults = {
    longTextThreshold: Number(env.TEAM_LONG_TEXT_THRESHOLD || 400),
    requirePlanForRisk: ['medium', 'high'],
    requireReviewForMode: ['analysis', 'build', 'config-change'],
    requireJudgeForRisk: ['high'],
    maxRevisions: Number(env.TEAM_MAX_REVISIONS || 3),
  };

  function classifyWorkMode(evt = {}) {
    const text = String(evt.text || '');
    if (looksLikeComplexTask(text, evt, defaults)) return 'team_task';
    return 'simple_reply';
  }

  function inferTaskMode(evt = {}) {
    const text = String(evt.text || '').toLowerCase();
    if (/(架构|设计|分析|方案|路线图|深度分析)/.test(text)) return 'analysis';
    if (/(代码|实现|重构|修复|patch|diff|骨架|伪代码)/.test(text)) return 'build';
    if (/(配置|config|权限|部署|安全|网关)/.test(text)) return 'config-change';
    return 'general';
  }

  function assessRiskLevel(evt = {}) {
    const mode = inferTaskMode(evt);
    if (mode === 'config-change') return 'high';
    if (mode === 'build' || mode === 'analysis') return 'medium';
    return 'low';
  }

  function requiresPlan(ctx = {}) {
    return defaults.requirePlanForRisk.includes(String(ctx.riskLevel || 'low'));
  }

  function requiresReview(ctx = {}) {
    return defaults.requireReviewForMode.includes(String(ctx.taskMode || 'general'));
  }

  function requiresJudge(ctx = {}) {
    return defaults.requireJudgeForRisk.includes(String(ctx.riskLevel || 'low'));
  }

  function canExecutorReplyDirectly(ctx = {}) {
    return String(ctx.taskMode || '') === 'general' && String(ctx.riskLevel || '') === 'low';
  }

  function getMaxRevisions() {
    return defaults.maxRevisions;
  }

  function shouldEscalateRevisions(revisionCount = 0) {
    return Number(revisionCount || 0) >= defaults.maxRevisions;
  }

  /**
   * P4: Dynamic pipeline stage skipping.
   * Returns which stages should be skipped based on taskMode and riskLevel.
   */
  function resolvePipelineSkips(ctx = {}) {
    const taskMode = String(ctx.taskMode || 'general');
    const riskLevel = String(ctx.riskLevel || 'low');
    return {
      skipCritic: taskMode === 'general' && riskLevel === 'low',
      skipJudge: !defaults.requireJudgeForRisk.includes(riskLevel),
    };
  }

  return {
    classifyWorkMode,
    inferTaskMode,
    assessRiskLevel,
    requiresPlan,
    requiresReview,
    requiresJudge,
    canExecutorReplyDirectly,
    getMaxRevisions,
    shouldEscalateRevisions,
    resolvePipelineSkips,
  };
}

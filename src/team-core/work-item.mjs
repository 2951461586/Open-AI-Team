export function createTLWorkItemHelpers({
  roleConfig,
  getRoleCapabilityContract,
  normalizeCapabilityList,
  normalizeExecutionSurfaceList,
  ensureArray,
  ensureString,
  normalizeRiskLevel,
} = {}) {
  function normalizeWorkItem(item = {}, index = 0) {
    const role = ensureString(item.role || item.memberRole || item.assignee || '').trim().toLowerCase() || 'executor';
    const idValue = ensureString(item.id || item.assignmentId || item.workItemId || '').trim() || `w${index + 1}`;
    const roleContract = getRoleCapabilityContract(role, roleConfig) || null;
    return {
      id: idValue,
      role,
      title: ensureString(item.title || item.objective || `${role}任务 ${index + 1}`),
      objective: ensureString(item.objective || item.title || item.task || ''),
      task: ensureString(item.task || item.instructions || item.objective || ''),
      acceptance: ensureString(item.acceptance || item.acceptanceCriteria || '完成任务并给出可验证结果'),
      deliverables: ensureArray(item.deliverables),
      dependencies: ensureArray(item.dependencies),
      riskLevel: normalizeRiskLevel(item.riskLevel),
      needsReview: !!item.needsReview,
      needsDecision: !!item.needsDecision,
      context: ensureString(item.context || ''),
      preferredNode: ensureString(item.preferredNode || ''),
      toolProfile: ensureString(item.toolProfile || ''),
      requiredCapabilities: normalizeCapabilityList(item.requiredCapabilities || item.capabilitiesNeeded || roleContract?.capabilities || []),
      requiredSkills: normalizeExecutionSurfaceList(item.requiredSkills || item.skillsNeeded || []),
      requiredTools: normalizeExecutionSurfaceList(item.requiredTools || item.toolsNeeded || []),
      requiredMcpServers: normalizeExecutionSurfaceList(item.requiredMcpServers || item.mcpServersNeeded || []),
      expectedContractVersion: ensureString(item.expectedContractVersion || roleContract?.contractVersion || ''),
      expectedOutputType: ensureString(item.expectedOutputType || item.outputType || roleContract?.outputType || ''),
      timeoutMs: Number(item.timeoutMs || 0) || undefined,
      raw: item,
    };
  }

  function resolveTimeout(workItem = {}) {
    if (workItem.timeoutMs) return workItem.timeoutMs;
    const memberConfig = roleConfig?.roles?.[workItem.role] || {};
    if (memberConfig.timeoutMs) return memberConfig.timeoutMs;

    const risk = normalizeRiskLevel(workItem.riskLevel);
    const base = risk === 'high' ? 600000 : risk === 'medium' ? 360000 : 180000;
    const role = String(workItem.role || '').toLowerCase();
    return (role === 'critic' || role === 'judge') ? Math.round(base * 0.5) : base;
  }

  return {
    normalizeWorkItem,
    resolveTimeout,
  };
}

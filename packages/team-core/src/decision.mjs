export function createTLDecisionHelpers({
  parseJsonLoose,
  ensureArray,
  ensureString,
  normalizeRiskLevel,
  normalizeWorkItem,
} = {}) {
  function parseTLDecision(responseText = '') {
    const text = String(responseText || '').trim();
    const parsed = parseJsonLoose(text);
    if (!parsed || !['delegate', 'partial_delegate'].includes(parsed.action)) {
      return {
        type: 'direct',
        directReply: text,
        summary: '',
        taskMode: 'general',
        riskLevel: 'low',
        workItems: [],
      };
    }

    const rawItems = ensureArray(parsed.workItems?.length ? parsed.workItems : parsed.assignments);
    const workItems = rawItems.map(normalizeWorkItem);

    return {
      type: parsed.action,
      directReply: ensureString(parsed.directReply || parsed.summary || ''),
      summary: ensureString(parsed.summary || ''),
      taskMode: ensureString(parsed.taskMode || 'general'),
      riskLevel: normalizeRiskLevel(parsed.riskLevel),
      workItems,
      raw: parsed,
    };
  }

  return {
    parseTLDecision,
  };
}

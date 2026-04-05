export function createTLCompletionHelpers({ parseJsonLoose, ensureArray, ensureString } = {}) {
  function parseStructuredMemberResult(rawText = '', fallback = {}) {
    const parsed = parseJsonLoose(rawText);
    if (parsed && typeof parsed === 'object') {
      return {
        ok: parsed.ok !== false,
        status: ensureString(parsed.status || (parsed.ok === false ? 'failed' : 'completed') || 'completed'),
        summary: ensureString(parsed.summary || parsed.message || rawText || ''),
        deliverables: ensureArray(parsed.deliverables || parsed.artifacts),
        issues: ensureArray(parsed.issues),
        findings: ensureArray(parsed.findings || parsed.keyPoints || parsed.decisions),
        additionalWorkItems: ensureArray(parsed.additionalWorkItems || parsed.newWorkItems || parsed.proposedSteps),
        replanReason: ensureString(parsed.replanReason || ''),
        needsReplan: !!parsed.needsReplan,
        needsHuman: !!parsed.needsHuman,
        outputType: ensureString(parsed.type || parsed.outputType || ''),
        contractVersion: ensureString(parsed.contractVersion || ''),
        raw: parsed,
      };
    }
    return {
      ok: fallback.ok !== false,
      status: fallback.ok === false ? 'failed' : 'completed',
      summary: String(rawText || fallback.summary || '（无输出）'),
      deliverables: [],
      issues: fallback.ok === false ? [{ severity: 'medium', title: 'unstructured_error', description: String(rawText || fallback.error || '') }] : [],
      findings: [],
      additionalWorkItems: [],
      replanReason: '',
      needsReplan: false,
      needsHuman: false,
      outputType: '',
      contractVersion: '',
      raw: rawText,
    };
  }

  return { parseStructuredMemberResult };
}

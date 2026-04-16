export default async function codeReview(request) {
  const { code, language, rules = ['security', 'best-practices', 'performance'] } = request;
  if (!code) {
    return { error: 'code is required' };
  }

  const issues = [];
  const suggestions = [];

  const lines = code.split('\n');
  let lineIndex = 0;

  for (const line of lines) {
    lineIndex++;

    if (line.includes('console.log') && !line.includes('// DEBUG')) {
      issues.push({
        type: 'style',
        severity: 'low',
        line: lineIndex,
        message: 'Avoid console.log in production code',
        rule: 'no-console',
      });
      suggestions.push({
        line: lineIndex,
        replacement: line.replace('console.log', 'logger.debug'),
        reason: 'Use structured logging instead',
      });
    }

    if (line.length > 120) {
      issues.push({
        type: 'style',
        severity: 'low',
        line: lineIndex,
        message: 'Line exceeds 120 characters',
        rule: 'max-len',
      });
    }

    if (/password\s*=\s*['"][^'"]+['"]/i.test(line)) {
      issues.push({
        type: 'security',
        severity: 'critical',
        line: lineIndex,
        message: 'Hardcoded password detected',
        rule: 'no-hardcoded-secrets',
      });
    }

    if (/api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(line)) {
      issues.push({
        type: 'security',
        severity: 'critical',
        line: lineIndex,
        message: 'Hardcoded API key detected',
        rule: 'no-hardcoded-secrets',
      });
    }
  }

  const score = Math.max(0, 10 - (issues.filter(i => i.severity === 'critical').length * 2) - (issues.filter(i => i.severity === 'high').length * 1));

  return {
    language: language || 'unknown',
    rulesApplied: rules,
    issues,
    issuesCount: {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
    },
    suggestions,
    score,
    grade: score >= 8 ? 'A' : score >= 6 ? 'B' : score >= 4 ? 'C' : 'D',
    status: 'completed',
    reviewedAt: new Date().toISOString(),
  };
}

export async function execute(request) {
  return codeReview(request);
}

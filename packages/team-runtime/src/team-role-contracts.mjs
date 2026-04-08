export const TEAM_ROLE_CONTRACTS = {
  planner: {
    contractVersion: 'planner.plan.v2',
    outputType: 'team.plan.v2',
    required: ['summary', 'steps', 'risks'],
    successCriteria: [
      'plan_is_actionable',
      'steps_are_ordered',
      'risks_are_explicit',
    ],
    evidenceRequirements: [
      'task_context_cited',
      'steps_have_exit_criteria',
      'risks_have_mitigation',
    ],
  },
  critic: {
    contractVersion: 'critic.review.v2',
    outputType: 'team.review.v2',
    required: ['verdict', 'score', 'issues'],
    successCriteria: [
      'verdict_matches_issues',
      'issues_are_actionable',
      'review_is_reusable',
    ],
    evidenceRequirements: [
      'issues_reference_location',
      'severity_is_explicit',
      'suggestion_is_concrete',
    ],
  },
  judge: {
    contractVersion: 'judge.decision.v2',
    outputType: 'team.decision.v2',
    required: ['decisionType', 'reason', 'payload.nextState'],
    successCriteria: [
      'decision_is_terminal_or_actionable',
      'next_state_is_valid',
      'reason_is_brief_and_authoritative',
    ],
    evidenceRequirements: [
      'decision_references_review_or_task_state',
      'next_state_matches_decision',
    ],
  },
  executor: {
    contractVersion: 'executor.result.v1',
    outputType: 'team.executor.result.v1',
    required: ['ok', 'summary'],
    optional: ['artifacts', 'metrics', 'logs', 'actions', 'receipts'],
    successCriteria: [
      'execution_completed',
      'artifacts_valid',
      'summary_concrete',
      'action_receipts_recorded',
    ],
    evidenceRequirements: [
      'artifacts_persisted',
      'state_updated',
      'output_gate_opened',
      'action_receipts_verifiable',
    ],
  },
};

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function getRoleContract(role = '') {
  return TEAM_ROLE_CONTRACTS[String(role || '').trim()] || null;
}

export function normalizePlannerContract(result = {}) {
  const c = getRoleContract('planner');
  const steps = ensureArray(result?.steps, []);
  const rawSubtasks = ensureArray(result?.subtasks, []);
  // Normalize subtasks: ensure id, description, dependsOn fields
  const subtasks = rawSubtasks.map((st, i) => ({
    id: String(st?.id || `st${i + 1}`),
    description: String(st?.description || st?.step || (typeof st === 'string' ? st : '')),
    assignedRole: String(st?.assignedRole || 'executor'),
    dependsOn: ensureArray(st?.dependsOn, []),
    estimatedMinutes: Number(st?.estimatedMinutes || 0),
  })).filter(st => st.description);

  // If no subtasks but has steps, auto-generate subtasks from steps
  if (subtasks.length === 0 && steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const stepText = typeof steps[i] === 'string' ? steps[i] : String(steps[i]);
      subtasks.push({
        id: `st${i + 1}`,
        description: stepText,
        assignedRole: 'executor',
        dependsOn: i > 0 ? [`st${i}`] : [],
        estimatedMinutes: 0,
      });
    }
  }

  return {
    ok: result?.ok !== false,
    type: String(result?.type || c.outputType),
    contractVersion: String(result?.contractVersion || c.contractVersion),
    summary: String(result?.summary || ''),
    steps,
    subtasks,
    risks: ensureArray(result?.risks, []),
    successCriteria: ensureArray(result?.successCriteria, c.successCriteria),
    evidenceRequirements: ensureArray(result?.evidenceRequirements, c.evidenceRequirements),
  };
}

export function normalizeCriticContract(review = {}) {
  const c = getRoleContract('critic');
  return {
    contractVersion: String(review?.contractVersion || c.contractVersion),
    outputType: String(review?.outputType || c.outputType),
    checklist: ensureArray(review?.checklist, c.successCriteria),
    evidenceRequirements: ensureArray(review?.evidenceRequirements, c.evidenceRequirements),
  };
}

export function normalizeJudgeContract(decision = {}) {
  const c = getRoleContract('judge');
  return {
    contractVersion: String(decision?.contractVersion || c.contractVersion),
    outputType: String(decision?.outputType || c.outputType),
    evidenceRequirements: ensureArray(decision?.evidenceRequirements, c.evidenceRequirements),
  };
}

export function normalizeExecutorContract(result = {}) {
  const c = getRoleContract('executor');
  const artifacts = ensureArray(result?.artifacts, []).map((artifact = {}) => ({
    ...artifact,
    type: String(artifact?.type || 'file').trim() || 'file',
    title: String(artifact?.title || artifact?.name || '').trim(),
    body: artifact?.body ?? artifact?.content ?? '',
    path: String(artifact?.path || artifact?.workspacePath || artifact?.refId || '').trim(),
    refId: String(artifact?.refId || artifact?.workspacePath || artifact?.path || '').trim(),
    workspacePath: String(artifact?.workspacePath || artifact?.path || artifact?.refId || '').trim(),
    workspaceRelativePath: String(artifact?.workspaceRelativePath || '').trim(),
    language: String(artifact?.language || '').trim(),
    verification: artifact?.verification || {},
  }));
  const actions = ensureArray(result?.actions, []).map((action = {}, idx) => ({
    actionId: String(action?.actionId || `action_${idx + 1}`).trim(),
    type: String(action?.type || '').trim(),
    status: String(action?.status || '').trim() || 'completed',
    input: action?.input || {},
    receipt: action?.receipt || {},
  })).filter((action) => action.type);
  const receipts = ensureArray(result?.receipts, []).map((receipt = {}, idx) => ({
    receiptId: String(receipt?.receiptId || `receipt_${idx + 1}`).trim(),
    actionId: String(receipt?.actionId || '').trim(),
    type: String(receipt?.type || '').trim(),
    ok: receipt?.ok !== false,
    detail: receipt?.detail || {},
  })).filter((receipt) => receipt.type || receipt.actionId);
  return {
    ok: result?.ok !== false,
    contractVersion: String(result?.contractVersion || c.contractVersion),
    outputType: String(result?.outputType || c.outputType),
    summary: String(result?.summary || ''),
    artifacts,
    actions,
    receipts,
    metrics: result?.metrics || {},
    logs: ensureArray(result?.logs, []),
    successCriteria: ensureArray(result?.successCriteria, c.successCriteria),
    evidenceRequirements: ensureArray(result?.evidenceRequirements, c.evidenceRequirements),
  };
}

export function validateRoleContract(role = '', output = {}) {
  const contract = getRoleContract(role);
  if (!contract) return { valid: false, error: `Unknown role: ${role}` };
  
  const required = contract.required || [];
  const missing = required.filter((field) => {
    const parts = field.split('.');
    let val = output;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined || val === null) return true;
    }
    return false;
  });
  
  if (missing.length > 0) {
    return { ok: false, valid: false, error: `Missing required fields: ${missing.join(', ')}`, contract };
  }
  
  return { ok: true, valid: true, contract };
}

export function validateExecutorResult(result = {}) {
  return validateRoleContract('executor', result);
}

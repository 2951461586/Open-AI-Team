function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : (value == null ? fallback : String(value));
}

function inferArtifactType(text = '') {
  const value = String(text || '').toLowerCase();
  if (!value) return 'document';
  if (value.includes('json')) return 'json';
  if (value.includes('image') || value.includes('截图') || value.includes('图片') || value.includes('png') || value.includes('jpg')) return 'image';
  if (value.includes('code') || value.includes('脚本') || value.includes('源码') || value.includes('.ts') || value.includes('.js') || value.includes('.py')) return 'code';
  if (value.includes('report') || value.includes('总结') || value.includes('文档') || value.includes('readme') || value.includes('md')) return 'document';
  return 'document';
}

export function createDeliveryContract(input = {}) {
  const now = Number(input.createdAt || Date.now());
  const contractId = asString(input.contractId || input.id || `contract:${now}`);
  const taskId = asString(input.taskId);
  const version = Number(input.version || 1);
  const planId = asString(input.planId || '');
  const title = asString(input.title || input.summary || 'Task delivery contract');
  const expectedDeliverables = normalizeArray(input.expectedDeliverables).map((item, index) => ({
    id: asString(item?.id || `deliverable:${index + 1}`),
    title: asString(item?.title || item?.name || `Deliverable ${index + 1}`),
    artifactType: asString(item?.artifactType || inferArtifactType(item?.title || item?.description || 'document')),
    required: item?.required !== false,
    qualityCriteria: normalizeArray(item?.qualityCriteria || item?.quality || []),
    acceptanceCriteria: normalizeArray(item?.acceptanceCriteria || item?.acceptance || []),
    evidenceHints: normalizeArray(item?.evidenceHints || []),
    sourceStepIds: normalizeArray(item?.sourceStepIds || []),
  }));

  return {
    contractId,
    taskId,
    planId,
    version,
    title,
    summary: asString(input.summary || title),
    expectedDeliverables,
    qualityBar: {
      minimumEvidenceCount: Number(input?.qualityBar?.minimumEvidenceCount || input.minimumEvidenceCount || 1),
      requireExecutableArtifacts: input?.qualityBar?.requireExecutableArtifacts !== false,
      requireAcceptanceTrace: input?.qualityBar?.requireAcceptanceTrace !== false,
    },
    acceptance: {
      requiredVerdict: asString(input?.acceptance?.requiredVerdict || 'approve'),
      allowNotes: input?.acceptance?.allowNotes !== false,
      maxBlockingIssues: Number(input?.acceptance?.maxBlockingIssues || 0),
    },
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    createdAt: now,
    updatedAt: Number(input.updatedAt || now),
  };
}

export function deriveDeliveryContractFromPlan(plan = {}, task = {}) {
  const steps = normalizeArray(plan.steps);
  const subtasks = normalizeArray(plan.subtasks);
  const deliverables = [];
  steps.forEach((step, index) => {
    const explicitDeliverables = normalizeArray(step?.deliverables);
    const stepAcceptance = normalizeArray(step?.acceptance || step?.acceptanceCriteria || []);
    const baseTitle = asString(step?.title || step?.summary || `Step ${index + 1}`);
    if (explicitDeliverables.length > 0) {
      explicitDeliverables.forEach((entry, dIndex) => {
        deliverables.push({
          id: asString(entry?.id || `step:${index + 1}:deliverable:${dIndex + 1}`),
          title: asString(entry?.title || entry?.name || `${baseTitle} deliverable ${dIndex + 1}`),
          artifactType: asString(entry?.artifactType || inferArtifactType(entry?.title || entry?.description || baseTitle)),
          required: entry?.required !== false,
          qualityCriteria: normalizeArray(entry?.qualityCriteria || step?.quality || []),
          acceptanceCriteria: normalizeArray(entry?.acceptanceCriteria || stepAcceptance),
          evidenceHints: normalizeArray(entry?.evidenceHints || [baseTitle]),
          sourceStepIds: [asString(step?.id || `step:${index + 1}`)],
        });
      });
      return;
    }
    deliverables.push({
      id: asString(step?.id || `step:${index + 1}`),
      title: baseTitle,
      artifactType: inferArtifactType(baseTitle),
      required: true,
      qualityCriteria: normalizeArray(step?.quality || step?.qualityCriteria || []),
      acceptanceCriteria: stepAcceptance,
      evidenceHints: normalizeArray(step?.evidenceHints || [baseTitle]),
      sourceStepIds: [asString(step?.id || `step:${index + 1}`)],
    });
  });

  if (deliverables.length === 0 && subtasks.length > 0) {
    subtasks.forEach((item, index) => {
      deliverables.push({
        id: asString(item?.id || `subtask:${index + 1}`),
        title: asString(item?.title || `Subtask ${index + 1}`),
        artifactType: inferArtifactType(item?.title || item?.acceptance || ''),
        required: true,
        qualityCriteria: [],
        acceptanceCriteria: normalizeArray(item?.acceptance ? [item.acceptance] : []),
        evidenceHints: normalizeArray(item?.deliverables || []),
        sourceStepIds: [asString(item?.id || `subtask:${index + 1}`)],
      });
    });
  }

  return createDeliveryContract({
    contractId: `contract:${asString(task?.taskId || plan?.taskId || 'task:unknown')}:${Number(plan?.version || 1)}`,
    taskId: asString(task?.taskId || plan?.taskId || ''),
    planId: asString(plan?.planId || ''),
    version: Number(plan?.version || 1),
    title: asString(task?.title || plan?.summary || 'Task delivery contract'),
    summary: asString(plan?.summary || task?.description || task?.title || 'Derived delivery contract'),
    expectedDeliverables: deliverables,
    metadata: {
      source: 'plan',
      planVersion: Number(plan?.version || 1),
      subtaskCount: subtasks.length,
      stepCount: steps.length,
    },
  });
}

export function evaluateDeliveryAgainstContract(contract = {}, submission = {}) {
  const deliverables = normalizeArray(contract.expectedDeliverables);
  const artifacts = normalizeArray(submission.artifacts);
  const evidence = normalizeArray(submission.evidence);
  const reviews = normalizeArray(submission.reviews);
  const decisions = normalizeArray(submission.decisions);
  const latestReview = reviews[0] || null;
  const latestDecision = decisions[0] || null;

  const artifactText = artifacts.map((item) => `${asString(item?.title)} ${asString(item?.artifactType)} ${asString(item?.body?.text || item?.body?.summary || item?.body?.path || '')}`).join('\n').toLowerCase();
  const evidenceText = evidence.map((item) => `${asString(item?.title)} ${asString(item?.evidenceType)} ${asString(item?.detail?.summary || item?.detail?.path || '')}`).join('\n').toLowerCase();

  const deliverableChecks = deliverables.map((item) => {
    const tokens = [item.title, ...(item.acceptanceCriteria || []), ...(item.evidenceHints || [])].map((v) => asString(v).toLowerCase()).filter(Boolean);
    const matchedArtifacts = artifacts.filter((artifact) => {
      const haystack = `${asString(artifact?.title)} ${asString(artifact?.artifactType)} ${asString(artifact?.body?.text || artifact?.body?.summary || artifact?.body?.path || '')}`.toLowerCase();
      return tokens.some((token) => haystack.includes(token)) || asString(artifact?.artifactType).toLowerCase() === asString(item?.artifactType).toLowerCase();
    });
    const matchedEvidence = evidence.filter((entry) => {
      const haystack = `${asString(entry?.title)} ${asString(entry?.evidenceType)} ${asString(entry?.detail?.summary || entry?.detail?.path || '')}`.toLowerCase();
      return tokens.some((token) => haystack.includes(token));
    });
    const status = matchedArtifacts.length > 0 ? (matchedEvidence.length > 0 ? 'verified' : 'artifact_only') : 'missing';
    return {
      id: item.id,
      title: item.title,
      required: item.required !== false,
      status,
      matchedArtifactIds: matchedArtifacts.map((artifact) => asString(artifact?.artifactId)),
      matchedEvidenceIds: matchedEvidence.map((entry) => asString(entry?.evidenceId)),
      missingAcceptanceCriteria: normalizeArray(item.acceptanceCriteria).filter((criterion) => {
        const key = asString(criterion).toLowerCase();
        return key && !artifactText.includes(key) && !evidenceText.includes(key);
      }),
    };
  });

  const missingRequired = deliverableChecks.filter((item) => item.required && item.status === 'missing');
  const blockingIssues = [];
  if (missingRequired.length) blockingIssues.push(`missing_required:${missingRequired.length}`);
  if (Number(evidence.length) < Number(contract?.qualityBar?.minimumEvidenceCount || 1)) blockingIssues.push('insufficient_evidence');
  if (latestReview && String(latestReview?.verdict || '') === 'revise') blockingIssues.push('review_requested_revision');
  if (latestDecision && String(latestDecision?.decisionType || '') === 'revise') blockingIssues.push('judge_requested_revision');

  return {
    ok: blockingIssues.length === 0,
    score: deliverableChecks.length ? Math.round((deliverableChecks.filter((item) => item.status !== 'missing').length / deliverableChecks.length) * 100) : 0,
    deliverableChecks,
    counters: {
      expected: deliverableChecks.length,
      verified: deliverableChecks.filter((item) => item.status === 'verified').length,
      artifactOnly: deliverableChecks.filter((item) => item.status === 'artifact_only').length,
      missing: deliverableChecks.filter((item) => item.status === 'missing').length,
      evidence: evidence.length,
      artifacts: artifacts.length,
    },
    review: latestReview ? {
      verdict: asString(latestReview?.verdict),
      score: Number(latestReview?.score || 0),
      issueCount: normalizeArray(latestReview?.issues).length,
    } : null,
    decision: latestDecision ? {
      decisionType: asString(latestDecision?.decisionType),
      reason: asString(latestDecision?.reason),
    } : null,
    blockingIssues,
  };
}

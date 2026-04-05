export function buildTaskObservability(snapshot = {}, helpers = {}) {
  const {
    inferNextBestAction,
    inferCurrentDriver,
    computeDeliveryStatus,
    computeInterventionStatus,
    buildExecutiveSummary,
    getManualActions,
    summarizeTaskMemoryLayers,
  } = helpers;
  const s = snapshot || {};
  const issueCount = (s.evidence || []).filter((e) => String(e?.evidenceType || '') === 'review_issue').length;
  const revisionCount = (s.reviews || []).filter((r) => String(r?.verdict || '').toLowerCase() === 'revise').length;
  const currentDriver = inferCurrentDriver({ task: s.task, latestReview: s.latestReview, latestDecision: s.latestDecision });
  const nextBestAction = inferNextBestAction({
    task: s.task,
    latestReview: s.latestReview,
    latestDecision: s.latestDecision,
    artifactCount: (s.artifacts || []).length,
    evidenceCount: (s.evidence || []).length,
  });
  const deliveryStatus = computeDeliveryStatus({
    task: s.task,
    latestDecision: s.latestDecision,
    artifactCount: (s.artifacts || []).length,
  });
  const interventionStatus = computeInterventionStatus({
    task: s.task,
    issueCount,
    revisionCount,
    latestDecision: s.latestDecision,
  });
  const executiveSummary = buildExecutiveSummary({
    task: s.task,
    latestReview: s.latestReview,
    latestDecision: s.latestDecision,
    deliveryStatus,
    interventionStatus,
    nextBestAction,
  });
  const manualActions = getManualActions({
    task: s.task,
    latestReview: s.latestReview,
    latestDecision: s.latestDecision,
    deliveryStatus,
    interventionStatus,
  });
  const memoryLayers = summarizeTaskMemoryLayers(s);
  const protocolSource = s.latestDecision ? 'decision' : s.latestReview ? 'review' : s.plan ? 'plan' : 'task';
  return {
    issueCount,
    revisionCount,
    currentDriver,
    nextBestAction,
    deliveryStatus,
    interventionStatus,
    executiveSummary,
    manualActions,
    memoryLayers,
    protocolSource,
  };
}

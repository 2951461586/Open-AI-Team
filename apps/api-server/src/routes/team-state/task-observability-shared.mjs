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
  const artifactCount = (s.artifacts || []).length;
  const evidenceCount = (s.evidence || []).length;
  const issueCount = (s.evidence || []).filter((e) => String(e?.evidenceType || '') === 'review_issue').length;
  const revisionCount = (s.reviews || []).filter((r) => String(r?.verdict || '').toLowerCase() === 'revise').length;
  const currentDriver = inferCurrentDriver({ task: s.task, latestReview: s.latestReview, latestDecision: s.latestDecision });
  const nextBestAction = inferNextBestAction({
    task: s.task,
    latestReview: s.latestReview,
    latestDecision: s.latestDecision,
    artifactCount,
    evidenceCount,
  });
  const deliveryStatus = computeDeliveryStatus({
    task: s.task,
    latestDecision: s.latestDecision,
    artifactCount,
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
  const deliverableReady = deliveryStatus === 'deliverable_ready';
  const humanInterventionReady = interventionStatus !== 'no_intervention_needed';
  const acceptanceState = deliverableReady
    ? 'ready_for_acceptance'
    : humanInterventionReady
      ? 'needs_human_decision'
      : issueCount > 0
        ? 'needs_issue_resolution'
        : 'in_progress';
  const recommendedSurface = deliverableReady
    ? 'deliverables'
    : humanInterventionReady
      ? 'mission'
      : artifactCount > 0 || evidenceCount > 0
        ? 'timeline'
        : 'workbench';
  const terminalState = {
    isTerminal: ['done', 'blocked', 'cancelled'].includes(String(s.task?.state || '')),
    terminalKind: ['done', 'blocked', 'cancelled'].includes(String(s.task?.state || '')) ? String(s.task?.state || '') : 'active',
    headline: String(s.task?.state || '') === 'done'
      ? '任务已完成，进入结果复查/归档阶段。'
      : String(s.task?.state || '') === 'blocked'
        ? '任务已阻塞，需先明确恢复入口。'
        : String(s.task?.state || '') === 'cancelled'
          ? '任务已取消，需确认保留资产与是否重开。'
          : '任务仍在推进。',
    operatorHint: String(s.task?.state || '') === 'done'
      ? '优先检查交付结果、关键证据和归档状态。'
      : String(s.task?.state || '') === 'blocked'
        ? '优先检查阻塞证据、人工接管点和恢复条件。'
        : String(s.task?.state || '') === 'cancelled'
          ? '优先检查取消原因、保留资产和后续是否重开。'
          : '继续沿推荐面推进。',
    archiveEligible: ['done', 'blocked', 'cancelled'].includes(String(s.task?.state || '')),
    archiveStatus: ['done', 'blocked', 'cancelled'].includes(String(s.task?.state || '')) ? 'candidate' : 'not_applicable',
    archiveRoute: '/state/team/archive?limit=200',
  };
  const evidenceRetrieval = {
    route: `/state/team/evidence?taskId=${encodeURIComponent(String(s.task?.taskId || ''))}&limit=200`,
    totalCount: evidenceCount,
    reviewIssueCount: issueCount,
    blockingCount: issueCount,
    recommendedSection: issueCount > 0 ? 'blocking' : evidenceCount > 0 ? 'supporting' : 'empty',
    preferredSource: 'evidence',
  };
  const deliveryClosure = {
    deliverableReady,
    humanInterventionReady,
    deliveryStatus,
    interventionStatus,
    issueCount,
    revisionCount,
    artifactCount,
    evidenceCount,
    nextBestAction,
    executiveSummary,
    acceptanceState,
    recommendedSurface,
    terminalState,
    evidenceRetrieval,
  };
  return {
    artifactCount,
    evidenceCount,
    issueCount,
    revisionCount,
    currentDriver,
    nextBestAction,
    deliveryStatus,
    interventionStatus,
    deliverableReady,
    humanInterventionReady,
    executiveSummary,
    manualActions,
    memoryLayers,
    protocolSource,
    deliveryClosure,
  };
}

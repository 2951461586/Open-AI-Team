const TASK_STATES = new Set([
  'pending',
  'planning',
  'plan_review',
  'approved',
  'revision_requested',
  'done',
  'cancelled',
  'blocked',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = '') {
  return String(value == null ? fallback : value);
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeTaskState(state = '') {
  const raw = asString(state).trim();
  return TASK_STATES.has(raw) ? raw : 'pending';
}

export function normalizeTaskCard(raw = {}) {
  const source = asObject(raw);
  return {
    taskId: asString(source.taskId || source.id || '').trim(),
    teamId: asString(source.teamId || ''),
    title: asString(source.title || '未命名任务'),
    state: normalizeTaskState(source.state),
    updatedAt: asNumber(source.updatedAt || source.createdAt || 0),
    currentDriver: asString(source.currentDriver || source.ownerMemberId || ''),
    currentMemberKey: asString(source.currentMemberKey || ''),
    nextBestAction: asString(source.nextBestAction || ''),
    latestReviewVerdict: source.latestReviewVerdict || null,
    latestDecisionType: source.latestDecisionType || null,
    artifactCount: asNumber(source.artifactCount || 0),
    evidenceCount: asNumber(source.evidenceCount || 0),
    issueCount: asNumber(source.issueCount || 0),
    deliverableReady: Boolean(source.deliverableReady),
    humanInterventionReady: Boolean(source.humanInterventionReady),
    deliveryStatus: asString(source.deliveryStatus || ''),
    interventionStatus: asString(source.interventionStatus || ''),
    requestedNode: asString(source.requestedNode || ''),
    actualNode: asString(source.actualNode || ''),
    degradedReason: asString(source.degradedReason || ''),
    sessionMode: asString(source.sessionMode || ''),
    sessionPersistent: typeof source.sessionPersistent === 'boolean' ? source.sessionPersistent : undefined,
    sessionFallbackReason: asString(source.sessionFallbackReason || ''),
    planSummary: asString(source.planSummary || ''),
    executiveSummary: asString(source.executiveSummary || ''),
    protocolSource: asString(source.protocolSource || ''),
    acceptanceState: asString(source.acceptanceState || ''),
    recommendedSurface: asString(source.recommendedSurface || ''),
  };
}

export function normalizeNodeStats(raw = {}) {
  const source = asObject(raw);
  return {
    ...source,
    controlPlaneOk: typeof source.controlPlaneOk === 'boolean' ? source.controlPlaneOk : source.openclawOk,
    controlPlaneStatus: asString(source.controlPlaneStatus || source.openclawStatus || ''),
  };
}

export function normalizeConnectivity(raw = {}) {
  const source = asObject(raw);
  return {
    ...source,
    controlBaseUrl: asString(source.controlBaseUrl || source.gatewayBaseUrl || ''),
    controlHost: asString(source.controlHost || source.gatewayHost || ''),
    controlPort: asNumber(source.controlPort || source.gatewayPort || 0) || undefined,
  };
}

export function normalizeNodeSummary(key = '', raw = {}, deployment = {}, canonicalLabels = {}) {
  const source = asObject(raw);
  const deploymentMap = asObject(deployment);
  return {
    key: asString(key || source.key || '').trim(),
    label: asString(canonicalLabels?.[key] || source.label || key),
    reachable: !!source.reachable,
    latencyMs: source.latencyMs,
    fallbackReady: !!source.fallbackReady,
    probe: source.probe,
    stats: normalizeNodeStats(source.stats || {}),
    activeResidentCount: source.activeResidentCount,
    activeResidentRoles: Array.isArray(source.activeResidentRoles) ? source.activeResidentRoles : [],
    connectivity: normalizeConnectivity(source.connectivity || {}),
    weight: typeof source.weight === 'number' ? source.weight : undefined,
    pressureReason: asString(source.pressureReason || ''),
    recommended: !!source.recommended,
    preferredRoles: Object.entries(deploymentMap)
      .filter(([, cfg]) => asString(cfg?.preferredNode || '') === key)
      .map(([role]) => role),
    fallbackRoles: Object.entries(deploymentMap)
      .filter(([, cfg]) => asString(cfg?.fallbackNode || '') === key && asString(cfg?.preferredNode || '') !== key)
      .map(([role]) => role),
  };
}

function buildLegacyPayload(root = {}, payload = {}, key = '', value = null, extras = {}) {
  return {
    ...payload,
    ...extras,
    ...(key ? { [key]: value } : {}),
  };
}

export function normalizeDashboardEnvelope(raw = {}) {
  const root = asObject(raw);
  const payload = asObject(root.payload);
  const dashboardSource = asObject(root.dashboard && typeof root.dashboard === 'object' ? root.dashboard : payload.dashboard);
  const cards = Array.isArray(dashboardSource.cards)
    ? dashboardSource.cards.map((item) => normalizeTaskCard(item)).filter((item) => item.taskId)
    : [];
  const dashboard = {
    ...dashboardSource,
    count: asNumber(dashboardSource.count || cards.length),
    totalCount: asNumber(dashboardSource.totalCount || dashboardSource.count || cards.length),
    cards,
    cursor: asNumber(dashboardSource.cursor || 0),
    hasMore: Boolean(dashboardSource.hasMore),
    address: asString(dashboardSource.address || ''),
    viewAddress: asString(dashboardSource.viewAddress || ''),
  };
  return {
    ...root,
    dashboard,
    payload: buildLegacyPayload(root, payload, 'dashboard', dashboard),
  };
}

export function normalizeNodesEnvelope(raw = {}, { canonicalLabels = {} } = {}) {
  const root = asObject(raw);
  const payload = asObject(root.payload);
  const nodesSource = asObject(root.nodes && typeof root.nodes === 'object' ? root.nodes : payload.nodes);
  const deployment = asObject(root.deployment && typeof root.deployment === 'object' ? root.deployment : payload.deployment);
  const normalizedNodes = Object.fromEntries(
    Object.entries(nodesSource).map(([key, value]) => {
      if (key === 'ts' || !value || typeof value !== 'object') return [key, value];
      return [key, normalizeNodeSummary(key, value, deployment, canonicalLabels)];
    }),
  );
  const recommendation = root.recommendation || payload.recommendation || null;
  return {
    ...root,
    nodes: normalizedNodes,
    deployment,
    recommendation,
    payload: buildLegacyPayload(root, payload, 'nodes', normalizedNodes, { deployment, recommendation }),
  };
}

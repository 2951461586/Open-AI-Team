import { CANONICAL_NODE_IDS, DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID, canonicalNodeId, withLegacyNodeAliases } from './team-node-ids.mjs';

export function createInitialNodeHealthState({ hasObserverControl = false, hasReviewControl = false, disableSshRemoteProbe = false } = {}) {
  const now = Date.now();
  return {
    reachabilityGraceMs: {
      [DEFAULT_NODE_ID]: 60000,
      [OBSERVER_NODE_ID]: 45000,
      [REVIEW_NODE_ID]: 45000,
    },
    lastHealthyAt: {
      [DEFAULT_NODE_ID]: now,
      [OBSERVER_NODE_ID]: 0,
      [REVIEW_NODE_ID]: 0,
    },
    snapshot: {
      ts: now,
      [DEFAULT_NODE_ID]: {
        node: DEFAULT_NODE_ID,
        reachable: true,
        latencyMs: 0,
        fallbackReady: true,
        probe: 'local_http',
        statsSource: 'local',
        statsStatus: 'unknown',
        stats: null,
      },
      [OBSERVER_NODE_ID]: {
        node: OBSERVER_NODE_ID,
        reachable: false,
        latencyMs: 0,
        fallbackReady: true,
        probe: hasObserverControl ? 'control_http' : 'relay_ssh',
        statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh',
        statsStatus: disableSshRemoteProbe ? 'disabled' : 'pending',
        stats: null,
      },
      [REVIEW_NODE_ID]: {
        node: REVIEW_NODE_ID,
        reachable: false,
        latencyMs: 0,
        fallbackReady: true,
        probe: hasReviewControl ? 'control_http' : 'relay_ssh',
        statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh',
        statsStatus: disableSshRemoteProbe ? 'disabled' : 'pending',
        stats: null,
      },
    },
  };
}

export function resolveReachability({ nodeName = '', rawOk = false, lastHealthyAt = {}, reachabilityGraceMs = {} } = {}) {
  const canonical = canonicalNodeId(nodeName, DEFAULT_NODE_ID);
  const now = Date.now();
  if (canonical === DEFAULT_NODE_ID) {
    lastHealthyAt[DEFAULT_NODE_ID] = now;
    return true;
  }
  if (rawOk) {
    lastHealthyAt[canonical] = now;
    return true;
  }
  const graceMs = Number(reachabilityGraceMs[canonical] || reachabilityGraceMs[nodeName] || 0);
  return graceMs > 0 && (now - Number(lastHealthyAt[canonical] || lastHealthyAt[nodeName] || 0)) < graceMs;
}

export function stableLatency(snapshot = {}, nodeName = '', rawResult = null) {
  if (rawResult?.ok) return Number(rawResult.latencyMs || 0);
  return Number(snapshot?.[nodeName]?.latencyMs || 0);
}

export function attachResidentSummary(snapshot = {}, teamStore = null) {
  if (!teamStore?.getActiveResidentsByNode) return snapshot;
  const nowTs = Date.now();
  for (const nodeName of CANONICAL_NODE_IDS) {
    if (!snapshot[nodeName]) continue;
    try {
      const activeResidents = teamStore.getActiveResidentsByNode(nodeName, nowTs);
      snapshot[nodeName].activeResidentCount = activeResidents.length;
      snapshot[nodeName].activeResidentRoles = activeResidents.map((m) => m.role || '').filter(Boolean);
    } catch {
      snapshot[nodeName].activeResidentCount = 0;
      snapshot[nodeName].activeResidentRoles = [];
    }
  }
  return snapshot;
}

export function exposeNodeSnapshot(snapshot = {}, teamStore = null) {
  return withLegacyNodeAliases(attachResidentSummary(snapshot, teamStore));
}

export function computeNodeWeights(snapshot = {}) {
  const weights = {};
  for (const nodeName of CANONICAL_NODE_IDS) {
    const snap = snapshot[nodeName];
    if (!snap || !snap.reachable) {
      weights[nodeName] = { weight: 0, reason: 'unreachable' };
      continue;
    }
    let w = 100;
    const stats = snap.stats || {};
    const hasStats = stats && Object.keys(stats).length > 0;
    let reason = 'healthy';

    if (!hasStats) {
      w = Math.min(w, 45);
      reason = snap.statsStatus === 'disabled' ? 'stats_disabled' : 'reachable_no_stats';
    }

    if (typeof stats.memoryUsedPercent === 'number') {
      if (stats.memoryUsedPercent > 90) w -= 60;
      else if (stats.memoryUsedPercent > 80) w -= 30;
      else if (stats.memoryUsedPercent > 70) w -= 10;
    }
    if (typeof stats.load1 === 'number') {
      if (stats.load1 > 4) w -= 40;
      else if (stats.load1 > 2) w -= 20;
      else if (stats.load1 > 1) w -= 5;
    }
    if (typeof stats.diskUsedPercent === 'number') {
      if (stats.diskUsedPercent > 95) w -= 30;
      else if (stats.diskUsedPercent > 90) w -= 10;
    }
    if (typeof snap.latencyMs === 'number' && snap.latencyMs > 0) {
      if (snap.latencyMs > 2000) w -= 30;
      else if (snap.latencyMs > 500) w -= 10;
    }
    const residentCount = Number(snap.activeResidentCount || 0);
    if (residentCount > 3) w -= 20;
    else if (residentCount > 1) w -= 5;

    const finalWeight = Math.max(0, w);
    if (reason === 'healthy') {
      reason = finalWeight >= 70 ? 'healthy' : finalWeight >= 30 ? 'degraded' : 'overloaded';
    }
    weights[nodeName] = { weight: finalWeight, reason };
  }
  return weights;
}

export function selectBestNode(snapshot = {}, preferredNode = DEFAULT_NODE_ID, fallbackNode = DEFAULT_NODE_ID, affinityBonus = 15) {
  const weights = computeNodeWeights(snapshot);
  if (weights[preferredNode]) {
    weights[preferredNode] = {
      ...weights[preferredNode],
      weight: Math.min(100, weights[preferredNode].weight + affinityBonus),
    };
  }
  let bestNode = preferredNode;
  let bestWeight = -1;
  for (const [nodeName, info] of Object.entries(weights)) {
    if (info.weight > bestWeight) {
      bestWeight = info.weight;
      bestNode = nodeName;
    }
  }
  if (bestWeight <= 0) {
    bestNode = weights[fallbackNode]?.weight > 0 ? fallbackNode : preferredNode;
  }
  const degraded = bestNode !== preferredNode;
  const degradedReason = degraded ? `load_aware_reroute:${preferredNode}→${bestNode}(w=${bestWeight})` : '';
  return { selectedNode: bestNode, weights, degraded, degradedReason };
}

import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID, withLegacyNodeAliases } from './team-node-ids.mjs';
import {
  computeNodeWeights as computeNodeWeightsFromSnapshot,
  createInitialNodeHealthState,
  exposeNodeSnapshot,
  resolveReachability,
  selectBestNode as selectBestNodeFromSnapshot,
  stableLatency,
} from './team-node-health-core.mjs';
import {
  ping,
  pingPeerRelayViaSsh,
  readLocalStats,
  readRemoteStatsViaSsh,
} from './team-node-health-probes.mjs';

/**
 * 三节点健康检查模块（facade）
 * - core: node scoring / placement semantics
 * - probes: local/remote health collection
 */
export function createTeamNodeHealth({
  fetchImpl = globalThis.fetch,
  peerHost = '',
  peerWebhookPort = 18080,
  peerControlBaseUrl = '',
  peerControlToken = '',
  reviewHost = REVIEW_NODE_ID,
  reviewWebhookPort = 19092,
  reviewControlBaseUrl = '',
  reviewControlToken = '',
  controlPlaneSystemdUnit = '',
  localControlUrl = 'http://127.0.0.1:19090',
  teamStore = null,
} = {}) {
  const disableSshRemoteProbe = ['1', 'true', 'yes', 'on'].includes(String(process.env.TEAM_NODE_HEALTH_DISABLE_SSH || '').trim().toLowerCase());
  const hasObserverControl = !!String(peerControlBaseUrl || '').trim();
  const hasReviewControl = !!String(reviewControlBaseUrl || '').trim();
  const state = createInitialNodeHealthState({ hasObserverControl, hasReviewControl, disableSshRemoteProbe });
  const reachabilityGraceMs = state.reachabilityGraceMs;
  const lastHealthyAt = state.lastHealthyAt;
  let lastSnapshot = state.snapshot;

  // Root fix remains locked:
  // remote node health must not write into any host chat/session transcript.
  // Reachability stays on HTTP(/health) or relay probe; remote stats use SSH only when enabled.

  async function refreshNodeStatus() {
    const observerUrl = String(peerControlBaseUrl || '').trim().replace(/\/$/, '');
    const reviewUrl = String(reviewControlBaseUrl || '').trim().replace(/\/$/, '');

    const [localResult, observerResult, reviewResult, localStats, observerSshStats, reviewSshStats] = await Promise.all([
      ping(fetchImpl, `${String(localControlUrl || 'http://127.0.0.1:19090').replace(/\/$/, '')}/health`),
      observerUrl
        ? ping(fetchImpl, `${observerUrl}/health`, 1500)
        : (disableSshRemoteProbe ? Promise.resolve({ ok: false, error: 'ssh_probe_disabled' }) : pingPeerRelayViaSsh({ host: peerHost || OBSERVER_NODE_ID, port: peerWebhookPort })),
      reviewUrl
        ? ping(fetchImpl, `${reviewUrl}/health`, 1500)
        : (disableSshRemoteProbe ? Promise.resolve({ ok: false, error: 'ssh_probe_disabled' }) : pingPeerRelayViaSsh({ host: reviewHost, port: reviewWebhookPort })),
      Promise.resolve(readLocalStats({ controlPlaneSystemdUnit })),
      disableSshRemoteProbe ? Promise.resolve(null) : readRemoteStatsViaSsh({ host: peerHost || OBSERVER_NODE_ID }),
      disableSshRemoteProbe ? Promise.resolve(null) : readRemoteStatsViaSsh({ host: reviewHost }),
    ]);

    const observerStats = observerSshStats || null;
    const reviewStats = reviewSshStats || null;
    const localReachable = resolveReachability({ nodeName: DEFAULT_NODE_ID, rawOk: !!localResult.ok, lastHealthyAt, reachabilityGraceMs });
    const observerReachable = resolveReachability({ nodeName: OBSERVER_NODE_ID, rawOk: !!observerResult.ok, lastHealthyAt, reachabilityGraceMs });
    const reviewReachable = resolveReachability({ nodeName: REVIEW_NODE_ID, rawOk: !!reviewResult.ok, lastHealthyAt, reachabilityGraceMs });

    if (observerStats && observerReachable) {
      observerStats.controlPlaneOk = true;
      observerStats.controlPlaneStatus = 'reachable';
    } else if (observerStats) {
      observerStats.controlPlaneOk = false;
      observerStats.controlPlaneStatus = 'unreachable';
    }
    if (reviewStats && reviewReachable) {
      reviewStats.controlPlaneOk = true;
      reviewStats.controlPlaneStatus = 'reachable';
    } else if (reviewStats) {
      reviewStats.controlPlaneOk = false;
      reviewStats.controlPlaneStatus = 'unreachable';
    }

    lastSnapshot = {
      ts: Date.now(),
      [DEFAULT_NODE_ID]: {
        node: DEFAULT_NODE_ID,
        reachable: localReachable,
        latencyMs: stableLatency(lastSnapshot, DEFAULT_NODE_ID, localResult),
        fallbackReady: true,
        probe: 'local_http',
        statsSource: 'local',
        statsStatus: localStats ? 'ok' : 'missing',
        stats: localStats,
      },
      [OBSERVER_NODE_ID]: {
        node: OBSERVER_NODE_ID,
        reachable: observerReachable,
        latencyMs: stableLatency(lastSnapshot, OBSERVER_NODE_ID, observerResult),
        fallbackReady: true,
        probe: observerUrl ? 'control_http' : 'relay_ssh',
        statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh',
        statsStatus: disableSshRemoteProbe ? 'disabled' : (observerStats ? 'ok' : 'missing'),
        stats: observerStats,
      },
      [REVIEW_NODE_ID]: {
        node: REVIEW_NODE_ID,
        reachable: reviewReachable,
        latencyMs: stableLatency(lastSnapshot, REVIEW_NODE_ID, reviewResult),
        fallbackReady: true,
        probe: reviewUrl ? 'control_http' : 'relay_ssh',
        statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh',
        statsStatus: disableSshRemoteProbe ? 'disabled' : (reviewStats ? 'ok' : 'missing'),
        stats: reviewStats,
      },
    };

    return exposeNodeSnapshot(lastSnapshot, teamStore);
  }

  function getNodeStatusSync() {
    return withLegacyNodeAliases(lastSnapshot);
  }

  function computeNodeWeights() {
    return computeNodeWeightsFromSnapshot(lastSnapshot);
  }

  function selectBestNode(preferredNode = DEFAULT_NODE_ID, fallbackNode = DEFAULT_NODE_ID, affinityBonus = 15) {
    return selectBestNodeFromSnapshot(lastSnapshot, preferredNode, fallbackNode, affinityBonus);
  }

  return {
    ping: (url, timeoutMs = 1500) => ping(fetchImpl, url, timeoutMs),
    refreshNodeStatus,
    getNodeStatusSync,
    computeNodeWeights,
    selectBestNode,
  };
}

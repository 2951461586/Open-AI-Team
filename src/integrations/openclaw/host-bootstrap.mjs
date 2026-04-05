import fs from 'node:fs';
import { applyMaintainerHostProbe, loadHostRuntimeConfig, loadMaintainerHostProbe, loadNeutralHostRuntimeConfig } from '../../index-host-config.mjs';
import { createTeamNodeHealth } from '../../team/team-node-health.mjs';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID } from '../../team/team-node-ids.mjs';
import { createControlPlaneClient } from '../../team-runtime-adapters/control-plane.mjs';
import { createRemoteSessionRuntimeAdapter } from '../../team-runtime-adapters/remote-session.mjs';
import { createRuntimeExecutionAdapter } from '../../team-runtime-adapters/execution-harness.mjs';
import { createOpenClawSessionControlPlaneTools } from './session-control-plane-tools.mjs';

function loadJsonFromUrl(urlLike, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(urlLike, 'utf8'));
  } catch {
    return fallback;
  }
}

export function buildOpenClawNodeControls({
  localControlUrl = '',
  controlToken = '',
  observerControlUrl = '',
  observerControlToken = '',
  reviewControlUrl = '',
  reviewControlToken = '',
} = {}) {
  return {
    [DEFAULT_NODE_ID]: { url: String(localControlUrl || '').trim(), token: String(controlToken || '').trim() },
    [OBSERVER_NODE_ID]: { url: String(observerControlUrl || '').trim(), token: String(observerControlToken || '').trim() },
    [REVIEW_NODE_ID]: { url: String(reviewControlUrl || '').trim(), token: String(reviewControlToken || '').trim() },
    laoda: { url: String(localControlUrl || '').trim(), token: String(controlToken || '').trim() },
    violet: { url: String(observerControlUrl || '').trim(), token: String(observerControlToken || '').trim() },
    lebang: { url: String(reviewControlUrl || '').trim(), token: String(reviewControlToken || '').trim() },
  };
}

export function createOpenClawRemoteSessionHostBootstrap(config = {}) {
  const neutralHostConfig = loadNeutralHostRuntimeConfig(config);
  const hostProbe = loadMaintainerHostProbe(config);
  const hostConfig = applyMaintainerHostProbe(config, neutralHostConfig, hostProbe);
  const networkPorts = hostConfig.networkPorts || loadJsonFromUrl(new URL('../../../config/team/network-ports.json', import.meta.url), {});
  const compatNetworkPorts = hostConfig.compatNetworkPorts || loadJsonFromUrl(new URL('../../../config/team/network-ports.compat.json', import.meta.url), {});
  const localControlUrl = String(hostConfig?.local?.controlBaseUrl || '').trim();
  const controlToken = String(hostConfig?.local?.controlToken || '').trim();
  const observerNode = hostConfig?.nodes?.[OBSERVER_NODE_ID] || hostConfig?.nodes?.violet || {};
  const reviewNode = hostConfig?.nodes?.[REVIEW_NODE_ID] || hostConfig?.nodes?.lebang || {};
  const observerCompatNode = compatNetworkPorts?.nodes?.[OBSERVER_NODE_ID] || compatNetworkPorts?.nodes?.violet || {};
  const reviewCompatNode = compatNetworkPorts?.nodes?.[REVIEW_NODE_ID] || compatNetworkPorts?.nodes?.lebang || {};
  const observerControlUrl = String(observerNode?.controlBaseUrl || '').trim();
  const observerControlToken = String(observerNode?.controlToken || '').trim() || controlToken;
  const reviewControlUrl = String(reviewNode?.controlBaseUrl || '').trim();
  const reviewControlToken = String(reviewNode?.controlToken || '').trim();

  return {
    hostKind: 'remote-session',
    integration: 'openclaw',
    hostConfig,
    networkPorts,
    compatNetworkPorts,
    controlToken,
    observerControlToken,
    reviewControlToken,
    createNodeHealth({ teamStore = null } = {}) {
      return createTeamNodeHealth({
        peerHost: String(observerNode?.host || ''),
        peerWebhookPort: Number(observerNode?.webhookPort || observerCompatNode?.services?.webhookTunnelAlias?.port || 19092),
        peerControlBaseUrl: observerControlUrl,
        peerControlToken: observerControlToken,
        lebangHost: String(reviewNode?.host || REVIEW_NODE_ID),
        lebangWebhookPort: Number(reviewNode?.webhookPort || reviewCompatNode?.services?.webhookTunnelAlias?.port || 19092),
        lebangControlBaseUrl: reviewControlUrl,
        lebangControlToken: reviewControlToken,
        controlPlaneSystemdUnit: String(hostConfig?.local?.controlPlaneSystemdUnit || 'orchestrator.service'),
        localControlUrl,
        teamStore,
      });
    },
    createSessionSubstrate({ roleDeployment } = {}) {
      const sessionControlPlane = createControlPlaneClient({
        roleDeployment,
        toolNames: createOpenClawSessionControlPlaneTools(),
        nodeControls: buildOpenClawNodeControls({
          localControlUrl,
          controlToken,
          observerControlUrl,
          observerControlToken,
          reviewControlUrl,
          reviewControlToken,
        }),
      });
      const runtimeAdapter = createRemoteSessionRuntimeAdapter({ sessionControlPlane, roleDeployment });
      const executionAdapter = createRuntimeExecutionAdapter({ runtimeAdapter });
      return {
        provider: 'remote-session',
        integration: 'openclaw',
        sessionSubstrate: sessionControlPlane,
        sessionControlPlane,
        runtimeAdapter,
        executionAdapter,
        agentHarness: runtimeAdapter,
        executionHarness: executionAdapter,
      };
    },
  };
}

export function createOpenClawControlPlaneHostBootstrap(config = {}) {
  return createOpenClawRemoteSessionHostBootstrap(config);
}

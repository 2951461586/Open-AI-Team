import { DEFAULT_SERVICE_ENV_UNIT, readServiceEnv } from './index-host-probe.mjs';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID, canonicalNodeId, nodeEnvPrefixes } from './team/team-node-ids.mjs';
import { firstNonEmpty, firstNumber, loadNeutralHostRuntimeConfig, resolveEnvValue } from './index-host-config-neutral.mjs';

function normalizeEnv(config = {}) {
  return (config.ENV && typeof config.ENV === 'object' && !Array.isArray(config.ENV)) ? config.ENV : {};
}

export function loadMaintainerHostProbe(config = {}) {
  const env = normalizeEnv(config);
  const serviceEnvUnit = firstNonEmpty(
    env.TEAM_SERVICE_ENV_UNIT,
    env.TEAM_CONTROL_PLANE_SYSTEMD_UNIT,
    process.env.TEAM_SERVICE_ENV_UNIT,
    process.env.TEAM_CONTROL_PLANE_SYSTEMD_UNIT,
    DEFAULT_SERVICE_ENV_UNIT,
  );
  const serviceEnv = readServiceEnv(serviceEnvUnit);
  return {
    serviceEnvUnit,
    serviceEnv,
    source: 'maintainer-host-probe',
  };
}

export function applyMaintainerHostProbe(config = {}, neutralConfig = loadNeutralHostRuntimeConfig(config), probe = loadMaintainerHostProbe(config)) {
  const env = normalizeEnv(config);
  const overlayEnv = probe?.serviceEnv || {};
  const serviceEnvUnit = String(probe?.serviceEnvUnit || DEFAULT_SERVICE_ENV_UNIT);

  function resolveNodeControl(nodeId = '') {
    const canonical = canonicalNodeId(nodeId, DEFAULT_NODE_ID);
    const envKeys = nodeEnvPrefixes(canonical);
    const existing = neutralConfig?.nodes?.[canonical] || {};
    return {
      ...existing,
      controlBaseUrl: firstNonEmpty(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_CONTROL_BASE_URL`, `${key}_CONTROL_URL`, `${key}_GATEWAY_BASE_URL`, `${key}_GATEWAY_URL`])),
        existing?.controlBaseUrl,
      ),
      controlPort: firstNumber(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_CONTROL_PORT`, `${key}_GATEWAY_PORT`])),
        existing?.controlPort,
      ),
      controlToken: firstNonEmpty(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_CONTROL_TOKEN`, `${key}_GATEWAY_TOKEN`])),
        existing?.controlToken,
      ),
      webhookPort: firstNumber(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_WEBHOOK_PORT`, `${key}_RELAY_WEBHOOK_PORT`])),
        existing?.webhookPort,
      ),
    };
  }

  const localControlToken = resolveEnvValue(env, overlayEnv, [
    'NODE_A_CONTROL_TOKEN',
    'AUTHORITY_CONTROL_TOKEN',
    'LAODA_CONTROL_TOKEN',
    'TEAM_CONTROL_TOKEN',
    'CONTROL_PLANE_TOKEN',
    'LAODA_GATEWAY_TOKEN',
    'OPENCLAW_GATEWAY_TOKEN',
  ]);

  const merged = {
    ...neutralConfig,
    serviceEnvUnit,
    local: {
      ...neutralConfig.local,
      controlToken: localControlToken,
      controlPlaneSystemdUnit: firstNonEmpty(
        resolveEnvValue(env, overlayEnv, ['TEAM_CONTROL_PLANE_SYSTEMD_UNIT', 'CONTROL_PLANE_SYSTEMD_UNIT']),
        serviceEnvUnit,
        DEFAULT_SERVICE_ENV_UNIT,
      ),
    },
    nodes: {
      ...neutralConfig.nodes,
      'node-a': {
        ...neutralConfig.nodes['node-a'],
        controlToken: localControlToken,
      },
      'node-b': resolveNodeControl(OBSERVER_NODE_ID),
      'node-c': resolveNodeControl(REVIEW_NODE_ID),
    },
    nativeChat: {
      ...neutralConfig.nativeChat,
      apiKey: firstNonEmpty(resolveEnvValue(env, overlayEnv, ['TEAM_NATIVE_CHAT_API_KEY', 'NATIVE_CHAT_API_KEY', 'CLIPROXYAPI_API_KEY']), neutralConfig?.nativeChat?.apiKey),
    },
  };

  // Legacy node name aliases removed — use canonical node-a/node-b/node-c.
  return merged;
}

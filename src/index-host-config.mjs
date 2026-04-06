import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SERVICE_ENV_UNIT,
  clearHostProbeCache,
  readAppEnvFile,
  readProcEnvValue as probeReadProcEnvValue,
  readServiceEnv as probeReadServiceEnv,
  resolveListeningPid as probeResolveListeningPid,
  resolveServiceMainPid,
} from './index-host-probe.mjs';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID, canonicalNodeId, nodeEnvPrefixes, resolveAliasedRecord } from './team/team-node-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function safeReadJson(filePath = '', fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(String(filePath || ''), 'utf8'));
  } catch {
    return fallback;
  }
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

export function firstNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

export function resolveEnvValue(env = {}, overlayEnv = {}, keys = []) {
  for (const key of keys) {
    const text = firstNonEmpty(env?.[key], process.env?.[key], overlayEnv?.[key]);
    if (text) return text;
  }
  return '';
}

export function loadRepoConfigJson(relativePath = '', fallback = {}) {
  return safeReadJson(path.resolve(__dirname, '..', relativePath), fallback);
}

export function loadNeutralHostRuntimeConfig(config = {}) {
  const appRoot = path.resolve(String(config.root || path.resolve(__dirname, '..')));
  const env = (config.ENV && typeof config.ENV === 'object' && !Array.isArray(config.ENV)) ? config.ENV : {};
  const rolesConfig = loadRepoConfigJson('config/team/roles.json', {});
  const networkPorts = loadRepoConfigJson('config/team/network-ports.json', {});
  const compatNetworkPorts = loadRepoConfigJson('config/team/network-ports.compat.json', {});

  const workspaceRoot = path.resolve(firstNonEmpty(
    env.TEAM_WORKSPACE_ROOT,
    env.WORKSPACE_ROOT,
    process.env.TEAM_WORKSPACE_ROOT,
    process.env.WORKSPACE_ROOT,
    appRoot,
  ));
  const taskWorkspaceRoot = path.resolve(firstNonEmpty(
    env.TEAM_TASK_WORKSPACE_ROOT,
    process.env.TEAM_TASK_WORKSPACE_ROOT,
    path.join(appRoot, 'task_workspaces'),
  ));

  const localNetworkNode = resolveAliasedRecord(networkPorts?.nodes || {}, DEFAULT_NODE_ID) || {};
  const localPort = firstNumber(
    resolveEnvValue(env, {}, ['NODE_A_CONTROL_PORT', 'AUTHORITY_CONTROL_PORT', 'LAODA_CONTROL_PORT', 'TEAM_CONTROL_PORT']),
    localNetworkNode?.services?.orchestrator?.port,
    19090,
  );
  const localControlBaseUrl = firstNonEmpty(
    resolveEnvValue(env, {}, ['NODE_A_CONTROL_BASE_URL', 'NODE_A_CONTROL_URL', 'AUTHORITY_CONTROL_BASE_URL', 'AUTHORITY_CONTROL_URL', 'LAODA_CONTROL_BASE_URL', 'LAODA_CONTROL_URL', 'TEAM_CONTROL_BASE_URL', 'TEAM_CONTROL_URL', 'LAODA_GATEWAY_BASE_URL', 'LAODA_GATEWAY_URL']),
    `http://127.0.0.1:${localPort}`,
  );

  function resolveNodeControl(nodeId = '', overlayEnv = {}) {
    const canonical = canonicalNodeId(nodeId, DEFAULT_NODE_ID);
    const envKeys = nodeEnvPrefixes(canonical);
    const nodeInfo = resolveAliasedRecord(rolesConfig?.nodeMap || {}, canonical) || {};
    const networkNode = resolveAliasedRecord(networkPorts?.nodes || {}, canonical) || {};
    const compatNode = resolveAliasedRecord(compatNetworkPorts?.nodes || {}, canonical) || {};
    return {
      id: canonical,
      host: firstNonEmpty(nodeInfo?.host, networkNode?.host, compatNode?.host),
      tailnetIp: firstNonEmpty(nodeInfo?.tailnetIp, networkNode?.tailnetIp, compatNode?.tailnetIp),
      controlBaseUrl: firstNonEmpty(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_CONTROL_BASE_URL`, `${key}_CONTROL_URL`, `${key}_GATEWAY_BASE_URL`, `${key}_GATEWAY_URL`])),
        nodeInfo?.controlBaseUrl,
        networkNode?.services?.gateway?.baseUrl,
      ),
      controlPort: firstNumber(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_CONTROL_PORT`, `${key}_GATEWAY_PORT`])),
        nodeInfo?.controlPort,
        networkNode?.services?.gateway?.port,
      ),
      controlToken: resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_CONTROL_TOKEN`, `${key}_GATEWAY_TOKEN`])),
      webhookPort: firstNumber(
        resolveEnvValue(env, overlayEnv, envKeys.flatMap((key) => [`${key}_WEBHOOK_PORT`, `${key}_RELAY_WEBHOOK_PORT`])),
        compatNode?.services?.webhookTunnelAlias?.port,
      ),
      connectivity: firstNonEmpty(nodeInfo?.connectivity, networkNode?.services?.gateway?.role),
      note: firstNonEmpty(nodeInfo?.note, nodeInfo?.description),
    };
  }

  const neutralConfig = {
    appRoot,
    workspaceRoot,
    taskWorkspaceRoot,
    networkPorts,
    compatNetworkPorts,
    rolesConfig,
    local: {
      controlBaseUrl: localControlBaseUrl,
      controlPort: localPort,
      controlToken: '',
      controlPlaneSystemdUnit: '',
    },
    nodes: {
      'node-a': {
        id: 'node-a',
        host: firstNonEmpty(localNetworkNode?.host, '127.0.0.1'),
        controlBaseUrl: localControlBaseUrl,
        controlPort: localPort,
        controlToken: '',
      },
      'node-b': resolveNodeControl(OBSERVER_NODE_ID),
      'node-c': resolveNodeControl(REVIEW_NODE_ID),
    },
    nativeChat: {
      baseUrl: firstNonEmpty(resolveEnvValue(env, {}, ['TEAM_NATIVE_CHAT_BASE_URL', 'NATIVE_CHAT_BASE_URL', 'CLIPROXYAPI_BASE_URL']), 'http://127.0.0.1:8317/v1'),
      apiKey: firstNonEmpty(resolveEnvValue(env, {}, ['TEAM_NATIVE_CHAT_API_KEY', 'NATIVE_CHAT_API_KEY', 'CLIPROXYAPI_API_KEY'])),
      model: firstNonEmpty(resolveEnvValue(env, {}, ['TEAM_NATIVE_CHAT_MODEL', 'NATIVE_CHAT_MODEL', 'CLIPROXYAPI_MODEL']), 'gpt-5.4'),
    },
  };

  // Legacy node name aliases removed — use canonical node-a/node-b/node-c.
  // Backward compatibility is handled by withLegacyNodeAliases() in team-node-ids.mjs.
  return neutralConfig;
}

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
  const serviceEnv = probeReadServiceEnv(serviceEnvUnit);
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


export function readServiceEnv(serviceUnit = DEFAULT_SERVICE_ENV_UNIT) {
  return probeReadServiceEnv(serviceUnit);
}

export function readProcEnvValue(pid, name = '') {
  return probeReadProcEnvValue(pid, name);
}

export function resolveListeningPid(port = 0) {
  return probeResolveListeningPid(port);
}

export function clearHostRuntimeConfigCache() {
  clearHostProbeCache();
}

export function loadLiveEnvToken(name = '', config = {}) {
  const key = String(name || '').trim();
  if (!key) return '';
  const direct = firstNonEmpty(
    process.env?.[key],
    config?.ENV?.[key],
    config?.[key],
  );
  if (direct) return direct;

  const hostConfig = loadHostRuntimeConfig(config);
  const serviceEnvUnit = String(hostConfig?.serviceEnvUnit || hostConfig?.local?.controlPlaneSystemdUnit || DEFAULT_SERVICE_ENV_UNIT);
  const serviceEnv = readServiceEnv(serviceEnvUnit);
  const serviceValue = firstNonEmpty(serviceEnv?.[key]);
  if (serviceValue) return serviceValue;

  const localPid = resolveListeningPid(hostConfig?.local?.controlPort || 0);
  const procValue = readProcEnvValue(localPid, key);
  if (procValue) return procValue;

  const mainPid = resolveServiceMainPid(serviceEnvUnit);
  const mainPidValue = readProcEnvValue(mainPid, key);
  if (mainPidValue) return mainPidValue;

  const fileEnv = readAppEnvFile(hostConfig?.appRoot || config?.root || path.resolve(__dirname, '..'));
  return firstNonEmpty(fileEnv?.[key]);
}

export function loadHostRuntimeConfig(config = {}) {
  const neutralConfig = loadNeutralHostRuntimeConfig(config);
  const probeMode = String(config?.hostProbeMode || config?.ENV?.TEAM_HOST_PROBE_MODE || process.env.TEAM_HOST_PROBE_MODE || 'maintainer').trim().toLowerCase();
  if (probeMode === 'none' || probeMode === 'off' || probeMode === 'disabled') return neutralConfig;
  return applyMaintainerHostProbe(config, neutralConfig, loadMaintainerHostProbe(config));
}

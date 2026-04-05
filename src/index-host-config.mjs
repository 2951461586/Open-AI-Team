import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID, canonicalNodeId, nodeEnvPrefixes, resolveAliasedRecord } from './team/team-node-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function safeReadJson(filePath = '', fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(String(filePath || ''), 'utf8'));
  } catch {
    return fallback;
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function firstNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

let serviceEnvCache = new Map();

export function readServiceEnv(serviceUnit = 'orchestrator.service') {
  const unit = String(serviceUnit || 'orchestrator.service').trim() || 'orchestrator.service';
  if (serviceEnvCache.has(unit)) return serviceEnvCache.get(unit);
  const out = {};
  try {
    const raw = String(execSync(`systemctl --user show ${unit} --property=Environment --no-pager`, { encoding: 'utf8' }) || '');
    const line = raw.split(/\r?\n/).find((x) => x.startsWith('Environment=')) || '';
    const body = line.slice('Environment='.length);
    const regex = /(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
    let m;
    while ((m = regex.exec(body))) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  } catch {}
  serviceEnvCache.set(unit, out);
  return out;
}

function readEnvFile(appRoot = '') {
  const filePath = path.join(String(appRoot || path.resolve(__dirname, '..')), '.env');
  const out = {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of String(raw || '').split(/\r?\n/)) {
      const text = String(line || '').trim();
      if (!text || text.startsWith('#')) continue;
      const index = text.indexOf('=');
      if (index <= 0) continue;
      out[text.slice(0, index)] = text.slice(index + 1);
    }
  } catch {}
  return out;
}

export function readProcEnvValue(pid, name = '') {
  try {
    const safePid = String(pid || '').trim();
    const key = String(name || '').trim();
    if (!safePid || !key) return '';
    const envText = fs.readFileSync(`/proc/${safePid}/environ`, 'utf8').replace(/\0/g, '\n');
    const tokenLine = envText.split(/\r?\n/).find((x) => x.startsWith(`${key}=`)) || '';
    return tokenLine.split('=').slice(1).join('=').trim();
  } catch {
    return '';
  }
}

export function resolveListeningPid(port = 0) {
  const safePort = Number(port || 0);
  if (!Number.isFinite(safePort) || safePort <= 0) return '';
  try {
    return String(execSync(`ss -ltnp | awk '/:${safePort} / {print $NF}' | sed -n 's/.*pid=\\([0-9]\\+\\).*/\\1/p' | head -n1`, { encoding: 'utf8' }) || '').trim();
  } catch {
    return '';
  }
}

function resolveServiceMainPid(serviceUnit = '') {
  const unit = String(serviceUnit || '').trim();
  if (!unit) return '';
  try {
    return String(execSync(`systemctl --user show -p MainPID --value ${unit}`, { encoding: 'utf8' }) || '').trim();
  } catch {
    return '';
  }
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
  const serviceEnv = readServiceEnv(hostConfig?.serviceEnvUnit || hostConfig?.local?.controlPlaneSystemdUnit || 'orchestrator.service');
  const serviceValue = firstNonEmpty(serviceEnv?.[key]);
  if (serviceValue) return serviceValue;

  const localPid = resolveListeningPid(hostConfig?.local?.controlPort || 0);
  const procValue = readProcEnvValue(localPid, key);
  if (procValue) return procValue;

  const mainPid = resolveServiceMainPid(hostConfig?.serviceEnvUnit || hostConfig?.local?.controlPlaneSystemdUnit || 'orchestrator.service');
  const mainPidValue = readProcEnvValue(mainPid, key);
  if (mainPidValue) return mainPidValue;

  const fileEnv = readEnvFile(hostConfig?.appRoot || config?.root || path.resolve(__dirname, '..'));
  return firstNonEmpty(fileEnv?.[key]);
}

function resolveEnvValue(env = {}, serviceEnv = {}, keys = []) {
  for (const key of keys) {
    const text = firstNonEmpty(env?.[key], process.env?.[key], serviceEnv?.[key]);
    if (text) return text;
  }
  return '';
}

function loadRepoConfigJson(relativePath = '', fallback = {}) {
  return safeReadJson(path.resolve(__dirname, '..', relativePath), fallback);
}

export function clearHostRuntimeConfigCache() {
  serviceEnvCache = new Map();
}

export function loadHostRuntimeConfig(config = {}) {
  const appRoot = path.resolve(String(config.root || path.resolve(__dirname, '..')));
  const env = (config.ENV && typeof config.ENV === 'object' && !Array.isArray(config.ENV)) ? config.ENV : {};
  const serviceEnvUnit = firstNonEmpty(
    env.TEAM_SERVICE_ENV_UNIT,
    env.TEAM_CONTROL_PLANE_SYSTEMD_UNIT,
    process.env.TEAM_SERVICE_ENV_UNIT,
    process.env.TEAM_CONTROL_PLANE_SYSTEMD_UNIT,
    'orchestrator.service',
  );
  const serviceEnv = readServiceEnv(serviceEnvUnit);

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
    resolveEnvValue(env, serviceEnv, ['NODE_A_CONTROL_PORT', 'AUTHORITY_CONTROL_PORT', 'LAODA_CONTROL_PORT', 'TEAM_CONTROL_PORT']),
    localNetworkNode?.services?.orchestrator?.port,
    19090,
  );
  const localControlBaseUrl = firstNonEmpty(
    resolveEnvValue(env, serviceEnv, ['NODE_A_CONTROL_BASE_URL', 'NODE_A_CONTROL_URL', 'AUTHORITY_CONTROL_BASE_URL', 'AUTHORITY_CONTROL_URL', 'LAODA_CONTROL_BASE_URL', 'LAODA_CONTROL_URL', 'TEAM_CONTROL_BASE_URL', 'TEAM_CONTROL_URL', 'LAODA_GATEWAY_BASE_URL', 'LAODA_GATEWAY_URL']),
    `http://127.0.0.1:${localPort}`,
  );

  function resolveNodeControl(nodeId = '') {
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
        resolveEnvValue(env, serviceEnv, envKeys.flatMap((key) => [`${key}_CONTROL_BASE_URL`, `${key}_CONTROL_URL`, `${key}_GATEWAY_BASE_URL`, `${key}_GATEWAY_URL`])),
        nodeInfo?.controlBaseUrl,
        networkNode?.services?.gateway?.baseUrl,
      ),
      controlPort: firstNumber(
        resolveEnvValue(env, serviceEnv, envKeys.flatMap((key) => [`${key}_CONTROL_PORT`, `${key}_GATEWAY_PORT`])),
        nodeInfo?.controlPort,
        networkNode?.services?.gateway?.port,
      ),
      controlToken: resolveEnvValue(env, serviceEnv, envKeys.flatMap((key) => [`${key}_CONTROL_TOKEN`, `${key}_GATEWAY_TOKEN`])),
      webhookPort: firstNumber(
        resolveEnvValue(env, serviceEnv, envKeys.flatMap((key) => [`${key}_WEBHOOK_PORT`, `${key}_RELAY_WEBHOOK_PORT`])),
        compatNode?.services?.webhookTunnelAlias?.port,
      ),
      connectivity: firstNonEmpty(nodeInfo?.connectivity, networkNode?.services?.gateway?.role),
      note: firstNonEmpty(nodeInfo?.note, nodeInfo?.description),
    };
  }

  const localControlToken = resolveEnvValue(env, serviceEnv, [
    'NODE_A_CONTROL_TOKEN',
    'AUTHORITY_CONTROL_TOKEN',
    'LAODA_CONTROL_TOKEN',
    'TEAM_CONTROL_TOKEN',
    'CONTROL_PLANE_TOKEN',
    'LAODA_GATEWAY_TOKEN',
    'OPENCLAW_GATEWAY_TOKEN',
  ]);

  const nodeB = resolveNodeControl(OBSERVER_NODE_ID);
  const nodeC = resolveNodeControl(REVIEW_NODE_ID);

  const nativeChatBaseUrl = firstNonEmpty(
    resolveEnvValue(env, serviceEnv, ['TEAM_NATIVE_CHAT_BASE_URL', 'NATIVE_CHAT_BASE_URL', 'CLIPROXYAPI_BASE_URL']),
    'http://127.0.0.1:8317/v1',
  );
  const nativeChatApiKey = resolveEnvValue(env, serviceEnv, [
    'TEAM_NATIVE_CHAT_API_KEY',
    'NATIVE_CHAT_API_KEY',
    'CLIPROXYAPI_API_KEY',
  ]);
  const nativeChatModel = firstNonEmpty(
    resolveEnvValue(env, serviceEnv, ['TEAM_NATIVE_CHAT_MODEL', 'NATIVE_CHAT_MODEL', 'CLIPROXYAPI_MODEL']),
    'gpt-5.4',
  );

  return {
    appRoot,
    workspaceRoot,
    taskWorkspaceRoot,
    serviceEnvUnit,
    networkPorts,
    compatNetworkPorts,
    rolesConfig,
    local: {
      controlBaseUrl: localControlBaseUrl,
      controlPort: localPort,
      controlToken: localControlToken,
      controlPlaneSystemdUnit: firstNonEmpty(
        resolveEnvValue(env, serviceEnv, ['TEAM_CONTROL_PLANE_SYSTEMD_UNIT', 'CONTROL_PLANE_SYSTEMD_UNIT']),
        serviceEnvUnit,
        'orchestrator.service',
      ),
    },
    nodes: {
      'node-a': {
        id: 'node-a',
        host: firstNonEmpty(localNetworkNode?.host, '127.0.0.1'),
        controlBaseUrl: localControlBaseUrl,
        controlPort: localPort,
        controlToken: localControlToken,
      },
      'node-b': nodeB,
      'node-c': nodeC,
      laoda: {
        id: 'node-a',
        host: firstNonEmpty(localNetworkNode?.host, '127.0.0.1'),
        controlBaseUrl: localControlBaseUrl,
        controlPort: localPort,
        controlToken: localControlToken,
      },
      violet: nodeB,
      lebang: nodeC,
    },
    nativeChat: {
      baseUrl: nativeChatBaseUrl,
      apiKey: nativeChatApiKey,
      model: nativeChatModel,
    },
  };
}

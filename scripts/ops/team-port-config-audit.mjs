import fs from 'node:fs';
import path from 'node:path';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { loadHostRuntimeConfig, readServiceEnv } from '../../src/index-host-config.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const portsPath = path.join(root, 'config/team/network-ports.json');
const compatPortsPath = path.join(root, 'config/team/network-ports.compat.json');
const rolesPath = path.join(root, 'config/team/roles.json');
const env = loadIndexConfig();
const hostConfig = loadHostRuntimeConfig(env);
const loadedEnv = env.ENV || {};
const serviceEnv = readServiceEnv(hostConfig?.serviceEnvUnit || hostConfig?.local?.controlPlaneSystemdUnit || 'orchestrator.service');
const rawEnv = { ...serviceEnv, ...loadedEnv };

const ports = JSON.parse(fs.readFileSync(portsPath, 'utf8'));
const compatPorts = JSON.parse(fs.readFileSync(compatPortsPath, 'utf8'));
const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));

const findings = [];
function check(ok, key, expected, actual, level = 'error') {
  findings.push({ ok, key, expected, actual, level });
}

const nodeA = ports?.nodes?.['node-a'] || {};
const nodeB = ports?.nodes?.['node-b'] || {};
const nodeC = ports?.nodes?.['node-c'] || {};
const compatNodeA = compatPorts?.nodes?.['node-a'] || {};
const compatNodeB = compatPorts?.nodes?.['node-b'] || {};
const compatNodeC = compatPorts?.nodes?.['node-c'] || {};
const roleNodeA = roles?.nodeMap?.['node-a'] || {};
const roleNodeB = roles?.nodeMap?.['node-b'] || {};
const roleNodeC = roles?.nodeMap?.['node-c'] || {};

check(Number(compatNodeA?.services?.legacyCompat19100?.port || 0) === 19100,
  'compat.node-a.legacyCompat19100.port', 19100, compatNodeA?.services?.legacyCompat19100?.port, 'warn');
check(Number(compatNodeB?.services?.legacyCompat19100?.port || 0) === 19100,
  'compat.node-b.legacyCompat19100.port', 19100, compatNodeB?.services?.legacyCompat19100?.port, 'warn');
check(Number(compatNodeC?.services?.legacyCompat19100?.port || 0) === 19100,
  'compat.node-c.legacyCompat19100.port', 19100, compatNodeC?.services?.legacyCompat19100?.port, 'warn');

check(String(roleNodeB?.controlBaseUrl || '') === String(nodeB?.services?.gateway?.baseUrl || ''),
  'node-b.controlBaseUrl', nodeB?.services?.gateway?.baseUrl, roleNodeB?.controlBaseUrl);
check(String(roleNodeC?.controlBaseUrl || '') === String(nodeC?.services?.gateway?.baseUrl || ''),
  'node-c.controlBaseUrl', nodeC?.services?.gateway?.baseUrl, roleNodeC?.controlBaseUrl);
check((roleNodeB?.connectivity || '') === 'remote_https_gateway',
  'node-b.connectivity', 'remote_https_gateway', roleNodeB?.connectivity);
check((roleNodeC?.connectivity || '') === 'remote_https_gateway',
  'node-c.connectivity', 'remote_https_gateway', roleNodeC?.connectivity);

check(['compat_only', 'legacy_optional'].includes(String(compatNodeA?.services?.nodeBBridgeAlias?.status || '')),
  'compat.node-a.nodeBBridgeAlias.status', 'compat_only|legacy_optional', compatNodeA?.services?.nodeBBridgeAlias?.status, 'warn');
check(['compat_only', 'legacy_optional'].includes(String(compatNodeA?.services?.nodeCBridgeAlias?.status || '')),
  'compat.node-a.nodeCBridgeAlias.status', 'compat_only|legacy_optional', compatNodeA?.services?.nodeCBridgeAlias?.status, 'warn');

check(env.PORT === Number(nodeA?.services?.orchestrator?.port || 0),
  'env.PORT', nodeA?.services?.orchestrator?.port, env.PORT);
check(!(env.BRIDGE_KICK_URL_LAODA),
  'env.BRIDGE_KICK_URL_LAODA.retired', 'retired_default_empty', env.BRIDGE_KICK_URL_LAODA, 'warn');

const nodeBGatewayEnv = String(rawEnv.NODE_B_GATEWAY_URL || rawEnv.TEAM_NODE_B_GATEWAY_URL || rawEnv.VIOLET_GATEWAY_URL || rawEnv.VIOLET_GATEWAY_BASE_URL || '');
const nodeCGatewayEnv = String(rawEnv.NODE_C_GATEWAY_URL || rawEnv.TEAM_NODE_C_GATEWAY_URL || rawEnv.LEBANG_GATEWAY_URL || rawEnv.LEBANG_GATEWAY_BASE_URL || '');
if (nodeBGatewayEnv) {
  check(nodeBGatewayEnv.startsWith('https://'),
    'env.NODE_B_GATEWAY_URL.scheme', 'https://*', nodeBGatewayEnv, 'warn');
}
if (nodeCGatewayEnv) {
  check(nodeCGatewayEnv.startsWith('https://'),
    'env.NODE_C_GATEWAY_URL.scheme', 'https://*', nodeCGatewayEnv, 'warn');
}

const summary = {
  ok: findings.every((x) => x.ok || x.level === 'warn'),
  total: findings.length,
  failed: findings.filter((x) => !x.ok && x.level !== 'warn').length,
  warned: findings.filter((x) => !x.ok && x.level === 'warn').length,
  nodeCLegacyCompat19100Port: compatNodeC?.services?.legacyCompat19100?.port || 0,
  nodeCBridgeAliasPort: compatNodeA?.services?.nodeCBridgeAlias?.port || 0,
};

console.log(JSON.stringify({
  ok: summary.ok,
  contract: ports?.contract || '',
  summary,
  findings,
  notes: {
    planner: ports?.roleRouting?.planner,
    critic: ports?.roleRouting?.critic,
    output: ports?.roleRouting?.output,
  }
}, null, 2));

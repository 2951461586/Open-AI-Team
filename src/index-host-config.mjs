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
import { firstNonEmpty, loadNeutralHostRuntimeConfig } from './index-host-config-neutral.mjs';
import { applyMaintainerHostProbe, loadMaintainerHostProbe } from './index-host-config-maintainer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { firstNonEmpty, loadNeutralHostRuntimeConfig, loadMaintainerHostProbe, applyMaintainerHostProbe };

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

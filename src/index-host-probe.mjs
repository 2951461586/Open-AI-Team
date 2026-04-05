import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SERVICE_ENV_UNIT = '';

let serviceEnvCache = new Map();

export function clearHostProbeCache() {
  serviceEnvCache = new Map();
}

export function readServiceEnv(serviceUnit = DEFAULT_SERVICE_ENV_UNIT) {
  const unit = String(serviceUnit || DEFAULT_SERVICE_ENV_UNIT).trim() || DEFAULT_SERVICE_ENV_UNIT;
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

export function resolveServiceMainPid(serviceUnit = '') {
  const unit = String(serviceUnit || '').trim();
  if (!unit) return '';
  try {
    return String(execSync(`systemctl --user show -p MainPID --value ${unit}`, { encoding: 'utf8' }) || '').trim();
  } catch {
    return '';
  }
}

export function readAppEnvFile(appRoot = '') {
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

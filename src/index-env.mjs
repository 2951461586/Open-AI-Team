import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadIndexConfig() {
  const root = path.resolve(__dirname, '..');

  const envPath = path.join(root, '.env');
  const exPath = path.join(root, '.env.example');
  const src = fs.existsSync(envPath) ? envPath : (fs.existsSync(exPath) ? exPath : '');
  const raw = src ? fs.readFileSync(src, 'utf8') : '';
  const fileEnv = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    fileEnv[t.slice(0, i)] = t.slice(i + 1);
  }
  const ENV = {
    ...fileEnv,
    ...Object.fromEntries(Object.entries(process.env || {}).filter(([, v]) => v != null)),
  };

  const PORT = Number(ENV.PORT || 19090);
  const ORCH_KICK_TOKEN = String(ENV.ORCH_KICK_TOKEN || '').trim();
  const DASHBOARD_TOKEN = String(ENV.DASHBOARD_TOKEN || '').trim();
  const DASHBOARD_CORS_ORIGIN = String(ENV.DASHBOARD_CORS_ORIGIN || '').trim();
  const TEAM_DB_PATH = ENV.TEAM_DB_PATH || path.join(root, 'state', 'team-runtime.db');
  const TEAM_JUDGE_TRUE_EXECUTION = String(ENV.TEAM_JUDGE_TRUE_EXECUTION || '0').trim() === '1';
  const TEAM_REROUTE_JUDGE_STUB = String(ENV.TEAM_REROUTE_JUDGE_STUB || '0').trim() === '1';
  const BIND = String(ENV.BIND || '0.0.0.0').trim();

  return {
    root,
    ENV,
    PORT,
    TEAM_DB_PATH,
    ORCH_KICK_TOKEN,
    DASHBOARD_TOKEN,
    DASHBOARD_CORS_ORIGIN,
    TEAM_JUDGE_TRUE_EXECUTION,
    TEAM_REROUTE_JUDGE_STUB,
    BIND,
  };
}

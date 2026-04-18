import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config', 'team', 'models.json');

let _cachedConfig = null;
let _cachedMtime = 0;

export function loadTeamModelsConfig(configPath = CONFIG_PATH) {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    return buildEmptyConfig();
  }

  const stat = fs.statSync(abs);
  const mtime = stat.mtimeMs || 0;

  if (_cachedConfig && abs === CONFIG_PATH && mtime === _cachedMtime) {
    return _cachedConfig;
  }

  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const parsed = JSON.parse(raw);
    _cachedConfig = normalizeConfig(parsed);
    _cachedMtime = mtime;
  } catch {
    _cachedConfig = buildEmptyConfig();
  }
  return _cachedConfig;
}

export function saveTeamModelsConfig(config, configPath = CONFIG_PATH) {
  const abs = path.resolve(configPath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const normalized = normalizeConfig(config);
  fs.writeFileSync(abs, JSON.stringify(normalized, null, 2), 'utf8');
  _cachedConfig = normalized;
  _cachedMtime = Date.now();
  return normalized;
}

function buildEmptyConfig() {
  return {
    chat: { provider: 'openai', model: 'gpt-4o', maxRetries: 1 },
    utility: { provider: 'openai', model: 'gpt-4o-mini', maxRetries: 2 },
    reasoning: { provider: 'openai', model: 'gpt-4o-mini', maxRetries: 1 },
  };
}

function normalizeConfig(raw = {}) {
  const roles = ['chat', 'utility', 'reasoning'];
  const normalized = {};
  for (const role of roles) {
    const data = raw[role] || {};
    normalized[role] = {
      provider: String(data.provider || 'openai'),
      model: String(data.model || 'gpt-4o'),
      maxRetries: Number(data.maxRetries || 1),
      baseUrl: data.baseUrl ? String(data.baseUrl) : undefined,
      apiKey: data.apiKey ? String(data.apiKey) : undefined,
    };
  }
  return normalized;
}

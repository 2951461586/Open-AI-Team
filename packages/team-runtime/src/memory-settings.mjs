import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MEMORY_CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config', 'team', 'memory.json');
const DEFAULT_ROLE_CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config', 'team', 'roles.json');

const DEFAULT_SETTINGS = Object.freeze({
  persistence: {
    driver: 'fs',
    baseDir: path.resolve(__dirname, '..', '..', 'state', 'team-memory'),
    archiveDirName: 'archive',
    activeFileName: 'entries.json',
    statsFileName: 'stats.json',
  },
  retrieval: {
    defaultLimit: 8,
    maxLimit: 50,
    keywordWeight: 0.45,
    vectorWeight: 0.35,
    recencyWeight: 0.20,
    minScore: 0.08,
    nearEventWindowDays: 30,
    nearEventBoost: 1.35,
    keywordSaturation: 6,
  },
  decay: {
    enabled: true,
    curve: 'exponential',
    halfLifeDays: 21,
    minStrength: 0.02,
    archiveThreshold: 0.10,
    forgetThreshold: 0.03,
    importanceFloor: 0.05,
    importanceCeiling: 1,
  },
  embedding: {
    dimensions: 256,
    minTokenLength: 2,
    maxTokensPerEntry: 64,
  },
  windows: {
    defaultDays: 180,
    recentDays: 30,
  },
  categories: ['fact', 'decision', 'plan', 'artifact', 'observation', 'conversation', 'other'],
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, extra) {
  if (!isPlainObject(base)) return clone(extra);
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = mergeDeep(out[key], value);
    else out[key] = clone(value);
  }
  return out;
}

function safeReadJson(filePath = '') {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function getDefaultMemorySettings() {
  return clone(DEFAULT_SETTINGS);
}

export function normalizeMemorySettings(raw = {}) {
  const merged = mergeDeep(getDefaultMemorySettings(), raw || {});
  const halfLifeDays = Math.max(1, Number(merged?.decay?.halfLifeDays || 21));
  const nearEventWindowDays = Math.max(1, Number(merged?.retrieval?.nearEventWindowDays || 30));
  const defaultLimit = Math.max(1, Number(merged?.retrieval?.defaultLimit || 8));
  const maxLimit = Math.max(defaultLimit, Number(merged?.retrieval?.maxLimit || 50));
  merged.persistence.driver = String(merged?.persistence?.driver || 'fs');
  merged.persistence.baseDir = path.resolve(String(merged?.persistence?.baseDir || DEFAULT_SETTINGS.persistence.baseDir));
  merged.persistence.archiveDirName = String(merged?.persistence?.archiveDirName || 'archive');
  merged.persistence.activeFileName = String(merged?.persistence?.activeFileName || 'entries.json');
  merged.persistence.statsFileName = String(merged?.persistence?.statsFileName || 'stats.json');
  merged.retrieval.defaultLimit = defaultLimit;
  merged.retrieval.maxLimit = maxLimit;
  merged.retrieval.keywordWeight = Number(merged?.retrieval?.keywordWeight || 0.45);
  merged.retrieval.vectorWeight = Number(merged?.retrieval?.vectorWeight || 0.35);
  merged.retrieval.recencyWeight = Number(merged?.retrieval?.recencyWeight || 0.20);
  merged.retrieval.minScore = Math.max(0, Number(merged?.retrieval?.minScore || 0.08));
  merged.retrieval.nearEventWindowDays = nearEventWindowDays;
  merged.retrieval.nearEventBoost = Math.max(1, Number(merged?.retrieval?.nearEventBoost || 1.35));
  merged.retrieval.keywordSaturation = Math.max(1, Number(merged?.retrieval?.keywordSaturation || 6));
  merged.decay.enabled = merged?.decay?.enabled !== false;
  merged.decay.curve = String(merged?.decay?.curve || 'exponential');
  merged.decay.halfLifeDays = halfLifeDays;
  merged.decay.minStrength = Math.max(0, Number(merged?.decay?.minStrength || 0.02));
  merged.decay.archiveThreshold = Math.max(merged.decay.minStrength, Number(merged?.decay?.archiveThreshold || 0.10));
  merged.decay.forgetThreshold = Math.max(0, Number(merged?.decay?.forgetThreshold || 0.03));
  merged.decay.importanceFloor = Math.max(0, Number(merged?.decay?.importanceFloor || 0.05));
  merged.decay.importanceCeiling = Math.max(merged.decay.importanceFloor, Number(merged?.decay?.importanceCeiling || 1));
  merged.embedding.dimensions = Math.max(32, Number(merged?.embedding?.dimensions || 256));
  merged.embedding.minTokenLength = Math.max(1, Number(merged?.embedding?.minTokenLength || 2));
  merged.embedding.maxTokensPerEntry = Math.max(8, Number(merged?.embedding?.maxTokensPerEntry || 64));
  merged.windows.defaultDays = Math.max(1, Number(merged?.windows?.defaultDays || 180));
  merged.windows.recentDays = Math.max(1, Number(merged?.windows?.recentDays || 30));
  merged.categories = Array.isArray(merged?.categories) ? [...new Set(merged.categories.map((x) => String(x || '').trim()).filter(Boolean))] : [...DEFAULT_SETTINGS.categories];
  return merged;
}

export function loadMemorySettings({ configPath = DEFAULT_MEMORY_CONFIG_PATH, rolesPath = DEFAULT_ROLE_CONFIG_PATH, defaults = {} } = {}) {
  const base = normalizeMemorySettings(defaults);
  const roleConfig = safeReadJson(rolesPath) || {};
  const raw = safeReadJson(configPath) || {};
  const merged = normalizeMemorySettings(mergeDeep(base, raw));
  const roleScopes = Object.fromEntries(
    Object.entries(roleConfig?.roles || {}).map(([role, cfg]) => [role, String(cfg?.memoryScope || `team/${role}`)])
  );
  return {
    ...merged,
    configPath: path.resolve(configPath),
    rolesPath: path.resolve(rolesPath),
    roleScopes,
  };
}

export function resolveMemoryScope(role = '', { roles = {}, settings = null } = {}) {
  const roleKey = String(role || '').trim();
  if (!roleKey) return 'team/runtime';
  if (roles?.[roleKey]?.memoryScope) return String(roles[roleKey].memoryScope);
  if (settings?.roleScopes?.[roleKey]) return String(settings.roleScopes[roleKey]);
  return `team/${roleKey}`;
}

export { DEFAULT_MEMORY_CONFIG_PATH, DEFAULT_ROLE_CONFIG_PATH };

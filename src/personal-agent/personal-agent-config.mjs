import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_PERSONAL_AGENT_CONFIG = Object.freeze({
  id: 'default',
  name: 'Personal Agent',
  personality: {
    systemPrompt: '你是一个持续陪伴单个用户的 Personal Agent，优先保持连续上下文、低噪音、直接有用。',
    tone: '自然',
    style: '清晰',
    traits: ['连续性优先', '少打扰', '长期记忆'],
  },
  memory: {
    enabled: true,
    scope: 'personal/default',
    recentLimit: 20,
    summary: '',
  },
  cronJobs: [],
  model: 'default',
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

export function normalizePersonalConfig(raw = {}) {
  const merged = mergeDeep(clone(DEFAULT_PERSONAL_AGENT_CONFIG), raw || {});
  merged.id = String(merged.id || 'default').trim() || 'default';
  merged.name = String(merged.name || merged.id || 'Personal Agent').trim();
  merged.personality = isPlainObject(merged.personality) ? merged.personality : {};
  merged.personality.systemPrompt = String(merged.personality.systemPrompt || DEFAULT_PERSONAL_AGENT_CONFIG.personality.systemPrompt).trim();
  merged.personality.tone = String(merged.personality.tone || '自然').trim();
  merged.personality.style = String(merged.personality.style || '清晰').trim();
  merged.personality.traits = Array.isArray(merged.personality.traits)
    ? merged.personality.traits.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  merged.memory = isPlainObject(merged.memory) ? merged.memory : {};
  merged.memory.enabled = merged.memory.enabled !== false;
  const rawMemoryScope = isPlainObject(raw?.memory) ? String(raw.memory.scope || '').trim() : '';
  merged.memory.scope = String(rawMemoryScope || `personal/${merged.id}`).trim();
  merged.memory.recentLimit = Math.max(1, Number(merged.memory.recentLimit || 20));
  merged.memory.summary = String(merged.memory.summary || '').trim();
  merged.cronJobs = Array.isArray(merged.cronJobs)
    ? merged.cronJobs.map((job, index) => ({
      id: String(job?.id || `cron-${index + 1}`).trim(),
      name: String(job?.name || job?.id || `Cron ${index + 1}`).trim(),
      schedule: String(job?.schedule || '').trim(),
      prompt: String(job?.prompt || '').trim(),
      enabled: job?.enabled !== false,
    }))
    : [];
  merged.model = String(merged.model || 'default').trim();
  return merged;
}

export function loadPersonalConfig(configPath) {
  const abs = path.resolve(String(configPath || ''));
  if (!abs) throw new Error('config_path_required');
  if (!fs.existsSync(abs)) return normalizePersonalConfig({});
  const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  return normalizePersonalConfig(parsed);
}

export function savePersonalConfig(config, configPath) {
  const abs = path.resolve(String(configPath || ''));
  if (!abs) throw new Error('config_path_required');
  const normalized = normalizePersonalConfig(config);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export default {
  DEFAULT_PERSONAL_AGENT_CONFIG,
  normalizePersonalConfig,
  loadPersonalConfig,
  savePersonalConfig,
};

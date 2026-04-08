import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPersonalityPromptSection,
  buildPromptInjectionMetadata,
  injectPersonalityIntoSystemPrompt,
} from './personality-prompt-injector.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PERSONALITIES_PATH = path.resolve(__dirname, '..', '..', 'config', 'team', 'personalities.json');

let cachedRegistry = null;
let cachedRegistryPath = '';
let cachedRegistryMtime = 0;

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item))
      .filter(Boolean)
    : [];
}

function normalizePersonality(raw = {}, fallbackId = '') {
  const id = normalizeString(raw.id || fallbackId || raw.name).toLowerCase() || 'default';
  const scenarios = raw.scenarios && typeof raw.scenarios === 'object' ? raw.scenarios : {};
  const normalizedScenarios = {};

  for (const [scenarioName, scenarioConfig] of Object.entries(scenarios)) {
    normalizedScenarios[normalizeString(scenarioName)] = {
      ...scenarioConfig,
      tone: normalizeString(scenarioConfig?.tone, raw.tone || ''),
      style: normalizeString(scenarioConfig?.style, raw.style || ''),
      traits: normalizeArray(scenarioConfig?.traits ?? raw.traits),
      responseLength: normalizeString(scenarioConfig?.responseLength, raw.responseLength || 'medium'),
      emojiPreference: normalizeString(scenarioConfig?.emojiPreference, raw.emojiPreference || 'auto'),
      guidance: normalizeArray(scenarioConfig?.guidance ?? raw.guidance),
      mergeStrategy: normalizeString(scenarioConfig?.mergeStrategy, raw.mergeStrategy || 'append'),
      promptTemplate: normalizeString(scenarioConfig?.promptTemplate, raw.promptTemplate || ''),
    };
  }

  return {
    id,
    name: normalizeString(raw.name || fallbackId || id),
    tone: normalizeString(raw.tone, '自然'),
    style: normalizeString(raw.style, '清晰'),
    traits: normalizeArray(raw.traits),
    responseLength: normalizeString(raw.responseLength, 'medium'),
    emojiPreference: normalizeString(raw.emojiPreference, 'auto'),
    guidance: normalizeArray(raw.guidance),
    mergeStrategy: normalizeString(raw.mergeStrategy, 'append'),
    promptTemplate: normalizeString(raw.promptTemplate),
    scenarios: normalizedScenarios,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
  };
}

function normalizeRegistry(raw = {}) {
  const personalities = {};
  for (const [id, value] of Object.entries(raw.personalities || {})) {
    personalities[id] = normalizePersonality(value, id);
  }
  return {
    version: normalizeString(raw.version, '1.0.0'),
    defaults: {
      mergeStrategy: normalizeString(raw.defaults?.mergeStrategy, 'append'),
      fallbackPersonality: normalizeString(raw.defaults?.fallbackPersonality),
      watch: raw.defaults?.watch !== false,
    },
    personalities,
  };
}

export function loadPersonalityRegistry(registryPath = DEFAULT_PERSONALITIES_PATH) {
  const abs = path.resolve(registryPath);
  if (!fs.existsSync(abs)) {
    cachedRegistry = normalizeRegistry({});
    cachedRegistryPath = abs;
    cachedRegistryMtime = 0;
    return cachedRegistry;
  }

  const stat = fs.statSync(abs);
  const mtime = stat.mtimeMs || 0;
  if (cachedRegistry && cachedRegistryPath === abs && cachedRegistryMtime === mtime) {
    return cachedRegistry;
  }

  const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  cachedRegistry = normalizeRegistry(parsed);
  cachedRegistryPath = abs;
  cachedRegistryMtime = mtime;
  return cachedRegistry;
}

export function reloadPersonalityRegistry(registryPath = DEFAULT_PERSONALITIES_PATH) {
  cachedRegistry = null;
  cachedRegistryPath = '';
  cachedRegistryMtime = 0;
  return loadPersonalityRegistry(registryPath);
}

export function getPersonalityTemplate(personalityId = '', { registryPath } = {}) {
  const registry = loadPersonalityRegistry(registryPath || DEFAULT_PERSONALITIES_PATH);
  const key = normalizeString(personalityId).toLowerCase();
  if (key && registry.personalities[key]) return registry.personalities[key];
  const fallback = normalizeString(registry.defaults?.fallbackPersonality).toLowerCase();
  return (fallback && registry.personalities[fallback]) || null;
}

export function resolveAgentPersonality(roleConfig = {}, options = {}) {
  const registry = loadPersonalityRegistry(options.registryPath || DEFAULT_PERSONALITIES_PATH);
  const personalityConfig = roleConfig?.personality || {};
  const availableIds = normalizeArray(personalityConfig.templates);
  const scenario = normalizeString(options.scenario || personalityConfig.activeScenario || 'default');
  const explicitActive = normalizeString(options.personalityId || personalityConfig.active || roleConfig?.activePersonality);
  const fallbackId = normalizeString(personalityConfig.default || availableIds[0] || registry.defaults?.fallbackPersonality);
  const resolvedId = normalizeString(explicitActive || fallbackId).toLowerCase();

  const base = (resolvedId && registry.personalities[resolvedId])
    || (fallbackId && registry.personalities[normalizeString(fallbackId).toLowerCase()])
    || null;

  if (!base) {
    return {
      personality: null,
      personalityId: '',
      scenario,
      availablePersonalities: availableIds,
      source: 'missing',
    };
  }

  const scenarioOverride = base.scenarios?.[scenario] || null;
  const merged = scenarioOverride ? {
    ...base,
    ...scenarioOverride,
    scenarios: base.scenarios,
  } : base;

  return {
    personality: merged,
    personalityId: merged.id,
    scenario,
    availablePersonalities: availableIds.length ? availableIds : [merged.id],
    source: scenarioOverride ? 'scenario_override' : 'base',
  };
}

export function switchAgentPersonality(roleConfig = {}, nextPersonalityId = '', options = {}) {
  const normalizedNext = normalizeString(nextPersonalityId).toLowerCase();
  const current = roleConfig?.personality && typeof roleConfig.personality === 'object'
    ? roleConfig.personality
    : {};
  return {
    ...roleConfig,
    personality: {
      ...current,
      active: normalizedNext,
      activeScenario: normalizeString(options.scenario, current.activeScenario || 'default'),
      templates: Array.from(new Set([
        ...normalizeArray(current.templates),
        ...(normalizedNext ? [normalizedNext] : []),
      ])),
    },
  };
}

export function buildAgentSystemPrompt({
  agentName = '',
  role = '',
  rolePrompt = '',
  roleConfig = {},
  personalityId = '',
  scenario = '',
  registryPath,
} = {}) {
  const resolved = resolveAgentPersonality(roleConfig, { personalityId, scenario, registryPath });
  const injectedPrompt = injectPersonalityIntoSystemPrompt({
    systemPrompt: rolePrompt,
    personality: resolved.personality,
    context: {
      agentName: agentName || roleConfig?.displayName || role,
      role,
      personalityId: resolved.personalityId,
      scenario: resolved.scenario,
    },
    strategy: resolved.personality?.mergeStrategy || loadPersonalityRegistry(registryPath || DEFAULT_PERSONALITIES_PATH).defaults.mergeStrategy,
  });

  return {
    systemPrompt: injectedPrompt,
    personality: resolved.personality,
    personalityId: resolved.personalityId,
    scenario: resolved.scenario,
    promptSection: resolved.personality
      ? buildPersonalityPromptSection(resolved.personality, {
        agentName: agentName || roleConfig?.displayName || role,
        role,
        personalityId: resolved.personalityId,
        scenario: resolved.scenario,
      })
      : '',
    metadata: buildPromptInjectionMetadata({
      personality: resolved.personality,
      context: {
        agentName: agentName || roleConfig?.displayName || role,
        role,
        personalityId: resolved.personalityId,
        scenario: resolved.scenario,
      },
    }),
    availablePersonalities: resolved.availablePersonalities,
  };
}

export { DEFAULT_PERSONALITIES_PATH };

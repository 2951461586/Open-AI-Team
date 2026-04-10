import fs from 'node:fs';

export const CONFIG_VERSION = '1.0';
export const CONFIG_KIND = 'ai-team-config';

export function createDefaultConfig() {
  return {
    version: CONFIG_VERSION,
    kind: CONFIG_KIND,
    server: {
      port: 3001,
      bind: '0.0.0.0',
      corsOrigins: [],
      requestTimeoutMs: 60000,
      maxRequestSizeMb: 10,
    },
    models: [],
    sandbox: {
      mode: 'local',
      workspaceRoot: './workspace',
      maxConcurrent: 10,
      timeoutMs: 300000,
    },
    memory: {
      enabled: true,
      maxEntries: 1000,
      retentionDays: 30,
      persistPath: './state/memory.json',
    },
    observability: {
      langsmith: { enabled: false },
      langfuse: { enabled: false },
    },
    channels: {},
    mcp: { enabled: false, servers: [] },
    logging: {
      level: 'info',
      format: 'text',
      output: 'stdout',
    },
  };
}

export async function loadConfig(configPath = './config.json') {
  try {
    await fs.access(configPath);
  } catch {
    return createDefaultConfig();
  }

  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to load config: ${error.message}`);
    return createDefaultConfig();
  }
}

export function mergeConfig(base = {}, override = {}) {
  const merged = JSON.parse(JSON.stringify(base));

  for (const key of Object.keys(override || {})) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]))
    {
      merged[key] = mergeConfig(merged[key] || {}, override[key]);
    } else {
      merged[key] = override[key];
    }
  }

  return merged;
}

export function validateConfig(config = {}) {
  const errors = [];

  if (!config) {
    errors.push('config is required');
    return { ok: false, errors };
  }

  if (config.version !== CONFIG_VERSION) {
    errors.push(`version must be "${CONFIG_VERSION}"`);
  }

  if (config.kind !== CONFIG_KIND) {
    errors.push(`kind must be "${CONFIG_KIND}"`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function createConfigManager({ configPath = './config.json', defaults = {} } = {}) {
  let currentConfig = createDefaultConfig();
  let cfgPath = configPath;

  async function load() {
    currentConfig = await loadConfig(cfgPath);
    currentConfig = mergeConfig(currentConfig, defaults);
    return currentConfig;
  }

  function get(key = '') {
    if (!key) return currentConfig;
    const keys = key.split('.');
    let value = currentConfig;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  }

  function set(key = '', value = null) {
    if (!key) return false;
    const keys = key.split('.');
    let target = currentConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!target[k]) {
        target[k] = {};
      }
      target = target[k];
    }
    target[keys[keys.length - 1]] = value;
    return true;
  }

  async function save(outputPath = '') {
    const savePath = outputPath || cfgPath;
    try {
      const content = JSON.stringify(currentConfig, null, 2);
      await fs.writeFile(savePath, content, 'utf8');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return {
    load,
    get,
    set,
    save,
    getConfig: () => currentConfig,
  };
}

export default {
  CONFIG_VERSION,
  CONFIG_KIND,
  createDefaultConfig,
  loadConfig,
  mergeConfig,
  validateConfig,
  createConfigManager,
};

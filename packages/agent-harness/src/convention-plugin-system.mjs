export const PLUGIN_KINDS = ['tool', 'skill', 'route', 'event_hook', 'agent_template', 'channel_adapter'];
export const PLUGIN_PERMISSION_LEVELS = ['restricted', 'full_access'];

export const CONVENTION_BASED_PLUGINS = Object.freeze({
  TOOLS_DIR: 'plugins',
  SKILLS_DIR: 'plugins',
  ROUTES_DIR: 'plugins',
  MANIFEST_FILE: 'manifest.json',
  INDEX_FILE: 'index.js',
  HOOKS_DIR: 'hooks',
});

export function createPluginManifest({
  id = 'my-plugin',
  name = 'My Plugin',
  version = '1.0.0',
  description = '',
  author = '',
  kind = 'generic',
  main = 'index.js',
  permissions = 'restricted',
  contributes = {},
  hooks = [],
} = {}) {
  return {
    id: String(id).trim(),
    name: String(name).trim(),
    version: String(version).trim(),
    description: String(description).trim(),
    author: String(author).trim(),
    kind: String(kind).trim(),
    main: String(main || 'index.js').trim(),
    permissions: PLUGIN_PERMISSION_LEVELS.includes(permissions) ? permissions : 'restricted',
    contributes: normalizeContributes(contributes),
    hooks: Array.isArray(hooks) ? hooks.map(String) : [],
    conventionVersion: '1.0',
  };
}

function normalizeContributes(contributes = {}) {
  return {
    tools: Array.isArray(contributes.tools) ? contributes.tools : [],
    skills: Array.isArray(contributes.skills) ? contributes.skills : [],
    routes: Array.isArray(contributes.routes) ? contributes.routes : [],
    commands: Array.isArray(contributes.commands) ? contributes.commands : [],
    agentTemplates: Array.isArray(contributes.agentTemplates) ? contributes.agentTemplates : [],
    channelAdapters: Array.isArray(contributes.channelAdapters) ? contributes.channelAdapters : [],
    ...contributes,
  };
}

export function validatePluginManifest(manifest = {}) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be a non-null object'] };
  }

  const id = String(manifest.id || '').trim();
  if (!id) errors.push('manifest.id is required');
  if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) {
    errors.push('manifest.id must contain only alphanumeric characters, hyphens, and underscores');
  }

  const version = String(manifest.version || '').trim();
  if (!version) errors.push('manifest.version is required');
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push('manifest.version must be in semver format');
  }

  const main = String(manifest.main || 'index.js').trim();
  if (!main) errors.push('manifest.main is required');

  return { ok: errors.length === 0, errors };
}

export class ConventionPluginLoader {
  constructor({ pluginsRoot = './plugins', eventBus = null } = {}) {
    this.pluginsRoot = String(pluginsRoot);
    this.eventBus = eventBus;
    this.plugins = new Map();
    this.loadedModules = new Map();
  }

  async discover() {
    const { readdir, stat, access } = await import('node:fs/promises');
    const plugins = [];
    const root = this.pluginsRoot;

    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pluginPath = `${root}/${entry.name}`;
        const manifestPath = `${pluginPath}/${CONVENTION_BASED_PLUGINS.MANIFEST_FILE}`;

        try {
          await access(manifestPath);
          plugins.push({ id: entry.name, path: pluginPath, manifestPath });
        } catch {
          continue;
        }
      }
    } catch (error) {
      return { ok: false, error: error.message, plugins: [] };
    }

    return { ok: true, plugins };
  }

  async loadPlugin(pluginPath = '', options = {}) {
    const { readFile, access } = await import('node:fs/promises');
    const manifestPath = `${pluginPath}/${CONVENTION_BASED_PLUGINS.MANIFEST_FILE}`;

    try {
      await access(manifestPath);
    } catch {
      return { ok: false, error: 'manifest not found', plugin: null };
    }

    let manifest;
    try {
      const raw = await readFile(manifestPath, 'utf8');
      manifest = JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: `manifest parse error: ${error.message}`, plugin: null };
    }

    const validation = validatePluginManifest(manifest);
    if (!validation.ok) {
      return { ok: false, error: validation.errors.join(', '), plugin: null };
    }

    const plugin = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      kind: manifest.kind,
      path: pluginPath,
      manifest,
      permissions: manifest.permissions || 'restricted',
      contributes: normalizeContributes(manifest.contributes || {}),
      hooks: manifest.hooks || [],
      enabled: options.enabled !== false,
    };

    this.plugins.set(plugin.id, plugin);
    return { ok: true, plugin };
  }

  async loadAll(options = {}) {
    const { ok, plugins: discovered, error } = await this.discover();
    if (!ok) {
      return { ok: false, error, loaded: [], failed: [] };
    }

    const loaded = [];
    const failed = [];

    for (const { id, path } of discovered) {
      const result = await this.loadPlugin(path, options);
      if (result.ok) {
        loaded.push(result.plugin);
      } else {
        failed.push({ id, error: result.error });
      }
    }

    return { ok: true, loaded, failed };
  }

  getPlugin(id = '') {
    return this.plugins.get(String(id) || null) || null;
  }

  listPlugins(filterByKind = '') {
    const kind = String(filterByKind || '').trim();
    if (!kind) return [...this.plugins.values()];
    return [...this.plugins.values()].filter((p) => p.kind === kind);
  }

  async enablePlugin(id = '') {
    const plugin = this.plugins.get(String(id));
    if (!plugin) return { ok: false, error: 'plugin not found' };
    plugin.enabled = true;
    return { ok: true, plugin };
  }

  async disablePlugin(id = '') {
    const plugin = this.plugins.get(String(id));
    if (!plugin) return { ok: false, error: 'plugin not found' };
    plugin.enabled = false;
    return { ok: true, plugin };
  }

  async unloadPlugin(id = '') {
    const plugin = this.plugins.get(String(id));
    if (!plugin) return { ok: false, error: 'plugin not found' };
    this.plugins.delete(String(id));
    this.loadedModules.delete(String(id));
    return { ok: true };
  }

  getAllContributes() {
    const contributes = {
      tools: [],
      skills: [],
      routes: [],
      commands: [],
      agentTemplates: [],
      channelAdapters: [],
    };

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;
      contributes.tools.push(...plugin.contributes.tools.map((t) => ({ ...t, sourcePlugin: plugin.id })));
      contributes.skills.push(...plugin.contributes.skills.map((s) => ({ ...s, sourcePlugin: plugin.id })));
      contributes.routes.push(...plugin.contributes.routes.map((r) => ({ ...r, sourcePlugin: plugin.id })));
      contributes.commands.push(...plugin.contributes.commands.map((c) => ({ ...c, sourcePlugin: plugin.id })));
      contributes.agentTemplates.push(...(plugin.contributes.agentTemplates || []).map((t) => ({ ...t, sourcePlugin: plugin.id })));
      contributes.channelAdapters.push(...(plugin.contributes.channelAdapters || []).map((c) => ({ ...c, sourcePlugin: plugin.id })));
    }

    return contributes;
  }

  async runHook(hookName = '', payload = {}) {
    const results = [];
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;
      if (!plugin.hooks.includes(hookName)) continue;
      results.push({
        pluginId: plugin.id,
        hookName,
        payload,
        executed: true,
      });
    }
    return results;
  }
}

export function createConventionPluginSystem(options = {}) {
  const loader = new ConventionPluginLoader(options);

  return {
    loader,
    async discover() {
      return loader.discover();
    },
    async loadAll(options = {}) {
      return loader.loadAll(options);
    },
    getPlugin(id) {
      return loader.getPlugin(id);
    },
    listPlugins(kind) {
      return loader.listPlugins(kind);
    },
    enablePlugin(id) {
      return loader.enablePlugin(id);
    },
    disablePlugin(id) {
      return loader.disablePlugin(id);
    },
    unloadPlugin(id) {
      return loader.unloadPlugin(id);
    },
    getAllContributes() {
      return loader.getAllContributes();
    },
    runHook(hookName, payload) {
      return loader.runHook(hookName, payload);
    },
  };
}

export default {
  PLUGIN_KINDS,
  PLUGIN_PERMISSION_LEVELS,
  CONVENTION_BASED_PLUGINS,
  createPluginManifest,
  validatePluginManifest,
  ConventionPluginLoader,
  createConventionPluginSystem,
};

import fs from 'node:fs/promises';
import path from 'node:path';

export class SkillRuntime {
  constructor({ registry }) {
    this._registry = registry;
    this._loaded = new Map();
  }

  listLoaded(skillId) {
    const versions = this._loaded.get(skillId);
    return versions ? Array.from(versions.keys()) : [];
  }

  async register(manifest, { rootDir } = {}) {
    await this._registry.register(manifest, { rootDir });
    const { id, version } = manifest;
    const versionMap = this._loaded.get(id) || new Map();
    versionMap.set(version, {
      manifest,
      impl: null,
      implPath: rootDir ? path.join(rootDir, manifest.entry) : manifest.entry,
    });
    this._loaded.set(id, versionMap);
    const loaded = versionMap.get(version);
    if (loaded) {
      await this._loadImpl(loaded);
      await this._fireHook(loaded, 'onLoad', {
        manifest,
        reason: 'register',
      });
    }
    return this;
  }

  async hotReload(manifest, { rootDir } = {}) {
    const { id, version } = manifest;
    const loadedVersion = this._loaded.get(id)?.get(version);

    if (loadedVersion?._mod) {
      await this._fireHook(loadedVersion, 'onUnload', {
        manifest: loadedVersion.manifest,
        reason: 'hot-reload',
      });
    }

    await this._registry.register(manifest, { rootDir });

    const versionMap = this._loaded.get(id) || new Map();
    versionMap.set(version, {
      manifest,
      impl: null,
      implPath: rootDir ? path.join(rootDir, manifest.entry) : manifest.entry,
    });
    this._loaded.set(id, versionMap);

    const newLoaded = versionMap.get(version);
    if (newLoaded) {
      await this._loadImpl(newLoaded);
      await this._fireHook(newLoaded, 'onLoad', {
        manifest,
        reason: 'hot-reload',
      });
    }

    return this;
  }

  async _loadImpl(skill) {
    if (skill.impl) return skill.impl;
    if (!skill.implPath) return null;

    try {
      const mod = await import(skill.implPath);
      skill.impl = mod.default || mod.execute || mod;
      skill._mod = mod;
      return skill.impl;
    } catch (err) {
      console.error(`Failed to load skill impl: ${skill.implPath}`, err);
      return null;
    }
  }

  async _fireHook(skill, hookName, ctx) {
    if (!skill._mod) return;
    const hook = skill._mod[hookName];
    if (typeof hook === 'function') {
      try {
        await hook(ctx);
      } catch (err) {
        console.error(`Hook ${hookName} failed:`, err);
      }
    }
  }
}

export function createSkillRuntime(options) {
  return new SkillRuntime(options);
}

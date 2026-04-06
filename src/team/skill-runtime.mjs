import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareVersions } from '../../packages/skills/skill-protocol.mjs';

async function importLifecycle(modulePath = '') {
  const mod = await import(pathToFileURL(path.resolve(modulePath)).href);
  return {
    onLoad: typeof mod.onLoad === 'function' ? mod.onLoad : null,
    onUnload: typeof mod.onUnload === 'function' ? mod.onUnload : null,
  };
}

export class SkillRuntime {
  constructor({ registry = null } = {}) {
    this.registry = registry || null;
    this.loaded = new Map();
    if (this.registry?.setRuntime) this.registry.setRuntime(this);
  }

  _key(id = '', version = '') {
    return `${id}@${version}`;
  }

  async onRegister(manifest = {}) {
    const key = this._key(manifest.id, manifest.version);
    const existing = this.loaded.get(key);
    if (existing) {
      await existing.onUnload?.({ manifest, reason: 'hot-reload' });
    }
    const modulePath = manifest.rootDir ? path.resolve(manifest.rootDir, manifest.entry) : path.resolve(manifest.entry);
    const lifecycle = await importLifecycle(modulePath);
    this.loaded.set(key, { manifest, ...lifecycle });
    await lifecycle.onLoad?.({ manifest, reason: existing ? 'hot-reload' : 'register' });
    return manifest;
  }

  async onUnregister(manifest = {}) {
    const key = this._key(manifest.id, manifest.version);
    const existing = this.loaded.get(key);
    if (!existing) return false;
    await existing.onUnload?.({ manifest: existing.manifest, reason: 'unregister' });
    this.loaded.delete(key);
    return true;
  }

  getLoaded(id = '', version = '') {
    if (version) return this.loaded.get(this._key(id, version)) || null;
    const matches = [...this.loaded.values()].filter((item) => item.manifest?.id === id);
    matches.sort((left, right) => compareVersions(right.manifest?.version || '0.0.0', left.manifest?.version || '0.0.0'));
    return matches[0] || null;
  }

  listLoaded(id = '') {
    const items = [...this.loaded.values()].map((item) => item.manifest);
    if (!id) return items;
    return items.filter((item) => item.id === id).sort((left, right) => compareVersions(right.version, left.version));
  }

  async hotReload(manifest = {}, options = {}) {
    if (!this.registry) throw new Error('skill_runtime_registry_required');
    if (options.unregisterFirst) {
      await this.registry.unregister(manifest.id, manifest.version);
    }
    await this.registry.register(manifest, options);
    return this.getLoaded(manifest.id, manifest.version)?.manifest || null;
  }
}

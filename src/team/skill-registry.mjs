import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareVersions, createSkillRequest, createSkillResult, validateManifest } from '../../packages/skills/skill-protocol.mjs';

async function pathExists(target = '') {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byVersionDesc(left, right) {
  return compareVersions(right?.manifest?.version || right?.version || '0.0.0', left?.manifest?.version || left?.version || '0.0.0');
}

async function loadModule(modulePath = '') {
  const resolved = path.resolve(modulePath);
  return import(pathToFileURL(resolved).href);
}

export class SkillRegistry {
  constructor({ runtime = null } = {}) {
    this.runtime = runtime;
    this.skills = new Map();
  }

  setRuntime(runtime = null) {
    this.runtime = runtime;
    return this;
  }

  async register(manifest = {}, options = {}) {
    const validation = validateManifest(manifest);
    if (!validation.ok) {
      throw new Error(`skill_manifest_invalid:${validation.errors.join(',')}`);
    }
    const normalized = validation.manifest;
    const resolvedManifest = {
      ...normalized,
      rootDir: options.rootDir ? path.resolve(options.rootDir) : undefined,
      entry: normalized.entry,
    };
    const record = {
      id: normalized.id,
      version: normalized.version,
      manifest: resolvedManifest,
    };
    const versions = this.skills.get(normalized.id) || new Map();
    versions.set(normalized.version, record);
    this.skills.set(normalized.id, versions);
    await this.runtime?.onRegister?.(resolvedManifest);
    return clone(resolvedManifest);
  }

  async unregister(id = '', version = '') {
    const key = String(id || '').trim();
    if (!key || !this.skills.has(key)) return false;
    const versions = this.skills.get(key);
    if (version) {
      const existing = versions?.get(version)?.manifest || null;
      const deleted = versions?.delete(version) || false;
      if (deleted) await this.runtime?.onUnregister?.(existing);
      if (versions?.size === 0) this.skills.delete(key);
      return deleted;
    }
    for (const item of versions.values()) {
      await this.runtime?.onUnregister?.(item.manifest);
    }
    this.skills.delete(key);
    return true;
  }

  get(id = '', version = '') {
    const key = String(id || '').trim();
    const versions = this.skills.get(key);
    if (!versions || versions.size === 0) return null;
    if (version) return clone(versions.get(version)?.manifest || null);
    const latest = [...versions.values()].sort(byVersionDesc)[0];
    return latest ? clone(latest.manifest) : null;
  }

  list(filterByType = '', filterByTag = '') {
    const typeFilter = String(filterByType || '').trim();
    const tagFilter = String(filterByTag || '').trim();
    return [...this.skills.values()]
      .flatMap((versions) => [...versions.values()].map((item) => clone(item.manifest)))
      .filter((manifest) => {
        if (typeFilter && manifest.type !== typeFilter) return false;
        if (tagFilter && !manifest.tags.includes(tagFilter)) return false;
        return true;
      })
      .sort((left, right) => {
        if (left.id === right.id) return compareVersions(right.version, left.version);
        return left.id.localeCompare(right.id);
      });
  }

  async execute(id = '', payload = {}, context = {}) {
    const manifest = this.get(id, context?.version || '');
    if (!manifest) {
      return createSkillResult({ ok: false, error: 'skill_not_found', meta: { id, version: context?.version || null } });
    }
    const modulePath = manifest.rootDir ? path.resolve(manifest.rootDir, manifest.entry) : path.resolve(manifest.entry);
    const mod = await loadModule(modulePath);
    const executor = mod.execute || mod.default;
    if (typeof executor !== 'function') {
      return createSkillResult({ ok: false, error: 'skill_executor_missing', meta: { id: manifest.id, version: manifest.version } });
    }
    const request = createSkillRequest(payload, { ...context, manifest });
    const response = await executor(request);
    if (response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'ok')) {
      return response;
    }
    return createSkillResult({ ok: true, data: response, meta: { id: manifest.id, version: manifest.version } });
  }

  async fromDirectory(dir = '') {
    const root = path.resolve(dir);
    const entries = await fs.readdir(root, { withFileTypes: true });
    const loaded = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(root, entry.name, 'skill.manifest.json');
      if (!await pathExists(manifestPath)) continue;
      const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      loaded.push(await this.register(raw, { rootDir: path.join(root, entry.name) }));
    }
    return loaded;
  }
}

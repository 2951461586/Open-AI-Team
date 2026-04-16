import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const SKILL_TYPES = {
  SKILL: 'skill',
  COMPOUND: 'compound',
  META: 'meta',
};

export class SkillRegistry {
  constructor() {
    this._skills = new Map();
    this._versions = new Map();
  }

  async fromDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const loaded = [];
    const errors = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(dir, entry.name);
      const manifestPath = path.join(skillDir, 'skill.manifest.json');
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        await this.register(manifest, { rootDir: skillDir });
        loaded.push(manifest);
      } catch (err) {
        errors.push({ skill: entry.name, error: err.message });
      }
    }

    return { loaded, errors };
  }

  async fromBuiltins() {
    const builtinDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'builtins');
    return this.fromDirectory(builtinDir);
  }

  async register(manifest, { rootDir } = {}) {
    const { id, version, type = SKILL_TYPES.SKILL } = manifest;
    if (!id || !version) {
      throw new Error('Skill manifest must have id and version');
    }

    if (!this._skills.has(id)) {
      this._skills.set(id, new Map());
    }

    const versionMap = this._skills.get(id);
    const implPath = manifest.entry.startsWith('./')
      ? manifest.entry.slice(2)
      : manifest.entry;

    versionMap.set(version, {
      manifest,
      impl: null,
      implPath: rootDir ? path.join(rootDir, implPath) : implPath,
    });

    if (!this._versions.has(id)) {
      this._versions.set(id, version);
    } else {
      const current = this._versions.get(id);
      if (this._compareVersion(version, current) > 0) {
        this._versions.set(id, version);
      }
    }

    return this;
  }

  _compareVersion(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  list(type = null, version = null) {
    const results = [];
    for (const [id, versionMap] of this._skills) {
      if (version === 'latest') {
        const latestVersion = this._versions.get(id);
        if (latestVersion) {
          const skill = versionMap.get(latestVersion);
          if (skill && (!type || skill.manifest.type === type)) {
            results.push(skill.manifest);
          }
        }
      } else {
        for (const [v, skill] of versionMap) {
          if (type && skill.manifest.type !== type) continue;
          if (version && v !== version) continue;
          results.push(skill.manifest);
        }
      }
    }
    return results;
  }

  getManifest(id, version = 'latest') {
    const versionMap = this._skills.get(id);
    if (!versionMap) return null;

    if (version === 'latest') {
      version = this._versions.get(id);
    }

    return versionMap.get(version)?.manifest || null;
  }

  async _loadImpl(skill) {
    if (skill.impl) return skill.impl;
    if (!skill.implPath) return null;

    try {
      const mod = await import(skill.implPath);
      skill.impl = mod.default || mod.execute || mod;
      return skill.impl;
    } catch (err) {
      console.error(`Failed to load skill impl: ${skill.implPath}`, err);
      return null;
    }
  }

  async execute(skillId, request, options = {}) {
    const versionMap = this._skills.get(skillId);
    if (!versionMap) {
      return { ok: false, error: `Skill not found: ${skillId}` };
    }

    const version = options.version || this._versions.get(skillId);
    const skill = versionMap.get(version);
    if (!skill) {
      return { ok: false, error: `Skill version not found: ${skillId}@${version}` };
    }

    const impl = await this._loadImpl(skill);
    if (!impl) {
      return { ok: false, error: `Skill implementation not loadable: ${skillId}@${version}` };
    }

    try {
      const result = await impl(request, { manifest: skill.manifest, ...options });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export function createSkillRegistry(options) {
  return new SkillRegistry(options);
}

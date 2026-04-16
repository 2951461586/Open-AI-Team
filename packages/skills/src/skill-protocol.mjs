export const SKILL_PROTOCOL_VERSION = '1.0.0';

export const SKILL_TYPES = {
  SKILL: 'skill',
  COMPOUND: 'compound',
  META: 'meta',
};

export const CAPABILITY_TYPES = {
  READ: 'read',
  WRITE: 'write',
  EXECUTE: 'execute',
  STREAM: 'stream',
};

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest.id) errors.push('Missing required field: id');
  if (!manifest.name) errors.push('Missing required field: name');
  if (!manifest.version) errors.push('Missing required field: version');
  if (!manifest.type) errors.push('Missing required field: type');
  if (!manifest.entry) errors.push('Missing required field: entry');
  if (manifest.type && !Object.values(SKILL_TYPES).includes(manifest.type)) {
    errors.push(`Invalid type: ${manifest.type}`);
  }
  return { valid: errors.length === 0, errors };
}

export function createSkillManifest({ id, name, version, description, entry, capabilities = [], tags = [], dependencies = [], type = SKILL_TYPES.SKILL }) {
  return {
    id,
    name,
    version,
    type,
    description: description || name,
    entry,
    capabilities,
    tags,
    dependencies,
    protocol: SKILL_PROTOCOL_VERSION,
  };
}

export const DEFAULT_NODE_ID = 'node-a';
export const OBSERVER_NODE_ID = 'node-b';
export const REVIEW_NODE_ID = 'node-c';
export const CANONICAL_NODE_IDS = [DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID];

const ALIAS_TO_CANONICAL = {
  'node-a': 'node-a',
  laoda: 'node-a',
  authority: 'node-a',
  local: 'node-a',
  'node-b': 'node-b',
  violet: 'node-b',
  observer: 'node-b',
  'node-c': 'node-c',
  lebang: 'node-c',
  reviewer: 'node-c',
  critic: 'node-c',
};

const CANONICAL_TO_ALIASES = {
  'node-a': ['node-a', 'laoda', 'authority'],
  'node-b': ['node-b', 'violet', 'observer'],
  'node-c': ['node-c', 'lebang', 'reviewer'],
};

const NODE_REACHABILITY_KEYS = {
  'node-a': ['nodeAReachable', 'laodaReachable', 'authorityReachable'],
  'node-b': ['nodeBReachable', 'violetReachable', 'observerReachable'],
  'node-c': ['nodeCReachable', 'lebangReachable', 'reviewerReachable'],
};

const NODE_ENV_PREFIXES = {
  'node-a': ['NODE_A', 'LAODA', 'AUTHORITY'],
  'node-b': ['NODE_B', 'VIOLET', 'OBSERVER'],
  'node-c': ['NODE_C', 'LEBANG', 'REVIEWER'],
};

function sanitizeNodeId(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

export function canonicalNodeId(value = '', fallback = DEFAULT_NODE_ID) {
  const raw = sanitizeNodeId(value);
  if (!raw) return fallback;
  if (ALIAS_TO_CANONICAL[raw]) return ALIAS_TO_CANONICAL[raw];
  if (/^node-[a-z0-9_-]+$/.test(raw)) return raw;
  return fallback;
}

export function nodeAliases(value = '') {
  const canonical = canonicalNodeId(value);
  return [...new Set([canonical, ...(CANONICAL_TO_ALIASES[canonical] || [])])];
}

export function resolveAliasedRecord(record = {}, nodeId = '') {
  if (!record || typeof record !== 'object') return null;
  for (const key of nodeAliases(nodeId)) {
    if (record[key] && typeof record[key] === 'object') return record[key];
  }
  return null;
}

export function withLegacyNodeAliases(record = {}) {
  const out = { ...(record || {}) };
  for (const canonical of Object.keys(CANONICAL_TO_ALIASES)) {
    const value = out[canonical];
    if (!value || typeof value !== 'object') continue;
    for (const alias of CANONICAL_TO_ALIASES[canonical]) {
      if (!out[alias]) out[alias] = value;
    }
  }
  return out;
}

export function normalizeNodeMap(nodeMap = {}) {
  const merged = {};
  for (const [rawKey, rawValue] of Object.entries(nodeMap || {})) {
    const canonical = canonicalNodeId(rawKey, rawKey);
    const previous = merged[canonical] || {};
    merged[canonical] = {
      ...previous,
      ...(rawValue && typeof rawValue === 'object' ? rawValue : {}),
      id: canonical,
      aliases: [...new Set([...(previous.aliases || []), ...nodeAliases(canonical), rawKey])],
    };
  }
  return merged;
}

export function resolveNodeReachable(opts = {}, nodeId = '') {
  const canonical = canonicalNodeId(nodeId);
  const keys = NODE_REACHABILITY_KEYS[canonical] || [];
  const values = keys.map((key) => opts?.[key]).filter((value) => typeof value === 'boolean');
  if (values.includes(true)) return true;
  if (values.includes(false)) return false;
  return true;
}

export function nodeEnvPrefixes(nodeId = '') {
  const canonical = canonicalNodeId(nodeId);
  return [...new Set([...(NODE_ENV_PREFIXES[canonical] || [])])];
}

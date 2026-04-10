export const DECAY_FUNCTIONS = {
  EXPONENTIAL: 'exponential',
  LINEAR: 'linear',
  LOGARITHMIC: 'logarithmic',
  STEP: 'step',
};

export const ACCESS_PATTERNS = {
  FREQUENCY: 'frequency',
  RECENCY: 'recency',
  IMPORTANCE: 'importance',
};

export function createMemoryDecay({
  initialValue = 1.0,
  decayFunction = DECAY_FUNCTIONS.EXPONENTIAL,
  decayRate = 0.1,
  halfLifeDays = 7,
  minValue = 0.01,
} = {}) {
  const state = {
    initialValue,
    decayFunction,
    decayRate,
    halfLifeDays,
    minValue,
  };

  function calculateDecay(createdAt, lastAccessedAt, accessCount = 0) {
    const now = Date.now();
    const ageMs = now - new Date(createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    let baseValue;

    switch (state.decayFunction) {
      case DECAY_FUNCTIONS.EXPONENTIAL:
        baseValue = state.initialValue * Math.pow(0.5, ageDays / state.halfLifeDays);
        break;

      case DECAY_FUNCTIONS.LINEAR:
        baseValue = state.initialValue - (ageDays / (state.halfLifeDays * 2));
        break;

      case DECAY_FUNCTIONS.LOGARITHMIC:
        baseValue = state.initialValue * (1 - Math.log1p(ageDays) / Math.log1p(state.halfLifeDays * 2));
        break;

      case DECAY_FUNCTIONS.STEP:
        const steps = Math.floor(ageDays / (state.halfLifeDays / 4));
        baseValue = state.initialValue * Math.pow(0.5, steps);
        break;

      default:
        baseValue = state.initialValue;
    }

    const frequencyBoost = Math.log1p(accessCount) * 0.05;
    const boostedValue = Math.min(state.initialValue, baseValue + frequencyBoost);

    return Math.max(state.minValue, boostedValue);
  }

  function getValue(memoryEntry = {}) {
    const { createdAt, lastAccessedAt, accessCount = 0 } = memoryEntry;
    return calculateDecay(createdAt || new Date().toISOString(), lastAccessedAt || new Date().toISOString(), accessCount);
  }

  return {
    getValue,
    calculateDecay,
    getConfig: () => ({ ...state }),
  };
}

export function createMemoryImportanceScorer({
  explicitImportance = 0.5,
  userRatingWeight = 0.3,
  accessCountWeight = 0.2,
  completenessWeight = 0.2,
} = {}) {
  function calculateImportance(memoryEntry = {}) {
    let score = explicitImportance;

    if (memoryEntry.userRating !== undefined) {
      score += memoryEntry.userRating * userRatingWeight;
    }

    if (memoryEntry.accessCount !== undefined) {
      const normalizedAccess = Math.min(memoryEntry.accessCount / 100, 1);
      score += normalizedAccess * accessCountWeight;
    }

    if (memoryEntry.completeness !== undefined) {
      score += memoryEntry.completeness * completenessWeight;
    }

    return Math.max(0, Math.min(1, score));
  }

  return {
    calculateImportance,
  };
}

export function createDecayingMemoryStore({
  decayConfig = {},
  scorerConfig = {},
  maxEntries = 1000,
  evictionThreshold = 0.1,
} = {}) {
  const entries = new Map();
  const decay = createMemoryDecay(decayConfig);
  const scorer = createMemoryImportanceScorer(scorerConfig);

  const state = {
    maxEntries,
    evictionThreshold,
    stats: {
      hits: 0,
      misses: 0,
      evictions: 0,
      decays: 0,
    },
  };

  function add(key, value, metadata = {}) {
    const now = new Date().toISOString();
    const entry = {
      key,
      value,
      metadata,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      importance: scorer.calculateImportance({ ...metadata, explicitImportance: metadata.importance || 0.5 }),
    };

    entries.set(key, entry);
    enforceMaxSize();

    return entry;
  }

  function get(key) {
    const entry = entries.get(key);

    if (!entry) {
      state.stats.misses++;
      return null;
    }

    entry.lastAccessedAt = new Date().toISOString();
    entry.accessCount++;
    entry.importance = scorer.calculateImportance(entry);

    state.stats.hits++;
    return entry;
  }

  function has(key) {
    return entries.has(key);
  }

  function remove(key) {
    return entries.delete(key);
  }

  function getValue(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    return {
      value: entry.value,
      metadata: entry.metadata,
      decayValue: decay.getValue(entry),
      importance: entry.importance,
    };
  }

  function getAll(options = {}) {
    const { sortBy = 'decay', limit = 100, minDecayValue = 0 } = options;

    let items = [...entries.values()];

    items = items.map((entry) => ({
      ...entry,
      decayValue: decay.getValue(entry),
    }));

    if (minDecayValue > 0) {
      items = items.filter((item) => item.decayValue >= minDecayValue);
    }

    if (sortBy === 'decay') {
      items.sort((a, b) => a.decayValue - b.decayValue);
    } else if (sortBy === 'importance') {
      items.sort((a, b) => b.importance - a.importance);
    } else if (sortBy === 'recency') {
      items.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
    } else if (sortBy === 'created') {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return items.slice(0, limit);
  }

  function enforceMaxSize() {
    while (entries.size > state.maxEntries) {
      const items = getAll({ sortBy: 'decay' });
      if (items.length > 0) {
        const toEvict = items[0];
        entries.delete(toEvict.key);
        state.stats.evictions++;
      }
    }
  }

  function prune(minValue = evictionThreshold) {
    const items = getAll({ minDecayValue: minValue });
    let pruned = 0;

    for (const item of items) {
      if (item.decayValue < minValue) {
        entries.delete(item.key);
        pruned++;
      }
    }

    state.stats.decays += pruned;
    return pruned;
  }

  function getStats() {
    return {
      ...state.stats,
      size: entries.size,
      maxEntries: state.maxEntries,
      evictionThreshold: state.evictionThreshold,
      hitRate: state.stats.hits / (state.stats.hits + state.stats.misses) || 0,
    };
  }

  function clear() {
    entries.clear();
  }

  function size() {
    return entries.size;
  }

  return {
    add,
    get,
    has,
    remove,
    getValue,
    getAll,
    prune,
    getStats,
    clear,
    size,
  };
}

export default {
  DECAY_FUNCTIONS,
  ACCESS_PATTERNS,
  createMemoryDecay,
  createMemoryImportanceScorer,
  createDecayingMemoryStore,
};

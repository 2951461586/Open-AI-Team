export const COMPRESSION_STRATEGIES = {
  NONE: 'none',
  TRUNCATE: 'truncate',
  SUMMARIZE: 'summarize',
  HIERARCHICAL: 'hierarchical',
};

export const MEMORY_TIERS = {
  L1_WORKING: 'L1_working',
  L2_SHARED: 'L2_shared',
  L3_DURABLE: 'L3_durable',
};

export function createContextCompressor({
  maxTokens = 100000,
  compressionStrategy = COMPRESSION_STRATEGIES.TRUNCATE,
  summarizeFn = null,
} = {}) {
  const state = {
    compressionCount: 0,
    totalTokensSaved: 0,
  };

  async function compressContext(context = '', options = {}) {
    const estimatedTokens = estimateTokens(context);
    const targetTokens = Math.min(
      maxTokens,
      options.maxTokens || maxTokens
    );

    if (estimatedTokens <= targetTokens) {
      return { ok: true, compressed: context, originalTokens: estimatedTokens, wasCompressed: false };
    }

    const strategy = options.strategy || compressionStrategy;
    let compressed;

    switch (strategy) {
      case COMPRESSION_STRATEGIES.SUMMARIZE:
        compressed = await summarizeContext(context, { ...options, targetTokens });
        break;
      case COMPRESSION_STRATEGIES.HIERARCHICAL:
        compressed = hierarchicalCompress(context, { ...options, targetTokens });
        break;
      case COMPRESSION_STRATEGIES.TRUNCATE:
      default:
        compressed = truncateContext(context, { ...options, targetTokens });
        break;
    }

    const newTokens = estimateTokens(compressed);
    state.compressionCount++;
    state.totalTokensSaved += estimatedTokens - newTokens;

    return {
      ok: true,
      compressed,
      originalTokens: estimatedTokens,
      compressedTokens: newTokens,
      wasCompressed: true,
      strategy,
    };
  }

  function truncateContext(context = '', options = {}) {
    const targetTokens = options.targetTokens || maxTokens;
    const targetChars = targetTokens * 4;
    const lines = String(context).split('\n');
    const result = [];
    let totalChars = 0;

    for (const line of lines) {
      if (totalChars + line.length > targetChars) {
        result.push(`... (${lines.length - result.length} more lines truncated)`);
        break;
      }
      result.push(line);
      totalChars += line.length + 1;
    }

    return result.join('\n');
  }

  async function summarizeContext(context = '', options = {}) {
    const targetTokens = options.targetTokens || maxTokens;

    if (typeof summarizeFn === 'function') {
      return await summarizeFn(context, { ...options, targetTokens });
    }

    const lines = String(context).split('\n');
    const summaryLines = [];
    let summaryChars = 0;
    const targetChars = targetTokens * 4;

    summaryLines.push('## 上下文摘要 (Compressed)');
    summaryLines.push(`原始行数: ${lines.length}`);
    summaryLines.push('');

    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('##')) {
        summaryLines.push(line);
        summaryChars += line.length + 1;
      } else if (summaryChars < targetChars * 0.3) {
        summaryLines.push(line);
        summaryChars += line.length + 1;
      }
    }

    if (summaryChars < targetChars && lines.length > summaryLines.length) {
      summaryLines.push('');
      summaryLines.push(`... (中间省略 ${lines.length - summaryLines.length} 行)`);
    }

    return summaryLines.join('\n');
  }

  function hierarchicalCompress(context = '', options = {}) {
    const lines = String(context).split('\n');
    const result = [];
    const sections = [];
    let currentSection = [];
    let currentSectionName = '';

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentSection.length > 0) {
          sections.push({ name: currentSectionName, lines: currentSection });
        }
        currentSectionName = line;
        currentSection = [line];
      } else {
        currentSection.push(line);
      }
    }
    if (currentSection.length > 0) {
      sections.push({ name: currentSectionName, lines: currentSection });
    }

    const targetChars = (options.targetTokens || maxTokens) * 4;
    let totalChars = 0;

    for (const section of sections) {
      if (totalChars + section.lines.join('\n').length > targetChars) {
        const ratio = (targetChars - totalChars) / section.lines.join('\n').length;
        const keepLines = Math.max(1, Math.floor(section.lines.length * ratio));
        result.push(...section.lines.slice(0, keepLines));
        result.push(`... (section "${section.name}" truncated)`);
        totalChars += section.lines.slice(0, keepLines).join('\n').length;
      } else {
        result.push(...section.lines);
        totalChars += section.lines.join('\n').length;
      }
      if (totalChars > targetChars) break;
    }

    return result.join('\n');
  }

  function estimateTokens(text = '') {
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    return Math.ceil(cleaned.length / 4);
  }

  return {
    compressContext,
    truncateContext,
    summarizeContext,
    hierarchicalCompress,
    estimateTokens,
    getStats() {
      return {
        compressionCount: state.compressionCount,
        totalTokensSaved: state.totalTokensSaved,
        maxTokens,
        compressionStrategy,
      };
    },
  };
}

export function createIntelligentMemoryManager({
  teamStore = null,
  memoryTiers = [MEMORY_TIERS.L1_WORKING, MEMORY_TIERS.L2_SHARED, MEMORY_TIERS.L3_DURABLE],
  retentionPolicy = {},
  compressor = null,
} = {}) {
  const state = {
    entries: {
      [MEMORY_TIERS.L1_WORKING]: [],
      [MEMORY_TIERS.L2_SHARED]: [],
      [MEMORY_TIERS.L3_DURABLE]: [],
    },
    accessCount: {},
    lastAccess: {},
    priority: {},
  };

  const defaultRetention = {
    [MEMORY_TIERS.L1_WORKING]: { maxEntries: 50, ttlMs: 30 * 60 * 1000 },
    [MEMORY_TIERS.L2_SHARED]: { maxEntries: 100, ttlMs: 2 * 60 * 60 * 1000 },
    [MEMORY_TIERS.L3_DURABLE]: { maxEntries: 500, ttlMs: 30 * 24 * 60 * 60 * 1000 },
    ...retentionPolicy,
  };

  function addEntry(tier = MEMORY_TIERS.L1_WORKING, entry = {}, priority = 1) {
    if (!memoryTiers.includes(tier)) return false;
    const id = String(entry.id || `${tier}-${Date.now()}`);
    const now = Date.now();
    const memoryEntry = {
      ...entry,
      id,
      tier,
      priority: Number(priority) || 1,
      createdAt: entry.createdAt || new Date().toISOString(),
      accessedAt: now,
      accessCount: 0,
    };

    state.entries[tier].push(memoryEntry);
    state.accessCount[id] = 0;
    state.lastAccess[id] = now;
    state.priority[id] = priority;

    enforceRetention(tier);
    return id;
  }

  function enforceRetention(tier) {
    const policy = defaultRetention[tier];
    if (!policy) return;

    const entries = state.entries[tier];
    if (entries.length <= policy.maxEntries) return;

    const now = Date.now();
    entries.sort((a, b) => {
      const aScore = calculateEntryScore(a, now);
      const bScore = calculateEntryScore(b, now);
      return bScore - aScore;
    });

    const toRemove = entries.slice(policy.maxEntries);
    for (const entry of toRemove) {
      const idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
    }
  }

  function calculateEntryScore(entry = {}, now = Date.now()) {
    const recency = 1 / (1 + (now - new Date(entry.accessedAt || entry.createdAt).getTime()) / 1000);
    const priority = Number(entry.priority) || 1;
    const accessCount = Math.log1p(state.accessCount[entry.id] || 0);
    return priority * recency * (1 + accessCount * 0.1);
  }

  function getEntry(tier = '', id = '') {
    const entries = state.entries[tier];
    if (!entries) return null;
    const entry = entries.find((e) => String(e.id) === String(id));
    if (entry) {
      entry.accessCount = (entry.accessCount || 0) + 1;
      state.accessCount[id] = (state.accessCount[id] || 0) + 1;
      state.lastAccess[id] = Date.now();
    }
    return entry || null;
  }

  function queryEntries(tier = '', query = {}, options = {}) {
    const entries = state.entries[tier] || [];
    const now = Date.now();

    let filtered = entries.filter((entry) => {
      if (query.minPriority && entry.priority < query.minPriority) return false;
      if (query.maxAge && (now - new Date(entry.createdAt).getTime()) > query.maxAge) return false;
      if (query.search) {
        const searchLower = String(query.search).toLowerCase();
        const text = String(entry.text || entry.content || entry.summary || '').toLowerCase();
        if (!text.includes(searchLower)) return false;
      }
      return true;
    });

    if (options.sortBy === 'priority') {
      filtered.sort((a, b) => calculateEntryScore(b, now) - calculateEntryScore(a, now));
    } else if (options.sortBy === 'recency') {
      filtered.sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());
    }

    const limit = options.limit || filtered.length;
    return filtered.slice(0, limit);
  }

  function evictStale(tier = MEMORY_TIERS.L1_WORKING) {
    const policy = defaultRetention[tier];
    if (!policy) return 0;

    const now = Date.now();
    const entries = state.entries[tier];
    const toEvict = [];

    for (const entry of entries) {
      const age = now - new Date(entry.accessedAt).getTime();
      if (age > policy.ttlMs) {
        toEvict.push(entry);
      }
    }

    for (const entry of toEvict) {
      const idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
    }

    return toEvict.length;
  }

  function getStats() {
    const now = Date.now();
    return Object.fromEntries(
      memoryTiers.map((tier) => [
        tier,
        {
          count: state.entries[tier]?.length || 0,
          retention: defaultRetention[tier],
          oldestEntry: state.entries[tier]?.length > 0
            ? new Date(Math.min(...state.entries[tier].map((e) => new Date(e.accessedAt).getTime()))).toISOString()
            : null,
          newestEntry: state.entries[tier]?.length > 0
            ? new Date(Math.max(...state.entries[tier].map((e) => new Date(e.accessedAt).getTime()))).toISOString()
            : null,
        },
      ])
    );
  }

  return {
    addEntry,
    getEntry,
    queryEntries,
    evictStale,
    getStats,
    enforceRetention,
  };
}

export default {
  COMPRESSION_STRATEGIES,
  MEMORY_TIERS,
  createContextCompressor,
  createIntelligentMemoryManager,
};

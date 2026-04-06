import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadMemorySettings, normalizeMemorySettings } from '../memory-settings.mjs';

function ensureDir(dir = '') {
  if (!dir) return;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeReadJson(filePath = '', fallback = null) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath = '', value = {}) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function nowMs() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenize(text = '', { minTokenLength = 2, maxTokensPerEntry = 64 } = {}) {
  return [...new Set(
    normalizeText(text)
      .toLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .map((x) => x.trim())
      .filter((x) => x.length >= minTokenLength)
  )].slice(0, maxTokensPerEntry);
}

function stableHash(text = '') {
  return crypto.createHash('sha256').update(String(text || '')).digest();
}

function buildEmbedding(text = '', dimensions = 256) {
  const out = new Array(dimensions).fill(0);
  const tokens = tokenize(text, { minTokenLength: 1, maxTokensPerEntry: Math.max(16, dimensions) });
  if (tokens.length === 0) return out;
  for (const token of tokens) {
    const hash = stableHash(token);
    for (let i = 0; i < hash.length; i += 1) {
      const bucket = (hash[i] + (i * 31)) % dimensions;
      out[bucket] += (i % 2 === 0 ? 1 : -1) * ((hash[i] / 255) + 0.25);
    }
  }
  const norm = Math.sqrt(out.reduce((sum, value) => sum + (value * value), 0)) || 1;
  return out.map((value) => Number((value / norm).toFixed(6)));
}

function cosineSimilarity(a = [], b = []) {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    const av = Number(a[i] || 0);
    const bv = Number(b[i] || 0);
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function jaccardSimilarity(a = [], b = []) {
  const as = new Set(a || []);
  const bs = new Set(b || []);
  if (as.size === 0 || bs.size === 0) return 0;
  let inter = 0;
  for (const token of as) if (bs.has(token)) inter += 1;
  const union = new Set([...as, ...bs]).size || 1;
  return inter / union;
}

function scoreKeywordOverlap(entryTokens = [], queryTokens = [], saturation = 6) {
  if (!entryTokens.length || !queryTokens.length) return 0;
  let matches = 0;
  const set = new Set(entryTokens);
  for (const token of queryTokens) if (set.has(token)) matches += 1;
  return clamp(matches / Math.max(1, saturation), 0, 1);
}

function sanitizeScope(scope = '') {
  return String(scope || 'team/runtime').replace(/[^a-zA-Z0-9/_-]+/g, '-').replace(/\/+/g, '/');
}

function createEntryId() {
  return `mem_${nowMs().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeEntry(input = {}, settings) {
  const createdAt = Number(input.createdAt || input.timestamp || nowMs());
  const updatedAt = Number(input.updatedAt || createdAt);
  const text = normalizeText(input.text || input.content || input.summary || '');
  const category = String(input.category || 'other');
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map((x) => String(x || '').trim()).filter(Boolean))] : [];
  const keywords = Array.isArray(input.keywords) && input.keywords.length > 0
    ? [...new Set(input.keywords.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean))]
    : tokenize(`${text} ${tags.join(' ')}`, settings.embedding);
  const embedding = Array.isArray(input.embedding) && input.embedding.length > 0
    ? input.embedding.map((x) => Number(x || 0))
    : buildEmbedding(`${text} ${keywords.join(' ')}`, settings.embedding.dimensions);
  return {
    id: String(input.id || createEntryId()),
    scope: sanitizeScope(input.scope || 'team/runtime'),
    agentId: String(input.agentId || input.role || input.owner || 'runtime'),
    text,
    category,
    tags,
    keywords,
    importance: clamp(Number(input.importance ?? 0.5), settings.decay.importanceFloor, settings.decay.importanceCeiling),
    createdAt,
    updatedAt,
    lastAccessedAt: Number(input.lastAccessedAt || updatedAt || createdAt),
    accessCount: Math.max(0, Number(input.accessCount || 0)),
    strength: clamp(Number(input.strength ?? input.importance ?? 0.5), settings.decay.minStrength, 1),
    archivedAt: input.archivedAt ? Number(input.archivedAt) : null,
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
    embedding,
    version: Number(input.version || 1),
  };
}

function entryView(entry = {}) {
  const { embedding, ...rest } = entry;
  return { ...rest };
}

export function createMemoryCore({ scope = 'team/runtime', baseDir = '', settings = null, clock = () => Date.now() } = {}) {
  const effectiveSettings = settings ? normalizeMemorySettings(settings) : loadMemorySettings({ defaults: baseDir ? { persistence: { baseDir } } : {} });
  const resolvedScope = sanitizeScope(scope);
  const rootDir = path.join(effectiveSettings.persistence.baseDir, resolvedScope);
  const archiveDir = path.join(rootDir, effectiveSettings.persistence.archiveDirName);
  const activeFilePath = path.join(rootDir, effectiveSettings.persistence.activeFileName);
  const statsFilePath = path.join(rootDir, effectiveSettings.persistence.statsFileName);

  function loadState() {
    ensureDir(rootDir);
    ensureDir(archiveDir);
    const entries = safeReadJson(activeFilePath, []);
    return Array.isArray(entries) ? entries.map((item) => normalizeEntry(item, effectiveSettings)) : [];
  }

  function persist(entries = [], stats = null) {
    ensureDir(rootDir);
    writeJson(activeFilePath, entries);
    if (stats) writeJson(statsFilePath, stats);
  }

  function archiveEntries(entries = []) {
    if (!entries.length) return [];
    ensureDir(archiveDir);
    const archivePath = path.join(archiveDir, `archive-${clock()}.json`);
    writeJson(archivePath, entries.map(entryView));
    return entries.map((item) => ({ ...item, archivedAt: clock() }));
  }

  function decayFactor(entry = {}, atMs = clock()) {
    if (!effectiveSettings.decay.enabled) return 1;
    const ageDays = Math.max(0, (atMs - Number(entry.updatedAt || entry.createdAt || atMs)) / 86400000);
    const halfLife = Math.max(1, Number(effectiveSettings.decay.halfLifeDays || 21));
    return Math.pow(0.5, ageDays / halfLife);
  }

  function recencyBoost(entry = {}, atMs = clock()) {
    const ageDays = Math.max(0, (atMs - Number(entry.createdAt || atMs)) / 86400000);
    const recentWindow = Number(effectiveSettings.retrieval.nearEventWindowDays || 30);
    if (ageDays > recentWindow) return 1;
    const freshness = 1 - (ageDays / recentWindow);
    return 1 + ((Number(effectiveSettings.retrieval.nearEventBoost || 1.35) - 1) * freshness);
  }

  function scoreRecency(entry = {}, atMs = clock()) {
    const ageDays = Math.max(0, (atMs - Number(entry.lastAccessedAt || entry.updatedAt || entry.createdAt || atMs)) / 86400000);
    const windowDays = Math.max(1, Number(effectiveSettings.windows.defaultDays || 180));
    return clamp(1 - (ageDays / windowDays), 0, 1);
  }

  function evaluateStrength(entry = {}, atMs = clock()) {
    const baseStrength = clamp(Number(entry.strength ?? entry.importance ?? 0.5), effectiveSettings.decay.minStrength, 1);
    const decayed = clamp(baseStrength * decayFactor(entry, atMs), 0, 1);
    return clamp(decayed * recencyBoost(entry, atMs), 0, 1);
  }

  function sweep({ now = clock() } = {}) {
    const entries = loadState();
    const keep = [];
    const archive = [];
    const forget = [];
    for (const raw of entries) {
      const strength = evaluateStrength(raw, now);
      const next = { ...raw, strength };
      if (strength <= effectiveSettings.decay.forgetThreshold) {
        forget.push(next);
      } else if (strength <= effectiveSettings.decay.archiveThreshold) {
        archive.push(next);
      } else {
        keep.push(next);
      }
    }
    if (archive.length) archiveEntries(archive);
    const stats = {
      scope: resolvedScope,
      updatedAt: now,
      activeCount: keep.length,
      archivedCount: archive.length,
      forgottenCount: forget.length,
    };
    persist(keep.map(entryView), stats);
    return { stats, active: keep.map(entryView), archived: archive.map(entryView), forgotten: forget.map(entryView) };
  }

  function write(entry = {}) {
    const entries = loadState();
    const normalized = normalizeEntry({ ...entry, scope: resolvedScope }, effectiveSettings);
    entries.push(normalized);
    persist(entries.map(entryView), { scope: resolvedScope, updatedAt: clock(), activeCount: entries.length });
    return entryView(normalized);
  }

  function recall(query = '', opts = {}) {
    const now = Number(opts.now || clock());
    const limit = clamp(Number(opts.limit || effectiveSettings.retrieval.defaultLimit), 1, effectiveSettings.retrieval.maxLimit);
    const minScore = Number(opts.minScore ?? effectiveSettings.retrieval.minScore);
    const categoryFilter = opts.category ? new Set((Array.isArray(opts.category) ? opts.category : [opts.category]).map((x) => String(x || ''))) : null;
    const queryText = normalizeText(typeof query === 'string' ? query : (query?.text || ''));
    const queryTokens = tokenize(queryText, effectiveSettings.embedding);
    const queryEmbedding = buildEmbedding(queryText, effectiveSettings.embedding.dimensions);
    const rows = loadState().map((entry) => {
      const keywordScore = scoreKeywordOverlap(entry.keywords || [], queryTokens, effectiveSettings.retrieval.keywordSaturation);
      const vectorScore = Math.max(0, cosineSimilarity(entry.embedding || [], queryEmbedding));
      const tagScore = jaccardSimilarity(entry.tags || [], queryTokens);
      const recencyScore = scoreRecency(entry, now);
      const strengthScore = evaluateStrength(entry, now);
      const combined = (
        (keywordScore * Number(effectiveSettings.retrieval.keywordWeight || 0.45)) +
        ((vectorScore + tagScore) / 2 * Number(effectiveSettings.retrieval.vectorWeight || 0.35)) +
        (recencyScore * Number(effectiveSettings.retrieval.recencyWeight || 0.20))
      ) * (0.7 + (0.3 * strengthScore));
      return {
        entry,
        score: Number(combined.toFixed(6)),
        signals: {
          keywordScore: Number(keywordScore.toFixed(6)),
          vectorScore: Number(vectorScore.toFixed(6)),
          tagScore: Number(tagScore.toFixed(6)),
          recencyScore: Number(recencyScore.toFixed(6)),
          strengthScore: Number(strengthScore.toFixed(6)),
        },
      };
    }).filter(({ entry, score }) => {
      if (categoryFilter && !categoryFilter.has(String(entry.category || ''))) return false;
      if (opts.since && Number(entry.createdAt || 0) < Number(opts.since)) return false;
      if (opts.until && Number(entry.createdAt || 0) > Number(opts.until)) return false;
      return score >= minScore;
    });

    rows.sort((a, b) => b.score - a.score || Number(b.entry.createdAt || 0) - Number(a.entry.createdAt || 0));
    const hits = rows.slice(0, limit).map(({ entry, score, signals }) => ({
      ...entryView({ ...entry, lastAccessedAt: now, accessCount: Number(entry.accessCount || 0) + 1 }),
      score,
      signals,
    }));

    if (hits.length) {
      const byId = new Map(hits.map((item) => [item.id, item]));
      const all = loadState().map((entry) => byId.get(entry.id) ? normalizeEntry(byId.get(entry.id), effectiveSettings) : entry);
      persist(all.map(entryView), { scope: resolvedScope, updatedAt: now, activeCount: all.length, lastQuery: queryText });
    }
    return { scope: resolvedScope, query: queryText, hits };
  }

  function list({ includeArchived = false } = {}) {
    const active = loadState().map(entryView);
    if (!includeArchived) return active;
    const archivedFiles = fs.existsSync(archiveDir)
      ? fs.readdirSync(archiveDir).filter((name) => name.endsWith('.json')).sort()
      : [];
    const archived = archivedFiles.flatMap((name) => safeReadJson(path.join(archiveDir, name), []) || []);
    return [...active, ...archived];
  }

  return {
    kind: 'team_memory_core',
    scope: resolvedScope,
    settings: effectiveSettings,
    paths: { rootDir, archiveDir, activeFilePath, statsFilePath },
    write,
    recall,
    sweep,
    list,
    getStats() {
      return safeReadJson(statsFilePath, { scope: resolvedScope, updatedAt: 0, activeCount: loadState().length });
    },
  };
}

export {
  buildEmbedding,
  cosineSimilarity,
  normalizeEntry,
  sanitizeScope,
  tokenize,
};

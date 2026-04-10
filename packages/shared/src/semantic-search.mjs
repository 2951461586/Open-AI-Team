export const SEARCH_MODES = {
  KEYWORD: 'keyword',
  FUZZY: 'fuzzy',
  SEMANTIC: 'semantic',
  HYBRID: 'hybrid',
};

export const SEARCH_SCORING = {
  TFIDF: 'tfidf',
  BM25: 'bm25',
  BOOLEAN: 'boolean',
};

export function createTextVectorizer() {
  const vocabulary = new Map();
  const idfCache = new Map();
  let docCount = 0;

  function tokenize(text = '') {
    return String(text)
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  function buildVocabulary(documents = []) {
    const freq = new Map();
    docCount = documents.length;

    for (const doc of documents) {
      const text = typeof doc === 'string' ? doc : String(doc.text || doc.content || '');
      const tokens = new Set(tokenize(text));

      for (const token of tokens) {
        freq.set(token, (freq.get(token) || 0) + 1);
      }
    }

    vocabulary.clear();
    let idx = 0;
    for (const [token, df] of freq) {
      vocabulary.set(token, { df, idf: 0, index: idx++ });
    }

    for (const [token, data] of vocabulary) {
      const idf = Math.log(docCount / (data.df || 1)) + 1;
      vocabulary.set(token, { ...data, idf });
      idfCache.set(token, idf);
    }

    return vocabulary;
  }

  function vectorize(text = '') {
    const tokens = tokenize(text);
    const tf = new Map();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    const vector = new Array(vocabulary.size).fill(0);

    for (const [token, count] of tf) {
      const entry = vocabulary.get(token);
      if (entry) {
        const tfidf = (count / tokens.length) * entry.idf;
        vector[entry.index] = tfidf;
      }
    }

    return { vector, tokens: [...tf.keys()] };
  }

  function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  return {
    tokenize,
    buildVocabulary,
    vectorize,
    cosineSimilarity,
    getVocabularySize: () => vocabulary.size,
    getDocCount: () => docCount,
  };
}

export function createSemanticSearch({
  mode = SEARCH_MODES.KEYWORD,
  scoring = SEARCH_SCORING.TFIDF,
  topK = 10,
  minScore = 0.1,
} = {}) {
  const vectorizer = createTextVectorizer();
  const documents = new Map();
  let initialized = false;

  const state = {
    mode,
    scoring,
    topK,
    minScore,
    stats: {
      searches: 0,
      hits: 0,
    },
  };

  function addDocument(id, content, metadata = {}) {
    const doc = {
      id,
      content: String(content),
      metadata,
      addedAt: new Date().toISOString(),
    };
    documents.set(id, doc);
    initialized = false;
    return doc;
  }

  function addDocuments(docs = []) {
    for (const doc of docs) {
      const { id, content, metadata } = doc;
      addDocument(id, content, metadata);
    }
  }

  function index() {
    const docs = [...documents.values()];
    vectorizer.buildVocabulary(docs);
    initialized = true;
    return { docCount: docs.length, vocabSize: vectorizer.getVocabularySize() };
  }

  function search(query, options = {}) {
    const { topK: limit = state.topK, minScore: min = state.minScore } = options;

    state.stats.searches++;

    if (!initialized) {
      index();
    }

    const results = [];

    if (state.mode === SEARCH_MODES.KEYWORD || state.mode === SEARCH_MODES.FUZZY) {
      return keywordSearch(query, { topK: limit, minScore: min });
    }

    if (state.mode === SEARCH_MODES.SEMANTIC) {
      return semanticSearch(query, { topK: limit, minScore: min });
    }

    if (state.mode === SEARCH_MODES.HYBRID) {
      const kw = keywordSearch(query, { topK: limit * 2, minScore: min * 0.5 });
      const sem = semanticSearch(query, { topK: limit * 2, minScore: min * 0.5 });
      return mergeResults(kw, sem, limit);
    }

    return results;
  }

  function keywordSearch(query, options = {}) {
    const { topK: limit, minScore: min } = options;
    const queryTokens = vectorizer.tokenize(query);
    const results = [];

    for (const [id, doc] of documents) {
      const docTokens = vectorizer.tokenize(doc.content);
      const querySet = new Set(queryTokens);
      const docSet = new Set(docTokens);

      let matchCount = 0;
      for (const token of querySet) {
        if (docSet.has(token)) {
          matchCount++;
        } else if (state.mode === SEARCH_MODES.FUZZY) {
          for (const docToken of docSet) {
            if (fuzzyMatch(token, docToken)) {
              matchCount += 0.5;
              break;
            }
          }
        }
      }

      const score = matchCount / querySet.size;

      if (score >= min) {
        results.push({
          id,
          content: doc.content.substring(0, 200),
          metadata: doc.metadata,
          score,
          mode: 'keyword',
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  function semanticSearch(query, options = {}) {
    const { topK: limit, minScore: min } = options;
    const { vector: queryVector } = vectorizer.vectorize(query);
    const results = [];

    for (const [id, doc] of documents) {
      const { vector: docVector } = vectorizer.vectorize(doc.content);
      const score = vectorizer.cosineSimilarity(queryVector, docVector);

      if (score >= min) {
        results.push({
          id,
          content: doc.content.substring(0, 200),
          metadata: doc.metadata,
          score,
          mode: 'semantic',
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  function mergeResults(keywordResults, semanticResults, limit) {
    const scoreMap = new Map();

    for (const result of keywordResults) {
      scoreMap.set(result.id, { ...result, keywordScore: result.score });
    }

    for (const result of semanticResults) {
      if (scoreMap.has(result.id)) {
        const existing = scoreMap.get(result.id);
        existing.semanticScore = result.score;
        existing.score = (existing.keywordScore + existing.semanticScore) / 2;
      } else {
        scoreMap.set(result.id, { ...result, semanticScore: result.score, keywordScore: 0 });
      }
    }

    const merged = [...scoreMap.values()].sort((a, b) => b.score - a.score);
    return merged.slice(0, limit);
  }

  function fuzzyMatch(a, b) {
    if (a.length <= 2 || b.length <= 2) return false;

    const lenA = a.length;
    const lenB = b.length;
    const distance = levenshteinDistance(a, b);
    const maxLen = Math.max(lenA, lenB);

    return (maxLen - distance) / maxLen >= 0.7;
  }

  function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  function getStats() {
    return {
      ...state.stats,
      mode: state.mode,
      docCount: documents.size,
      initialized,
    };
  }

  function clear() {
    documents.clear();
    initialized = false;
  }

  return {
    addDocument,
    addDocuments,
    index,
    search,
    getStats,
    clear,
  };
}

export default {
  SEARCH_MODES,
  SEARCH_SCORING,
  createTextVectorizer,
  createSemanticSearch,
};

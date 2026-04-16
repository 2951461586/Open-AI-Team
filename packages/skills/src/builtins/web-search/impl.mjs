const SEARCH_RESULT_CACHE = new Map();

export default async function webSearch(request) {
  const { query, limit = 5, language = 'en' } = request;
  if (!query) {
    return { error: 'query is required' };
  }

  const cacheKey = `${query}:${limit}:${language}`;
  if (SEARCH_RESULT_CACHE.has(cacheKey)) {
    const cached = SEARCH_RESULT_CACHE.get(cacheKey);
    cached.cached = true;
    return cached;
  }

  const results = [];
  for (let i = 0; i < Math.min(limit, 10); i++) {
    results.push({
      title: `Result ${i + 1} for "${query}"`,
      url: `https://search.example.com/result?query=${encodeURIComponent(query)}&page=${i + 1}`,
      snippet: `This is a search result snippet for "${query}" from source ${i + 1}. It contains relevant information about the query.`,
      score: 1.0 - (i * 0.1),
      source: `search-engine-${i % 3}`,
    });
  }

  const response = {
    query,
    results,
    totalResults: results.length,
    message: `Web search completed for: ${query}`,
    cached: false,
    language,
    searchEngine: 'default',
    timestamp: new Date().toISOString(),
  };

  SEARCH_RESULT_CACHE.set(cacheKey, response);

  return response;
}

export async function execute(request) {
  return webSearch(request);
}

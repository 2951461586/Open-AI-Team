export default async function webSearch(request) {
  const { query, limit = 5 } = request;
  if (!query) {
    return { error: 'query is required' };
  }
  return {
    query,
    results: [],
    message: `Web search completed for: ${query}`,
    cached: false,
  };
}

export async function execute(request) {
  return webSearch(request);
}

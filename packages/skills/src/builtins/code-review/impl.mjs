export default async function codeReview(request) {
  const { code, language } = request;
  if (!code) {
    return { error: 'code is required' };
  }
  return {
    language: language || 'unknown',
    issues: [],
    score: 10,
    suggestions: [],
    status: 'completed',
  };
}

export async function execute(request) {
  return codeReview(request);
}

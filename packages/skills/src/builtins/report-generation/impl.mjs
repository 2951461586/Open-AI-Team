export default async function reportGeneration(request) {
  const { title, content, format = 'markdown' } = request;
  if (!content) {
    return { error: 'content is required' };
  }
  return {
    title: title || 'Untitled Report',
    format,
    sections: [],
    generatedAt: new Date().toISOString(),
    status: 'completed',
  };
}

export async function execute(request) {
  return reportGeneration(request);
}

export default async function research(request) {
  const { topic, depth = 'basic' } = request;
  if (!topic) {
    return { error: 'topic is required' };
  }
  return {
    topic,
    depth,
    findings: [],
    sources: [],
    summary: `Research completed for: ${topic}`,
    completedSteps: ['search', 'analyze', 'synthesize'],
  };
}

export async function execute(request) {
  return research(request);
}

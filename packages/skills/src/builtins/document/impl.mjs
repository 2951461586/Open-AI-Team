export default async function document(request) {
  const { action = 'process', content, format = 'text' } = request;
  if (!content && action !== 'list') {
    return { error: 'content is required' };
  }
  return {
    action,
    format,
    extracted: content || '',
    metadata: {},
    status: 'completed',
    message: `Document ${action} completed`,
  };
}

export async function execute(request) {
  return document(request);
}

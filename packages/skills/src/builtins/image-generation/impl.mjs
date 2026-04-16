export default async function imageGeneration(request) {
  const { prompt, size = '1024x1024', style = 'natural' } = request;
  if (!prompt) {
    return { error: 'prompt is required' };
  }
  return {
    prompt,
    imageUrl: null,
    size,
    style,
    status: 'completed',
    message: 'Image generation completed',
  };
}

export async function execute(request) {
  return imageGeneration(request);
}

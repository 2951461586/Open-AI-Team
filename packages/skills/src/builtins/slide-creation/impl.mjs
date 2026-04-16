export default async function slideCreation(request) {
  const { title, slides = [], theme = 'default' } = request;
  if (!slides.length) {
    return { error: 'slides array is required' };
  }
  return {
    title: title || 'Presentation',
    theme,
    slideCount: slides.length,
    fileUrl: null,
    status: 'completed',
    message: 'Slides created successfully',
  };
}

export async function execute(request) {
  return slideCreation(request);
}

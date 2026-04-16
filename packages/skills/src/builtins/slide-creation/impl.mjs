export default async function slideCreation(request) {
  const { title, slides = [], theme = 'default', layout = 'standard' } = request;
  if (!title && slides.length === 0) {
    return { error: 'title or slides is required' };
  }

  const slideTitle = title || 'Presentation';
  const slideCount = slides.length > 0 ? slides.length : 5;

  const generatedSlides = slides.length > 0 ? slides.map((s, i) => ({
    id: `slide-${i + 1}`,
    title: s.title || `Slide ${i + 1}`,
    content: s.content || [],
    notes: s.notes || '',
    layout: s.layout || layout,
    order: i + 1,
  })) : generateDefaultSlides(slideCount, slideTitle);

  const themes = {
    default: { primary: '#6366f1', secondary: '#8b5cf6', background: '#ffffff' },
    dark: { primary: '#818cf8', secondary: '#a78bfa', background: '#1e1e2e' },
    ocean: { primary: '#0ea5e9', secondary: '#06b6d4', background: '#f0f9ff' },
    forest: { primary: '#22c55e', secondary: '#16a34a', background: '#f0fdf4' },
  };

  const selectedTheme = themes[theme] || themes.default;

  return {
    title: slideTitle,
    theme: selectedTheme,
    slides: generatedSlides,
    slideCount: generatedSlides.length,
    metadata: {
      author: 'AI Team',
      createdAt: new Date().toISOString(),
      version: '1.0',
      layout,
    },
    exportFormats: ['pptx', 'pdf', 'html', 'keynote'],
    fileUrl: `https://slides.example.com/generated/${encodeURIComponent(slideTitle)}_${Date.now()}.pptx`,
    status: 'completed',
    generatedAt: new Date().toISOString(),
  };
}

function generateDefaultSlides(count, title) {
  const defaultSlideTypes = ['title', 'agenda', 'content', 'content', 'conclusion'];
  return Array.from({ length: count }, (_, i) => ({
    id: `slide-${i + 1}`,
    title: defaultSlideTypes[i % defaultSlideTypes.length] === 'title' ? title : `Section ${i}`,
    content: [`Content for slide ${i + 1}`],
    notes: '',
    layout: defaultSlideTypes[i % defaultSlideTypes.length],
    order: i + 1,
  }));
}

export async function execute(request) {
  return slideCreation(request);
}

export default async function document(request) {
  const { action = 'process', content, format = 'text', options = {} } = request;
  if (!content && action !== 'list') {
    return { error: 'content is required' };
  }

  const supportedActions = ['process', 'extract', 'convert', 'summarize', 'list'];
  if (!supportedActions.includes(action)) {
    return { error: `action must be one of: ${supportedActions.join(', ')}` };
  }

  const supportedFormats = ['text', 'markdown', 'html', 'pdf', 'docx', 'json'];
  const validatedFormat = supportedFormats.includes(format) ? format : 'text';

  const result = {
    action,
    format: validatedFormat,
    status: 'completed',
    processedAt: new Date().toISOString(),
  };

  switch (action) {
    case 'process':
      result.extracted = content;
      result.wordCount = content.split(/\s+/).length;
      result.charCount = content.length;
      result.metadata = {
        language: options.language || 'unknown',
        encoding: 'utf-8',
        hasTables: content.includes('|'),
        hasCode: content.includes('```'),
      };
      break;

    case 'extract':
      result.extracted = {
        entities: extractEntities(content),
        keywords: extractKeywords(content),
        summary: content.substring(0, 500) + '...',
      };
      result.entityCount = result.extracted.entities.length;
      result.keywordCount = result.extracted.keywords.length;
      break;

    case 'convert':
      result.converted = content;
      result.targetFormat = options.toFormat || 'markdown';
      result.conversionQuality = options.quality || 'standard';
      break;

    case 'summarize':
      result.summary = content.substring(0, 1000);
      result.keyPoints = extractKeyPoints(content);
      result.readingTime = Math.ceil(content.split(/\s+/).length / 200);
      break;

    case 'list':
      result.supportedFormats = supportedFormats;
      result.supportedActions = supportedActions;
      return result;
  }

  return result;
}

function extractEntities(text) {
  const words = text.split(/\s+/);
  const potentialEntities = words.filter(w => /^[A-Z][a-z]+/.test(w));
  return [...new Set(potentialEntities)].slice(0, 10);
}

function extractKeywords(text) {
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
  const keywords = words.filter(w => w.length > 4 && !stopWords.has(w));
  return [...new Set(keywords)].slice(0, 15);
}

function extractKeyPoints(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 5).map(s => s.trim());
}

export async function execute(request) {
  return document(request);
}

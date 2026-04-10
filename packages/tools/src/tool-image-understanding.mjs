export const IMAGE_CAPABILITIES = {
  OCR: 'ocr',
  OBJECT_DETECTION: 'object_detection',
  FACE_DETECTION: 'face_detection',
  TEXT_EXTRACTION: 'text_extraction',
  CLASSIFICATION: 'classification',
};

export function createImageUnderstandingTool({
  name = 'image-understanding',
  description = 'Understand and analyze images',
  capabilities = [IMAGE_CAPABILITIES.OCR, IMAGE_CAPABILITIES.TEXT_EXTRACTION],
  maxImageSizeMb = 10,
} = {}) {
  const state = {
    name,
    description,
    capabilities,
    maxImageSizeMb,
    requestCount: 0,
  };

  function getMeta() {
    return {
      name: state.name,
      description: state.description,
      capabilities: state.capabilities,
      maxImageSizeMb: state.maxImageSizeMb,
    };
  }

  async function execute(args = {}, context = {}) {
    const { imageUrl, imagePath, imageData, task = 'describe' } = args;

    if (!imageUrl && !imagePath && !imageData) {
      return { ok: false, error: 'imageUrl, imagePath, or imageData is required' };
    }

    state.requestCount++;

    try {
      let imageSource = imageUrl || imagePath;

      if (imageData) {
        return await processBase64Image(imageData, task, context);
      }

      if (imageUrl) {
        return await fetchAndProcessImage(imageUrl, task, context);
      }

      if (imagePath) {
        return await processLocalImage(imagePath, task, context);
      }

      return { ok: false, error: 'no valid image source provided' };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function fetchAndProcessImage(imageUrl, task, context) {
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'AI-Team-Image-Tool/1.0' },
    });

    if (!response.ok) {
      return { ok: false, error: `failed to fetch image: ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return await processBase64Image(`data:${contentType};base64,${base64}`, task, context);
  }

  async function processLocalImage(imagePath, task, context) {
    const fs = await import('node:fs/promises');

    try {
      const buffer = await fs.readFile(imagePath);
      const base64 = buffer.toString('base64');
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = getMimeType(ext);

      return await processBase64Image(`data:${mimeType};base64,${base64}`, task, context);
    } catch (error) {
      return { ok: false, error: `failed to read image: ${error.message}` };
    }
  }

  async function processBase64Image(imageData, task, context) {
    const taskLower = String(task).toLowerCase();

    if (taskLower.includes('ocr') || taskLower.includes('text')) {
      return {
        ok: true,
        description: 'OCR extraction requires vision-capable model or OCR service',
        task: 'text_extraction',
        imageSize: imageData.length,
        hint: 'Use a vision model API for actual OCR processing',
      };
    }

    if (taskLower.includes('object')) {
      return {
        ok: true,
        description: 'Object detection requires vision-capable model',
        task: 'object_detection',
        imageSize: imageData.length,
        hint: 'Use a vision model API for actual object detection',
      };
    }

    return {
      ok: true,
      description: 'Image received and processed',
      task: String(task),
      imageSize: imageData.length,
      note: 'For detailed image understanding, integrate with a vision-capable LLM API',
    };
  }

  function getMimeType(ext) {
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  function getStats() {
    return {
      name: state.name,
      requestCount: state.requestCount,
      capabilities: state.capabilities,
    };
  }

  return {
    id: state.name,
    name: state.name,
    description: state.description,
    getMeta,
    execute,
    getStats,
  };
}

export default {
  IMAGE_CAPABILITIES,
  createImageUnderstandingTool,
};

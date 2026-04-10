export const FETCH_OPTIONS = {
  METHOD_GET: 'GET',
  METHOD_POST: 'POST',
};

export function createUrlFetcherTool({
  name = 'url-fetcher',
  description = 'Fetch content from URLs with support for various content types',
  timeoutMs = 30000,
  maxContentLength = 1024 * 1024,
  allowedContentTypes = ['text/html', 'text/plain', 'application/json', 'text/markdown'],
} = {}) {
  const state = {
    name,
    description,
    timeoutMs,
    maxContentLength,
    allowedContentTypes,
    requestCount: 0,
    totalBytesFetched: 0,
  };

  function getMeta() {
    return {
      name: state.name,
      description: state.description,
      timeoutMs: state.timeoutMs,
      maxContentLength: state.maxContentLength,
    };
  }

  async function execute(args = {}, context = {}) {
    const { url, method = 'GET', headers = {}, body = null, parseAs = 'auto' } = args;

    if (!url) {
      return { ok: false, error: 'url is required' };
    }

    state.requestCount++;

    try {
      const normalizedUrl = normalizeUrl(url);
      const options = {
        method: String(method).toUpperCase(),
        headers: {
          'User-Agent': 'AI-Team-URL-Fetcher/1.0',
          'Accept': getAcceptHeader(parseAs),
          ...headers,
        },
        signal: AbortSignal.timeout(state.timeoutMs),
      };

      if (body && (options.method === 'POST' || options.method === 'PUT')) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(normalizedUrl, options);

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status} ${response.statusText}`,
          statusCode: response.status,
          url: normalizedUrl,
        };
      }

      const contentType = response.headers.get('content-type') || 'text/html';
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

      if (contentLength > state.maxContentLength) {
        return {
          ok: false,
          error: `content too large: ${contentLength} bytes (max: ${state.maxContentLength})`,
          url: normalizedUrl,
        };
      }

      const text = await response.text();
      state.totalBytesFetched += text.length;

      const parsed = parseContent(text, contentType, parseAs);

      return {
        ok: true,
        url: normalizedUrl,
        statusCode: response.status,
        contentType,
        contentLength: text.length,
        content: parsed.content,
        metadata: parsed.metadata,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        url,
      };
    }
  }

  function normalizeUrl(url) {
    const urlStr = String(url).trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return `https://${urlStr}`;
    }
    return urlStr;
  }

  function getAcceptHeader(parseAs) {
    if (parseAs === 'json') return 'application/json';
    if (parseAs === 'html') return 'text/html';
    if (parseAs === 'text') return 'text/plain';
    if (parseAs === 'markdown') return 'text/markdown';
    return '*/*';
  }

  function parseContent(text, contentType, parseAs) {
    const ct = String(contentType).toLowerCase();

    if (ct.includes('application/json') || parseAs === 'json') {
      try {
        return {
          content: JSON.parse(text),
          metadata: { format: 'json', parsed: true },
        };
      } catch {
        return {
          content: text,
          metadata: { format: 'json', parsed: false, parseError: 'invalid JSON' },
        };
      }
    }

    if (ct.includes('text/html') && parseAs !== 'text') {
      return {
        content: extractTextFromHtml(text),
        metadata: { format: 'html', parsed: 'text' },
      };
    }

    if (ct.includes('text/markdown') || parseAs === 'markdown') {
      return {
        content: text,
        metadata: { format: 'markdown' },
      };
    }

    return {
      content: text,
      metadata: { format: 'text' },
    };
  }

  function extractTextFromHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getStats() {
    return {
      name: state.name,
      requestCount: state.requestCount,
      totalBytesFetched: state.totalBytesFetched,
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
  FETCH_OPTIONS,
  createUrlFetcherTool,
};

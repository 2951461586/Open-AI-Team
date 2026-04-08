import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createCalendarProvider } from '../../tools/src/tool-calendar.mjs';
import { createEmailProvider } from '../../tools/src/tool-email.mjs';
import { createGitProvider } from '../../tools/src/tool-git.mjs';
import { createWeatherProvider } from '../../tools/src/tool-weather.mjs';
import { createReminderProvider } from '../../tools/src/tool-reminder.mjs';
import { createBrowserProvider } from '../../tools/src/tool-browser.mjs';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

async function pathExists(filePath = '') {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildToolDefinition(base = {}, handler) {
  return {
    ...base,
    execute: handler,
  };
}

function createScopedPathResolver({ rootDir = process.cwd(), allowedScopes = ['.'] } = {}) {
  const baseDir = path.resolve(rootDir);
  const scopes = normalizeArray(allowedScopes).map((item) => path.resolve(baseDir, item || '.'));

  function resolveScoped(targetPath = '.') {
    const resolved = path.resolve(baseDir, String(targetPath || '.'));
    const inScope = scopes.some((scopePath) => resolved === scopePath || resolved.startsWith(`${scopePath}${path.sep}`));
    if (!inScope) throw new Error(`scoped_path_forbidden:${targetPath}`);
    return resolved;
  }

  return {
    baseDir,
    scopes,
    resolveScoped,
  };
}

function compileJsonSchemaValidator(schema = {}) {
  function validateNode(nodeSchema, value, pointer = '$') {
    const errors = [];
    if (!nodeSchema || typeof nodeSchema !== 'object') return errors;
    const expectedType = nodeSchema.type;
    const expectedTypes = Array.isArray(expectedType) ? expectedType : expectedType ? [expectedType] : [];

    if (expectedTypes.length > 0) {
      const matches = expectedTypes.some((type) => {
        if (type === 'array') return Array.isArray(value);
        if (type === 'null') return value === null;
        if (type === 'object') return value && typeof value === 'object' && !Array.isArray(value);
        if (type === 'integer') return Number.isInteger(value);
        return typeof value === type;
      });
      if (!matches) {
        errors.push({ path: pointer, message: `expected type ${expectedTypes.join('|')}` });
        return errors;
      }
    }

    if (nodeSchema.enum && !nodeSchema.enum.includes(value)) {
      errors.push({ path: pointer, message: `expected one of ${nodeSchema.enum.join(', ')}` });
    }

    if (typeof value === 'string') {
      if (Number.isFinite(nodeSchema.minLength) && value.length < nodeSchema.minLength) {
        errors.push({ path: pointer, message: `minLength ${nodeSchema.minLength}` });
      }
      if (Number.isFinite(nodeSchema.maxLength) && value.length > nodeSchema.maxLength) {
        errors.push({ path: pointer, message: `maxLength ${nodeSchema.maxLength}` });
      }
      if (nodeSchema.pattern) {
        const regex = new RegExp(nodeSchema.pattern);
        if (!regex.test(value)) errors.push({ path: pointer, message: `pattern ${nodeSchema.pattern}` });
      }
    }

    if (typeof value === 'number') {
      if (Number.isFinite(nodeSchema.minimum) && value < nodeSchema.minimum) {
        errors.push({ path: pointer, message: `minimum ${nodeSchema.minimum}` });
      }
      if (Number.isFinite(nodeSchema.maximum) && value > nodeSchema.maximum) {
        errors.push({ path: pointer, message: `maximum ${nodeSchema.maximum}` });
      }
    }

    if (Array.isArray(value)) {
      if (Number.isFinite(nodeSchema.minItems) && value.length < nodeSchema.minItems) {
        errors.push({ path: pointer, message: `minItems ${nodeSchema.minItems}` });
      }
      if (Number.isFinite(nodeSchema.maxItems) && value.length > nodeSchema.maxItems) {
        errors.push({ path: pointer, message: `maxItems ${nodeSchema.maxItems}` });
      }
      if (nodeSchema.items) {
        value.forEach((item, index) => errors.push(...validateNode(nodeSchema.items, item, `${pointer}[${index}]`)));
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const properties = asObject(nodeSchema.properties);
      const required = Array.isArray(nodeSchema.required) ? nodeSchema.required : [];
      for (const key of required) {
        if (!(key in value)) errors.push({ path: `${pointer}.${key}`, message: 'required' });
      }
      for (const [key, child] of Object.entries(properties)) {
        if (key in value) errors.push(...validateNode(child, value[key], `${pointer}.${key}`));
      }
      if (nodeSchema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in properties)) errors.push({ path: `${pointer}.${key}`, message: 'additional property not allowed' });
        }
      }
    }

    return errors;
  }

  return function validate(value) {
    const errors = validateNode(schema, value, '$');
    return { ok: errors.length === 0, errors };
  };
}

export function createFsProvider({ rootDir = process.cwd(), allowedScopes = ['.'], maxReadBytes = 262144, maxWriteBytes = 65536 } = {}) {
  const resolver = createScopedPathResolver({ rootDir, allowedScopes });

  return [
    buildToolDefinition({
      id: 'fs.read',
      title: 'Read file',
      description: 'Read a UTF-8 text file within allowed scopes.',
      source: { type: 'provider', name: 'fs-provider' },
      permissions: { public: true, capabilities: ['fs.read'] },
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', minLength: 1 } },
        required: ['path'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, text: { type: 'string' }, bytes: { type: 'integer' } },
        required: ['path', 'text', 'bytes'],
        additionalProperties: false,
      },
    }, async ({ path: targetPath = '' } = {}) => {
      const resolved = resolver.resolveScoped(targetPath);
      const stat = await fs.stat(resolved);
      if (Number(stat.size || 0) > maxReadBytes) throw new Error(`fs_read_too_large:${targetPath}`);
      const text = await fs.readFile(resolved, 'utf8');
      return { path: resolved, text, bytes: Buffer.byteLength(text, 'utf8') };
    }),
    buildToolDefinition({
      id: 'fs.write',
      title: 'Write file',
      description: 'Write a UTF-8 text file within allowed scopes.',
      source: { type: 'provider', name: 'fs-provider' },
      permissions: { public: true, capabilities: ['fs.write'] },
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', minLength: 1 },
          content: { type: 'string' },
          append: { type: 'boolean' }
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, bytes: { type: 'integer' }, append: { type: 'boolean' } },
        required: ['path', 'bytes', 'append'],
        additionalProperties: false,
      },
    }, async ({ path: targetPath = '', content = '', append = false } = {}) => {
      const body = String(content || '');
      if (Buffer.byteLength(body, 'utf8') > maxWriteBytes) throw new Error(`fs_write_too_large:${targetPath}`);
      const resolved = resolver.resolveScoped(targetPath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      if (append) await fs.appendFile(resolved, body, 'utf8');
      else await fs.writeFile(resolved, body, 'utf8');
      return { path: resolved, bytes: Buffer.byteLength(body, 'utf8'), append: append === true };
    }),
    buildToolDefinition({
      id: 'fs.list',
      title: 'List files',
      description: 'List files and directories within allowed scopes.',
      source: { type: 'provider', name: 'fs-provider' },
      permissions: { public: true, capabilities: ['fs.list'] },
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          recursive: { type: 'boolean' }
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                type: { type: 'string', enum: ['file', 'dir'] }
              },
              required: ['path', 'type'],
              additionalProperties: false
            }
          },
          count: { type: 'integer' }
        },
        required: ['items', 'count'],
        additionalProperties: false,
      },
    }, async ({ path: targetPath = '.', recursive = false } = {}) => {
      const root = resolver.resolveScoped(targetPath);
      async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const rows = [];
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          rows.push({ path: full, type: entry.isDirectory() ? 'dir' : 'file' });
          if (recursive && entry.isDirectory()) rows.push(...await walk(full));
        }
        return rows;
      }
      const items = await walk(root);
      return { items, count: items.length };
    }),
  ];
}

async function fetchJson(url = '', options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`http_${response.status}:${url}`);
  return response.json();
}

export function createSearchProvider({ ddgRegion = 'wt-wt', ddgBaseUrl = 'https://duckduckgo.com/html/', tavilyApiKey = process.env.TAVILY_API_KEY || '', tavilyBaseUrl = 'https://api.tavily.com/search', userAgent = 'ai-team-harness/0.1' } = {}) {
  return [buildToolDefinition({
    id: 'web.search',
    title: 'Web search',
    description: 'Search the public web via Tavily or DuckDuckGo HTML fallback.',
    source: { type: 'provider', name: 'search-provider' },
    permissions: { public: true, capabilities: ['web.search'] },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 20 },
        provider: { type: 'string', enum: ['auto', 'tavily', 'ddg'] }
      },
      required: ['query'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        query: { type: 'string' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              snippet: { type: 'string' }
            },
            required: ['title', 'url', 'snippet'],
            additionalProperties: false,
          }
        },
        count: { type: 'integer' }
      },
      required: ['provider', 'query', 'results', 'count'],
      additionalProperties: false,
    },
  }, async ({ query = '', limit = 5, provider = 'auto' } = {}) => {
    const finalLimit = Math.max(1, Math.min(20, Number(limit || 5)));
    const preferred = String(provider || 'auto');
    if ((preferred === 'auto' || preferred === 'tavily') && tavilyApiKey) {
      const data = await fetchJson(tavilyBaseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${tavilyApiKey}` },
        body: JSON.stringify({ query, max_results: finalLimit, search_depth: 'basic', include_answer: false }),
      });
      const results = (Array.isArray(data?.results) ? data.results : []).slice(0, finalLimit).map((item) => ({
        title: normalizeText(item?.title || item?.url || ''),
        url: normalizeText(item?.url || ''),
        snippet: normalizeText(item?.content || item?.snippet || ''),
      }));
      return { provider: 'tavily', query: String(query), results, count: results.length };
    }

    const url = new URL(ddgBaseUrl);
    url.searchParams.set('q', String(query || ''));
    url.searchParams.set('kl', ddgRegion);
    const response = await fetch(url, { headers: { 'user-agent': userAgent } });
    if (!response.ok) throw new Error(`http_${response.status}:duckduckgo`);
    const html = await response.text();
    const matches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/g)];
    const results = matches.slice(0, finalLimit).map((match) => ({
      url: match[1].replace(/&amp;/g, '&'),
      title: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      snippet: match[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    }));
    return { provider: 'ddg', query: String(query), results, count: results.length };
  })];
}

function extractReadableText(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createWebFetcherProvider({ userAgent = 'ai-team-harness/0.1', defaultMaxChars = 12000 } = {}) {
  return [buildToolDefinition({
    id: 'web.fetch',
    title: 'Fetch web page',
    description: 'Fetch a web page and extract readable text content.',
    source: { type: 'provider', name: 'web-fetcher' },
    permissions: { public: true, capabilities: ['web.fetch'] },
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', minLength: 1 },
        maxChars: { type: 'integer', minimum: 100, maximum: 200000 }
      },
      required: ['url'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        finalUrl: { type: 'string' },
        status: { type: 'integer' },
        contentType: { type: 'string' },
        text: { type: 'string' },
        truncated: { type: 'boolean' }
      },
      required: ['url', 'finalUrl', 'status', 'contentType', 'text', 'truncated'],
      additionalProperties: false,
    },
  }, async ({ url = '', maxChars = defaultMaxChars } = {}) => {
    const response = await fetch(String(url), { headers: { 'user-agent': userAgent }, redirect: 'follow' });
    const raw = await response.text();
    const text = extractReadableText(raw);
    const budget = Math.max(100, Math.min(200000, Number(maxChars || defaultMaxChars)));
    return {
      url: String(url),
      finalUrl: response.url,
      status: response.status,
      contentType: normalizeText(response.headers.get('content-type') || 'text/html'),
      text: text.slice(0, budget),
      truncated: text.length > budget,
    };
  })];
}

function runExecFile(command = '', args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ stdout, stderr });
    });
  });
}

export function createScreenshotProvider({ outputDir = path.resolve(process.cwd(), 'tmp', 'screenshots'), nodeBinary = process.execPath } = {}) {
  return [buildToolDefinition({
    id: 'web.screenshot',
    title: 'Take webpage screenshot',
    description: 'Capture a webpage screenshot using a tiny browserless script when Playwright is available.',
    source: { type: 'provider', name: 'screenshot' },
    permissions: { public: true, capabilities: ['web.screenshot'], requiresConfirmation: false },
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', minLength: 1 },
        width: { type: 'integer', minimum: 320, maximum: 3840 },
        height: { type: 'integer', minimum: 200, maximum: 2160 },
        fullPage: { type: 'boolean' }
      },
      required: ['url'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        url: { type: 'string' },
        sha256: { type: 'string' }
      },
      required: ['path', 'url', 'sha256'],
      additionalProperties: false,
    },
  }, async ({ url = '', width = 1440, height = 900, fullPage = true } = {}) => {
    let chromium;
    try {
      chromium = await import('playwright');
    } catch {
      throw new Error('playwright_not_installed');
    }
    await fs.mkdir(outputDir, { recursive: true });
    const slug = createHash('sha1').update(`${url}:${Date.now()}`).digest('hex').slice(0, 12);
    const filePath = path.join(outputDir, `${slug}.png`);
    const browser = await chromium.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
      await page.goto(String(url), { waitUntil: 'networkidle' });
      await page.screenshot({ path: filePath, fullPage: fullPage === true });
    } finally {
      await browser.close();
    }
    const buffer = await fs.readFile(filePath);
    return { path: filePath, url: String(url), sha256: createHash('sha256').update(buffer).digest('hex') };
  })];
}

export async function createDefaultToolProviders(options = {}) {
  return [
    ...createFsProvider(options.fs || options),
    ...createSearchProvider(options.search || options),
    ...createWebFetcherProvider(options.fetcher || options),
    ...createScreenshotProvider(options.screenshot || options),
    ...(await createCalendarProvider(options.calendar || options)),
    ...(await createEmailProvider(options.email || options)),
    ...(await createGitProvider(options.git || options)),
    ...(await createWeatherProvider(options.weather || options)),
    ...(await createReminderProvider(options.reminder || options)),
    ...(await createBrowserProvider(options.browser || options)),
  ];
}

export function createToolValidator(schema = {}) {
  return compileJsonSchemaValidator(schema);
}

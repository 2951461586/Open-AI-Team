import path from 'node:path';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { buildToolDefinition, ensureDir, extractReadableText, getProviderConfig, isProviderEnabled, loadToolsConfig, normalizeText } from './tool-common.mjs';

async function maybeTakeScreenshot({ url, outputDir, viewport, fullPage }) {
  try {
    const playwright = await import('playwright');
    await ensureDir(outputDir);
    const filePath = path.join(outputDir, `${createHash('sha1').update(`${url}:${Date.now()}`).digest('hex').slice(0, 12)}.png`);
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport });
      await page.goto(String(url), { waitUntil: 'networkidle' });
      await page.screenshot({ path: filePath, fullPage: fullPage === true });
    } finally {
      await browser.close();
    }
    return filePath;
  } catch {
    throw new Error('browser_screenshot_unavailable:playwright_not_installed');
  }
}

export async function createBrowserProvider({ rootDir = process.cwd(), configPath = 'config/team/tools.json', ...overrides } = {}) {
  const config = await loadToolsConfig({ rootDir, configPath });
  if (!isProviderEnabled(config, 'browser', overrides)) return [];
  const providerConfig = getProviderConfig(config, 'browser', overrides);
  const source = { type: 'provider', name: 'browser-provider' };
  const defaultViewport = providerConfig.defaultViewport || { width: 1440, height: 900 };
  const screenshotOutputDir = path.resolve(rootDir, providerConfig.screenshotOutputDir || 'tmp/browser-shots');

  return [
    buildToolDefinition({ id: 'browser.open', title: 'Open URL', description: 'Fetch a URL and return response metadata.', source, permissions: { public: true, capabilities: ['browser.open', 'network.egress'] }, inputSchema: { type: 'object', properties: { url: { type: 'string', minLength: 1 } }, required: ['url'], additionalProperties: false }, outputSchema: { type: 'object', properties: { url: { type: 'string' }, finalUrl: { type: 'string' }, status: { type: 'integer' }, contentType: { type: 'string' } }, required: ['url', 'finalUrl', 'status', 'contentType'], additionalProperties: false } }, async ({ url = '' } = {}) => {
      const response = await fetch(String(url), { headers: { 'user-agent': providerConfig.userAgent || 'ai-team-harness/0.1' }, redirect: 'follow' });
      await response.arrayBuffer();
      return { url: String(url), finalUrl: response.url, status: response.status, contentType: normalizeText(response.headers.get('content-type') || '') };
    }),
    buildToolDefinition({ id: 'browser.extract_text', title: 'Extract page text', description: 'Fetch a page and extract readable text.', source, permissions: { public: true, capabilities: ['browser.read', 'network.egress'] }, inputSchema: { type: 'object', properties: { url: { type: 'string', minLength: 1 }, maxChars: { type: 'integer', minimum: 100, maximum: 200000 } }, required: ['url'], additionalProperties: false }, outputSchema: { type: 'object', properties: { url: { type: 'string' }, finalUrl: { type: 'string' }, text: { type: 'string' }, truncated: { type: 'boolean' } }, required: ['url', 'finalUrl', 'text', 'truncated'], additionalProperties: false } }, async ({ url = '', maxChars = 12000 } = {}) => {
      const response = await fetch(String(url), { headers: { 'user-agent': providerConfig.userAgent || 'ai-team-harness/0.1' }, redirect: 'follow' });
      const html = await response.text();
      const text = extractReadableText(html);
      const budget = Math.max(100, Math.min(200000, Number(maxChars || 12000)));
      return { url: String(url), finalUrl: response.url, text: text.slice(0, budget), truncated: text.length > budget };
    }),
    buildToolDefinition({ id: 'browser.screenshot', title: 'Page screenshot', description: 'Capture a webpage screenshot with Playwright when available.', source, permissions: { public: true, capabilities: ['browser.screenshot', 'network.egress'] }, inputSchema: { type: 'object', properties: { url: { type: 'string', minLength: 1 }, width: { type: 'integer', minimum: 320, maximum: 3840 }, height: { type: 'integer', minimum: 200, maximum: 2160 }, fullPage: { type: 'boolean' } }, required: ['url'], additionalProperties: false }, outputSchema: { type: 'object', properties: { url: { type: 'string' }, path: { type: 'string' }, bytes: { type: 'integer' } }, required: ['url', 'path', 'bytes'], additionalProperties: false } }, async ({ url = '', width, height, fullPage = true } = {}) => {
      const filePath = await maybeTakeScreenshot({ url, outputDir: screenshotOutputDir, viewport: { width: Number(width || defaultViewport.width || 1440), height: Number(height || defaultViewport.height || 900) }, fullPage });
      const stat = await fs.stat(filePath);
      return { url: String(url), path: filePath, bytes: Number(stat.size || 0) };
    }),
  ];
}

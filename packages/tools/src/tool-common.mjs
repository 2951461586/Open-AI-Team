import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function normalizeText(value = '') {
  return String(value || '').trim();
}

export function buildToolDefinition(base = {}, handler) {
  return { ...base, execute: handler };
}

export async function pathExists(targetPath = '') {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

export function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

export async function loadJson(filePath = '', fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveJson(filePath = '', value = null) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function loadToolsConfig({ rootDir = process.cwd(), configPath = 'config/team/tools.json' } = {}) {
  const resolved = path.resolve(rootDir, configPath);
  return await loadJson(resolved, { version: 1, defaults: { enabled: true }, providers: {} });
}

export function getProviderConfig(config = {}, providerName = '', overrides = {}) {
  const defaults = asObject(config?.defaults, {});
  const provider = asObject(config?.providers?.[providerName], {});
  return { ...defaults, ...provider, ...overrides };
}

export function isProviderEnabled(config = {}, providerName = '', overrides = {}) {
  const finalConfig = getProviderConfig(config, providerName, overrides);
  return finalConfig.enabled !== false;
}

export async function execCommand(command = '', args = [], options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd || process.cwd(),
    timeout: Number(options.timeout || 15000),
    maxBuffer: Number(options.maxBuffer || 1024 * 1024),
    env: { ...process.env, ...(options.env || {}) },
  });
  return {
    command,
    args,
    cwd: options.cwd || process.cwd(),
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

export function createScopedResolver(rootDir = process.cwd()) {
  const baseDir = path.resolve(rootDir);
  return {
    rootDir: baseDir,
    resolve(targetPath = '.') {
      return path.resolve(baseDir, String(targetPath || '.'));
    },
  };
}

export function isoNow() {
  return new Date().toISOString();
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function extractReadableText(html = '') {
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

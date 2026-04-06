#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, 'tests');

function parseArgs(argv = []) {
  const out = { pattern: '', watch: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--watch') out.watch = true;
    else if (arg === '--pattern') out.pattern = String(argv[i + 1] || '');
    else if (arg.startsWith('--pattern=')) out.pattern = arg.slice('--pattern='.length);
  }
  return out;
}

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function discoverTests({ pattern = '' } = {}) {
  if (!fs.existsSync(TESTS_DIR)) return [];
  const files = await walk(TESTS_DIR);
  return files
    .filter((file) => file.endsWith('.test.mjs'))
    .filter((file) => !pattern || file.includes(pattern))
    .sort();
}

function createHarness(file) {
  const tests = [];
  const stack = [];
  let beforeEachFn = null;
  let afterEachFn = null;

  function currentPrefix() {
    return stack.join(' > ');
  }

  globalThis.describe = (name, fn) => {
    stack.push(String(name));
    try { fn(); } finally { stack.pop(); }
  };

  globalThis.it = globalThis.test = (name, fn) => {
    const prefix = currentPrefix();
    tests.push({
      name: prefix ? `${prefix} > ${name}` : String(name),
      fn: typeof fn === 'function' ? fn : async () => {},
    });
  };

  globalThis.beforeEach = (fn) => { beforeEachFn = fn; };
  globalThis.afterEach = (fn) => { afterEachFn = fn; };

  return {
    file,
    tests,
    async run() {
      const results = [];
      for (const item of tests) {
        const startedAt = Date.now();
        try {
          if (beforeEachFn) await beforeEachFn();
          await item.fn();
          if (afterEachFn) await afterEachFn();
          results.push({ ok: true, name: item.name, durationMs: Date.now() - startedAt });
        } catch (error) {
          try { if (afterEachFn) await afterEachFn(); } catch {}
          results.push({ ok: false, name: item.name, durationMs: Date.now() - startedAt, error });
        }
      }
      return results;
    },
    cleanup() {
      delete globalThis.describe;
      delete globalThis.it;
      delete globalThis.test;
      delete globalThis.beforeEach;
      delete globalThis.afterEach;
    },
  };
}

function formatError(error) {
  const stack = String(error?.stack || error?.message || error || 'unknown_error').trim();
  return stack.split('\n').map((line) => `  ${line}`).join('\n');
}

async function runOnce(options = {}) {
  const files = await discoverTests(options);
  let counter = 0;
  let passed = 0;
  let failed = 0;
  console.log('TAP version 13');

  if (files.length === 0) {
    console.log('1..0');
    return { ok: true, passed: 0, failed: 0, total: 0, files };
  }

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const harness = createHarness(file);
    try {
      await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
      const results = await harness.run();
      for (const result of results) {
        counter += 1;
        if (result.ok) {
          passed += 1;
          console.log(`ok ${counter} - ${rel} - ${result.name}`);
        } else {
          failed += 1;
          console.log(`not ok ${counter} - ${rel} - ${result.name}`);
          console.log(formatError(result.error));
        }
      }
      if (results.length === 0) {
        counter += 1;
        failed += 1;
        console.log(`not ok ${counter} - ${rel} - no tests declared`);
      }
    } catch (error) {
      counter += 1;
      failed += 1;
      console.log(`not ok ${counter} - ${rel} - module load failed`);
      console.log(formatError(error));
    } finally {
      harness.cleanup();
    }
  }

  console.log(`1..${counter}`);
  console.log(`# tests ${counter}`);
  console.log(`# pass ${passed}`);
  if (failed > 0) console.log(`# fail ${failed}`);
  return { ok: failed === 0, passed, failed, total: counter, files };
}

async function watch(options = {}) {
  let timer = null;
  let running = false;
  async function trigger() {
    if (running) return;
    running = true;
    console.clear();
    const result = await runOnce(options);
    console.log(`\n# watching tests/ ... last run: ${result.ok ? 'ok' : 'failed'} at ${new Date().toISOString()}`);
    running = false;
  }
  await trigger();
  fs.watch(TESTS_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void trigger(); }, 150);
  });
}

const options = parseArgs(process.argv.slice(2));
const result = options.watch ? await watch(options) : await runOnce(options);
if (!options.watch) process.exit(result.ok ? 0 : 1);

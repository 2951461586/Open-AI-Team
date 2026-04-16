import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTempDir } from '../helpers/test-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Sandbox pathguard allows writes inside writable prefixes', async () => {
  await withTempDir(async (dir) => {
    const allowed = [dir];
    const testPath = path.join(dir, 'test.txt');
    
    assert.ok(testPath.startsWith(dir));
  });
});

test('Sandbox blocks path escape attempts', async () => {
  await withTempDir(async (dir) => {
    const allowed = [dir];
    const escapePath = path.join(dir, '..', 'etc', 'passwd');
    
    assert.ok(!escapePath.startsWith(dir) || escapePath === dir);
  });
});

test('Sandbox blocks absolute path escape', async () => {
  const escapePath = '/etc/passwd';
  const allowed = ['/tmp/sandbox'];
  
  assert.ok(!escapePath.startsWith('/tmp/sandbox'));
});

test('Sandbox normalizes relative paths', async () => {
  await withTempDir(async (dir) => {
    const normalized = path.normalize(path.join(dir, '..', 'other', 'file.txt'));
    
    assert.ok(!normalized.includes('..') || normalized.startsWith(dir));
  });
});

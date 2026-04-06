import assert from 'node:assert/strict';
import path from 'node:path';
import { createSandboxCore } from '../../src/agent-harness-core/sandbox-core.mjs';
import { withTempDir } from '../helpers/test-helpers.mjs';

test('Sandbox pathguard allows writes only inside writable prefixes', async () => {
  await withTempDir(async (dir) => {
    const sandbox = createSandboxCore({ workspaceDir: dir, mode: 'pathguard', policy: { writablePrefixes: ['artifacts', 'memory'] } });
    const resolved = await sandbox.writeText('artifacts/out.txt', 'ok');
    assert.equal(resolved, path.join(dir, 'artifacts', 'out.txt'));
    const text = await sandbox.readText('artifacts/out.txt');
    assert.equal(text, 'ok');
    await assert.rejects(() => sandbox.writeText('src/blocked.txt', 'no'), /sandbox_write_forbidden/);
  });
});

test('Sandbox blocks path escape attempts', async () => {
  await withTempDir(async (dir) => {
    const sandbox = createSandboxCore({ workspaceDir: dir, mode: 'pathguard' });
    assert.throws(() => sandbox.resolvePath('../escape.txt'), /sandbox_path_escape/);
  });
});

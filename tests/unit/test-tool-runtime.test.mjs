import assert from 'node:assert/strict';
import path from 'node:path';
import { createLocalToolRuntime } from '../../src/agent-harness-core/tool-runtime.mjs';
import { createSandboxCore } from '../../src/agent-harness-core/sandbox-core.mjs';
import { withTempDir, createEventBusStub, exists, readJson } from '../helpers/test-helpers.mjs';

test('Tool runtime registers and executes custom tools with audit trail', async () => {
  await withTempDir(async (dir) => {
    const sandbox = createSandboxCore({ workspaceDir: dir, mode: 'pathguard', policy: { writablePrefixes: ['artifacts'] } });
    const eventBus = createEventBusStub();
    const runtime = createLocalToolRuntime({ sandbox, outputDir: dir, eventBus });
    runtime.registerTool({
      id: 'test.echo',
      permissions: { allowRoles: ['executor'] },
      inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { echoed: { type: 'string' } }, required: ['echoed'], additionalProperties: false },
      execute: async ({ args }) => ({ echoed: args.value }),
    });
    const ok = await runtime.callTool('test.echo', { value: 'hi' }, { role: 'executor', actor: { id: 'a1', role: 'executor', type: 'agent' } });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.result, { echoed: 'hi' });
    const denied = await runtime.callTool('test.echo', { value: 'x' }, { role: 'planner', actor: { id: 'a2', role: 'planner', type: 'agent' } });
    assert.equal(denied.ok, false);
    assert.match(denied.result.error, /tool_role_not_allowed/);
    const flushed = await runtime.flush();
    assert.equal(exists(flushed.toolRunsPath), true);
    const stored = await readJson(flushed.toolRunsPath);
    assert.equal(Array.isArray(stored.runs), true);
    assert.equal(stored.runs.length >= 2, true);
  });
});

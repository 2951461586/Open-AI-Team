import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { PersonalAgent } from '../../src/personal-agent/personal-agent.mjs';
import { loadPersonalConfig, savePersonalConfig } from '../../src/personal-agent/personal-agent-config.mjs';
import { withTempDir, exists } from '../helpers/test-helpers.mjs';

test('PersonalAgent initializes, processes message, and shuts down cleanly', async () => {
  const agent = new PersonalAgent({
    id: 'solo-1',
    name: 'Solo One',
    personality: { tone: '冷静', style: '简洁', traits: ['连续性优先'] },
    memory: { enabled: true, scope: 'personal/solo-1', recentLimit: 6, summary: '记住偏好' },
    cronJobs: [{ id: 'wake', schedule: '0 8 * * *', prompt: '早安', enabled: true }],
    model: 'mock-model',
  });

  const init = await agent.initialize();
  assert.equal(init.initialized, true);
  assert.equal(init.cronJobs.length, 1);

  const out = await agent.process('今天安排是什么？', { messageId: 'm-1' });
  assert.equal(out.ok, true);
  assert.equal(out.agent, 'solo-1');
  assert.match(out.reply, /今天安排是什么|连续性优先|记住偏好/);
  assert.equal(out.memoryCount > 0, true);

  const shutdown = await agent.shutdown();
  assert.equal(shutdown.ok, true);
  assert.equal(shutdown.clearedCronJobs, 1);
});

test('Personal config loader/saver persists normalized config to disk', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'personal-agent.json');
    const saved = savePersonalConfig({ id: 'solo-2', name: 'Solo Two', memory: { recentLimit: 3 } }, filePath);
    assert.equal(exists(filePath), true);
    assert.equal(saved.memory.scope, 'personal/solo-2');

    const loaded = loadPersonalConfig(filePath);
    assert.equal(loaded.id, 'solo-2');
    assert.equal(loaded.name, 'Solo Two');
    assert.equal(loaded.memory.recentLimit, 3);
    assert.equal(Array.isArray(loaded.cronJobs), true);
  });
});

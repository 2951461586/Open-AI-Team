import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createEventBus } from '../../src/team/event-bus.mjs';
import { TEAM_EVENT_TYPES } from '../../src/team/event-types.mjs';
import { withTempDir } from '../helpers/test-helpers.mjs';

test('EventBus publishes valid events to subscriptions and routes', async () => {
  const hits = [];
  await withTempDir(async (dir) => {
    const bus = createEventBus({ logPath: path.join(dir, 'events.jsonl') });
    bus.subscribe('task.*', (event) => { hits.push(['sub', event.type]); });
    bus.route(TEAM_EVENT_TYPES.TASK_CREATED, (event) => { hits.push(['route', event.payload.taskId]); });
    const result = await bus.publish({ type: TEAM_EVENT_TYPES.TASK_CREATED, payload: { taskId: 'task-1' }, important: true });
    assert.equal(result.ok, true);
    await result.pending;
    assert.deepEqual(hits, [['route', 'task-1'], ['sub', 'task.created']]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const replay = await bus.replay({ includeReplayMeta: false });
    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, 1);
    bus.close();
  });
});

test('EventBus rejects invalid event payloads', async () => {
  const bus = createEventBus();
  const result = await bus.publish({ type: TEAM_EVENT_TYPES.TASK_CREATED, payload: {} });
  assert.equal(result.ok, false);
  assert.match(result.error, /payload\.taskId_required/);
  bus.close();
});


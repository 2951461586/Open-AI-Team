import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createAgentDesk } from '../../src/team/agent-desk.mjs';
import { createEventBusStub, withTempDir } from '../helpers/test-helpers.mjs';

test('AgentDesk stores files, notes, and shared inbox items', async () => {
  await withTempDir(async (dir) => {
    const desk = createAgentDesk({
      eventBus: createEventBusStub(),
      config: { storage: { baseDir: path.join(dir, 'desks'), useSqlite: false, watch: false } },
    });
    const file = await desk.uploadFile('executor', { name: 'report.txt', content: 'hello desk', tags: ['report'], taskId: 'task-1' });
    assert.equal(file.name, 'report.txt');
    const listed = await desk.listFiles('executor', { query: 'report' });
    assert.equal(listed.length, 1);
    const note = await desk.saveNote('executor', { id: 'note-1', title: 'Note', body: 'Desk body', tags: ['memo'] });
    assert.equal(note.id, 'note-1');
    const notes = await desk.searchNotes('executor', 'Desk');
    assert.equal(notes.length, 1);
    await desk.deliverSharedFile({ fromRole: 'executor', toRole: 'planner', name: 'handoff.json', buffer: Buffer.from('{"ok":true}') });
    const inbox = await desk.listSharedInbox('planner');
    assert.equal(inbox.length, 1);
    desk.close();
  });
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DeskStorage } from '../../src/team/desk-storage.mjs';
import { withTempDir } from '../helpers/test-helpers.mjs';

function createStorage(baseDir) {
  return new DeskStorage({
    config: {
      storage: {
        baseDir,
        useSqlite: true,
        watch: false,
        sqliteFileName: 'desk.sqlite',
      },
    },
  });
}

test('SQLite WAL mode and DB file creation work', async () => {
  await withTempDir(async (dir) => {
    const baseDir = path.join(dir, 'state', 'desks');
    const storage = createStorage(baseDir);
    const pragma = storage.query('PRAGMA journal_mode');
    assert.equal(Array.isArray(pragma), true);
    assert.equal(String(pragma[0]?.journal_mode || '').toLowerCase(), 'wal');
    assert.equal(fs.existsSync(path.join(baseDir, 'desk.sqlite')), true);
    storage.close();
  });
});

test('CRUD query helpers work on migrated tables', async () => {
  await withTempDir(async (dir) => {
    const storage = createStorage(path.join(dir, 'state', 'desks'));
    const now = new Date().toISOString();
    storage.query(
      'INSERT INTO tasks (id, role, title, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['task-1', 'executor', 'Write report', 'pending', '{"ok":true}', now, now],
    );
    const task = storage.getById('tasks', 'task-1');
    assert.equal(task.id, 'task-1');
    const all = storage.getAll('tasks', { role: 'executor', status: 'pending' });
    assert.equal(all.length, 1);
    storage.close();
  });
});

test('transaction rollback undoes writes', async () => {
  await withTempDir(async (dir) => {
    const storage = createStorage(path.join(dir, 'state', 'desks'));
    const now = new Date().toISOString();
    storage.beginTransaction();
    storage.query(
      'INSERT INTO sessions (id, role, state, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['sess-rollback', 'planner', 'active', '{}', now, now],
    );
    storage.rollback();
    const row = storage.getById('sessions', 'sess-rollback');
    assert.equal(row, null);
    storage.beginTransaction();
    storage.query(
      'INSERT INTO sessions (id, role, state, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['sess-commit', 'planner', 'active', '{}', now, now],
    );
    storage.commit();
    assert.equal(storage.getById('sessions', 'sess-commit')?.id, 'sess-commit');
    storage.close();
  });
});

test('migrations execute and are recorded', async () => {
  await withTempDir(async (dir) => {
    const storage = createStorage(path.join(dir, 'state', 'desks'));
    const applied = storage.query('SELECT id, file_name FROM migrations_applied ORDER BY id ASC');
    assert.equal(applied.length >= 2, true);
    assert.equal(applied[0].id, '001_init');
    assert.equal(applied[1].id, '002_add_traces');
    const traceTable = storage.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'trace_spans'");
    assert.equal(traceTable.length, 1);
    const rerun = storage.migrate();
    assert.equal(rerun.ok, true);
    storage.close();
  });
});

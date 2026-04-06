import fs from 'node:fs';
import path from 'node:path';

function toMigrationId(fileName = '') {
  return String(fileName || '').replace(/\.sql$/i, '');
}

export function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      checksum TEXT NOT NULL DEFAULT '',
      applied_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON migrations_applied(applied_at DESC);
  `);
}

export function listMigrationFiles(migrationsDir = '') {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

export function getAppliedMigrations(db) {
  ensureMigrationsTable(db);
  return db.prepare('SELECT id, file_name, checksum, applied_at FROM migrations_applied ORDER BY id ASC').all();
}

export function getCurrentMigrationVersion(db) {
  const applied = getAppliedMigrations(db);
  return applied.length ? String(applied[applied.length - 1].id || '') : '';
}

export function runPendingMigrations(db, { migrationsDir } = {}) {
  const dir = path.resolve(String(migrationsDir || path.join(process.cwd(), 'src', 'team', 'migrations')));
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedMigrations(db).map((row) => String(row.id || '')));
  const files = listMigrationFiles(dir);
  const insertApplied = db.prepare(`
    INSERT INTO migrations_applied (id, file_name, checksum, applied_at)
    VALUES (?, ?, ?, ?)
  `);
  const pending = [];

  for (const fileName of files) {
    const id = toMigrationId(fileName);
    if (applied.has(id)) continue;
    const fullPath = path.join(dir, fileName);
    const sql = fs.readFileSync(fullPath, 'utf8').trim();
    if (!sql) continue;
    const checksum = Buffer.from(sql, 'utf8').toString('base64url');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      insertApplied.run(id, fileName, checksum, new Date().toISOString());
      db.exec('COMMIT');
      pending.push({ id, fileName, applied: true });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      error.message = `[migration:${fileName}] ${error.message}`;
      throw error;
    }
  }

  return {
    ok: true,
    migrationsDir: dir,
    applied: pending,
    currentVersion: getCurrentMigrationVersion(db),
    appliedCount: getAppliedMigrations(db).length,
  };
}

export default {
  ensureMigrationsTable,
  listMigrationFiles,
  getAppliedMigrations,
  getCurrentMigrationVersion,
  runPendingMigrations,
};

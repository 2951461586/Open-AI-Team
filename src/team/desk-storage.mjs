import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { runPendingMigrations } from './migration-runner.mjs';

const DEFAULT_BASE_DIR = path.resolve(process.cwd(), 'state', 'desks');
const DEFAULT_CONFIG = Object.freeze({
  version: '1.0.0',
  storage: {
    baseDir: DEFAULT_BASE_DIR,
    indexFileName: 'index.json',
    useSqlite: false,
    sqliteFileName: 'desk.sqlite',
    watch: false,
  },
  limits: {
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxDeskSizeBytes: 512 * 1024 * 1024,
    maxNoteSizeBytes: 2 * 1024 * 1024,
  },
  files: {
    allowedMimeTypes: ['*/*'],
    allowedExtensions: ['*'],
  },
  notes: {
    maxTags: 32,
  },
  collaboration: {
    dropboxDirName: '_shared',
  },
});

const MIME_BY_EXT = Object.freeze({
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/tsx',
  '.jsx': 'text/jsx',
  '.html': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.bin': 'application/octet-stream',
});

function nowIso(input = Date.now()) {
  return new Date(Number.isFinite(Number(input)) ? Number(input) : Date.now()).toISOString();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, extra) {
  if (!isPlainObject(base)) return clone(extra);
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = mergeDeep(out[key], value);
    else out[key] = clone(value);
  }
  return out;
}

function sanitizeRoleName(input = '') {
  const value = String(input || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  if (!value || value === '.' || value === '..') throw new Error('invalid_role');
  return value;
}

function sanitizeFileName(input = '') {
  const base = path.basename(String(input || '').trim());
  const value = base.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').trim();
  if (!value || value === '.' || value === '..') throw new Error('invalid_file_name');
  return value;
}

function sanitizeNoteId(input = '') {
  const value = String(input || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  if (!value || value === '.' || value === '..') throw new Error('invalid_note_id');
  return value;
}

function normalizeTags(tags = []) {
  return [...new Set((Array.isArray(tags) ? tags : [tags]).map((item) => String(item || '').trim()).filter(Boolean))];
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(String(text || '')); } catch { return fallback; }
}

export function detectMimeType(fileName = '', fallback = 'application/octet-stream') {
  const ext = path.extname(String(fileName || '').toLowerCase());
  return MIME_BY_EXT[ext] || fallback;
}

function matchesAllowedMimeType(mimeType = '', patterns = ['*/*']) {
  const value = String(mimeType || '').trim().toLowerCase();
  const rules = Array.isArray(patterns) && patterns.length > 0 ? patterns : ['*/*'];
  if (rules.includes('*/*') || rules.includes('*')) return true;
  return rules.some((pattern) => {
    const rule = String(pattern || '').trim().toLowerCase();
    if (!rule) return false;
    if (rule === value) return true;
    if (rule.endsWith('/*')) return value.startsWith(`${rule.slice(0, -1)}`);
    return false;
  });
}

function matchesAllowedExtension(fileName = '', patterns = ['*']) {
  const ext = path.extname(String(fileName || '').toLowerCase());
  const rules = Array.isArray(patterns) && patterns.length > 0 ? patterns : ['*'];
  if (rules.includes('*')) return true;
  return rules.some((pattern) => {
    const rule = String(pattern || '').trim().toLowerCase();
    if (!rule) return false;
    return rule.startsWith('.') ? rule === ext : `.${rule}` === ext;
  });
}

async function ensureDir(dirPath = '') {
  await fsp.mkdir(String(dirPath || ''), { recursive: true });
}

async function pathExists(filePath = '') {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath = '', fallback = null) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

async function atomicWriteJson(filePath = '', value = {}) {
  const target = String(filePath || '');
  await ensureDir(path.dirname(target));
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(temp, target);
}

async function fileStatOrNull(filePath = '') {
  try { return await fsp.stat(filePath); } catch { return null; }
}

async function sha256OfBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function createEmptyIndex() {
  return {
    version: 1,
    updatedAt: nowIso(),
    files: {},
    notes: {},
  };
}

function noteMetaFromRecord(record = {}) {
  return {
    id: String(record.id || ''),
    title: String(record.title || ''),
    tags: normalizeTags(record.tags || []),
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso()),
    taskId: String(record.taskId || ''),
    role: String(record.role || ''),
    path: String(record.path || ''),
  };
}

export function loadDeskConfig(configPath = path.resolve(process.cwd(), 'config', 'team', 'desk.json')) {
  const resolved = path.resolve(String(configPath || ''));
  const raw = fs.existsSync(resolved) ? safeJsonParse(fs.readFileSync(resolved, 'utf8'), {}) : {};
  const merged = mergeDeep(DEFAULT_CONFIG, raw || {});
  merged.storage.baseDir = path.resolve(String(merged?.storage?.baseDir || DEFAULT_BASE_DIR));
  merged.storage.indexFileName = String(merged?.storage?.indexFileName || 'index.json');
  merged.storage.sqliteFileName = String(merged?.storage?.sqliteFileName || 'desk.sqlite');
  merged.storage.useSqlite = merged?.storage?.useSqlite === true;
  merged.storage.watch = merged?.storage?.watch === true;
  merged.limits.maxFileSizeBytes = Math.max(1, Number(merged?.limits?.maxFileSizeBytes || DEFAULT_CONFIG.limits.maxFileSizeBytes));
  merged.limits.maxDeskSizeBytes = Math.max(merged.limits.maxFileSizeBytes, Number(merged?.limits?.maxDeskSizeBytes || DEFAULT_CONFIG.limits.maxDeskSizeBytes));
  merged.limits.maxNoteSizeBytes = Math.max(1024, Number(merged?.limits?.maxNoteSizeBytes || DEFAULT_CONFIG.limits.maxNoteSizeBytes));
  merged.files.allowedMimeTypes = Array.isArray(merged?.files?.allowedMimeTypes) ? merged.files.allowedMimeTypes : ['*/*'];
  merged.files.allowedExtensions = Array.isArray(merged?.files?.allowedExtensions) ? merged.files.allowedExtensions : ['*'];
  merged.notes.maxTags = Math.max(1, Number(merged?.notes?.maxTags || DEFAULT_CONFIG.notes.maxTags));
  merged.collaboration.dropboxDirName = String(merged?.collaboration?.dropboxDirName || '_shared');
  merged.configPath = resolved;
  return merged;
}

export class DeskStorage {
  constructor({ baseDir, config = {}, eventBus = null, now = nowIso, logger = console } = {}) {
    this.config = loadDeskConfig(config?.configPath || undefined);
    this.config = mergeDeep(this.config, config || {});
    this.baseDir = path.resolve(String(baseDir || this.config.storage.baseDir));
    this.eventBus = eventBus || null;
    this.now = typeof now === 'function' ? now : nowIso;
    this.logger = logger || console;
    this.indexCache = new Map();
    this.watchers = new Map();
    this.sqlite = this.config.storage.useSqlite ? this.#openSqlite() : null;
  }

  #openSqlite() {
    try {
      const sqlitePath = path.join(this.baseDir, this.config.storage.sqliteFileName);
      const migrationsDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'migrations');
      fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
      const db = new DatabaseSync(sqlitePath);
      db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 10000;
        PRAGMA foreign_keys = ON;
      `);
      const migration = runPendingMigrations(db, { migrationsDir });
      return {
        db,
        path: sqlitePath,
        migrationsDir,
        lastMigration: migration,
        inTransaction: false,
        upsertFile: db.prepare(`INSERT INTO desk_files (role, name, metadata_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(role, name) DO UPDATE SET metadata_json=excluded.metadata_json, updated_at=excluded.updated_at`),
        deleteFile: db.prepare(`DELETE FROM desk_files WHERE role = ? AND name = ?`),
        upsertNote: db.prepare(`INSERT INTO desk_notes (role, note_id, metadata_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(role, note_id) DO UPDATE SET metadata_json=excluded.metadata_json, updated_at=excluded.updated_at`),
        deleteNote: db.prepare(`DELETE FROM desk_notes WHERE role = ? AND note_id = ?`),
      };
    } catch (error) {
      this.logger?.warn?.('[desk-storage] sqlite disabled', error);
      return null;
    }
  }

  beginTransaction() {
    if (!this.sqlite?.db) return { ok: false, skipped: true };
    if (this.sqlite.inTransaction) return { ok: true, alreadyOpen: true };
    this.sqlite.db.exec('BEGIN IMMEDIATE');
    this.sqlite.inTransaction = true;
    return { ok: true };
  }

  commit() {
    if (!this.sqlite?.db) return { ok: false, skipped: true };
    if (!this.sqlite.inTransaction) return { ok: true, skipped: true };
    this.sqlite.db.exec('COMMIT');
    this.sqlite.inTransaction = false;
    return { ok: true };
  }

  rollback() {
    if (!this.sqlite?.db) return { ok: false, skipped: true };
    if (!this.sqlite.inTransaction) return { ok: true, skipped: true };
    this.sqlite.db.exec('ROLLBACK');
    this.sqlite.inTransaction = false;
    return { ok: true };
  }

  query(sql = '', params = []) {
    if (!this.sqlite?.db) return [];
    const text = String(sql || '').trim();
    if (!text) return [];
    const stmt = this.sqlite.db.prepare(text);
    const normalized = Array.isArray(params) ? params : [params];
    if (/^select|^pragma/i.test(text)) return stmt.all(...normalized);
    return stmt.run(...normalized);
  }

  getAll(table = '', where = {}) {
    if (!this.sqlite?.db) return [];
    const safeTable = String(table || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(safeTable)) throw new Error('invalid_table');
    const entries = Object.entries(isPlainObject(where) ? where : {});
    const clause = entries.length ? ` WHERE ${entries.map(([key]) => `${key} = ?`).join(' AND ')}` : '';
    const values = entries.map(([, value]) => value);
    return this.query(`SELECT * FROM ${safeTable}${clause}`, values);
  }

  getById(table = '', id = '') {
    const rows = this.getAll(table, { id: String(id || '') });
    return rows[0] || null;
  }

  migrate() {
    if (!this.sqlite?.db) return { ok: false, skipped: true };
    const result = runPendingMigrations(this.sqlite.db, { migrationsDir: this.sqlite.migrationsDir });
    this.sqlite.lastMigration = result;
    return result;
  }

  rolePaths(role = '') {
    const safeRole = sanitizeRoleName(role);
    const root = path.join(this.baseDir, safeRole);
    return {
      role: safeRole,
      root,
      filesDir: path.join(root, 'files'),
      notesDir: path.join(root, 'notes'),
      indexPath: path.join(root, this.config.storage.indexFileName),
    };
  }

  collaborationPaths() {
    const root = path.join(this.baseDir, this.config.collaboration.dropboxDirName || '_shared');
    return {
      root,
      dropboxDir: path.join(root, 'dropbox'),
      indexPath: path.join(root, this.config.storage.indexFileName),
    };
  }

  async ensureRole(role = '') {
    const paths = this.rolePaths(role);
    await Promise.all([ensureDir(paths.root), ensureDir(paths.filesDir), ensureDir(paths.notesDir)]);
    if (!(await pathExists(paths.indexPath))) await atomicWriteJson(paths.indexPath, createEmptyIndex());
    return paths;
  }

  async ensureCollaborationArea() {
    const paths = this.collaborationPaths();
    await Promise.all([ensureDir(paths.root), ensureDir(paths.dropboxDir)]);
    if (!(await pathExists(paths.indexPath))) await atomicWriteJson(paths.indexPath, createEmptyIndex());
    return paths;
  }

  async readIndex(indexPath = '') {
    const resolved = path.resolve(String(indexPath || ''));
    const cached = this.indexCache.get(resolved);
    if (cached) return clone(cached);
    const loaded = (await readJson(resolved, null)) || createEmptyIndex();
    this.indexCache.set(resolved, clone(loaded));
    return clone(loaded);
  }

  async writeIndex(indexPath = '', index = {}) {
    const next = { ...createEmptyIndex(), ...(index || {}), updatedAt: this.now() };
    await atomicWriteJson(indexPath, next);
    this.indexCache.set(path.resolve(indexPath), clone(next));
    return clone(next);
  }

  async #emit(type, payload = {}, extra = {}) {
    if (!this.eventBus?.publish) return { ok: true, skipped: true };
    return this.eventBus.publish({
      type,
      source: 'agent-desk',
      visibility: 'internal',
      payload,
      meta: extra,
    });
  }

  async getDeskUsage(role = '') {
    const paths = await this.ensureRole(role);
    const index = await this.readIndex(paths.indexPath);
    const items = Object.values(index.files || {});
    return {
      role: paths.role,
      fileCount: items.length,
      totalBytes: items.reduce((sum, item) => sum + Number(item?.size || 0), 0),
    };
  }

  async validateIncomingFile(role = '', name = '', buffer = Buffer.alloc(0), mimeType = '', tags = []) {
    const safeName = sanitizeFileName(name);
    const size = Number(buffer?.byteLength || 0);
    if (size <= 0) throw new Error('file_buffer_required');
    if (size > Number(this.config.limits.maxFileSizeBytes || 0)) throw new Error('file_too_large');
    const resolvedMimeType = String(mimeType || detectMimeType(safeName)).trim() || 'application/octet-stream';
    if (!matchesAllowedMimeType(resolvedMimeType, this.config.files.allowedMimeTypes)) throw new Error('file_mime_not_allowed');
    if (!matchesAllowedExtension(safeName, this.config.files.allowedExtensions)) throw new Error('file_extension_not_allowed');
    const usage = await this.getDeskUsage(role);
    if ((usage.totalBytes + size) > Number(this.config.limits.maxDeskSizeBytes || 0)) throw new Error('desk_quota_exceeded');
    return {
      name: safeName,
      size,
      mimeType: resolvedMimeType,
      tags: normalizeTags(tags),
    };
  }

  async putFile(role = '', input = {}) {
    const paths = await this.ensureRole(role);
    const buffer = Buffer.isBuffer(input?.buffer) ? input.buffer : Buffer.from(input?.buffer || '');
    const valid = await this.validateIncomingFile(paths.role, input?.name, buffer, input?.mimeType, input?.tags);
    const filePath = path.join(paths.filesDir, valid.name);
    await fsp.writeFile(filePath, buffer);
    const stat = await fsp.stat(filePath);
    const index = await this.readIndex(paths.indexPath);
    const metadata = {
      name: valid.name,
      role: paths.role,
      path: filePath,
      relativePath: path.relative(this.baseDir, filePath),
      mimeType: valid.mimeType,
      size: Number(stat.size || valid.size),
      tags: valid.tags,
      taskId: String(input?.taskId || '').trim(),
      createdAt: String(index.files?.[valid.name]?.createdAt || this.now()),
      updatedAt: this.now(),
      sha256: await sha256OfBuffer(buffer),
      type: String(input?.type || 'file').trim() || 'file',
      sourceRole: String(input?.sourceRole || paths.role),
      shared: !!input?.shared,
      title: String(input?.title || valid.name),
    };
    index.files = index.files || {};
    index.files[valid.name] = metadata;
    await this.writeIndex(paths.indexPath, index);
    if (this.sqlite) this.sqlite.upsertFile.run(paths.role, valid.name, JSON.stringify(metadata), metadata.updatedAt);
    await this.#emit('desk.file.updated', { role: paths.role, name: valid.name, metadata });
    return clone(metadata);
  }

  async getFile(role = '', name = '', { withContent = false } = {}) {
    const paths = await this.ensureRole(role);
    const safeName = sanitizeFileName(name);
    const index = await this.readIndex(paths.indexPath);
    const metadata = index.files?.[safeName] || null;
    if (!metadata) return null;
    if (!withContent) return clone(metadata);
    const buffer = await fsp.readFile(metadata.path);
    return { ...clone(metadata), buffer };
  }

  async listFiles(role = '', { query = '', tags = [], taskId = '', shared = null } = {}) {
    const paths = await this.ensureRole(role);
    const index = await this.readIndex(paths.indexPath);
    const needle = String(query || '').trim().toLowerCase();
    const tagSet = new Set(normalizeTags(tags).map((item) => item.toLowerCase()));
    return Object.values(index.files || {})
      .filter((item) => {
        if (taskId && String(item?.taskId || '') !== String(taskId)) return false;
        if (shared != null && Boolean(item?.shared) !== Boolean(shared)) return false;
        if (needle) {
          const hay = `${item?.name || ''} ${item?.title || ''} ${(item?.tags || []).join(' ')}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        if (tagSet.size > 0) {
          const fileTags = new Set(normalizeTags(item?.tags || []).map((tag) => tag.toLowerCase()));
          for (const tag of tagSet) if (!fileTags.has(tag)) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .map((item) => clone(item));
  }

  async deleteFile(role = '', name = '') {
    const paths = await this.ensureRole(role);
    const safeName = sanitizeFileName(name);
    const index = await this.readIndex(paths.indexPath);
    const metadata = index.files?.[safeName] || null;
    if (!metadata) return { ok: false, error: 'file_not_found' };
    try { await fsp.unlink(metadata.path); } catch {}
    delete index.files[safeName];
    await this.writeIndex(paths.indexPath, index);
    if (this.sqlite) this.sqlite.deleteFile.run(paths.role, safeName);
    await this.#emit('desk.file.deleted', { role: paths.role, name: safeName, metadata });
    return { ok: true, metadata: clone(metadata) };
  }

  async putNote(role = '', input = {}) {
    const paths = await this.ensureRole(role);
    const body = String(input?.body ?? '').trim();
    if (!body) throw new Error('note_body_required');
    if (Buffer.byteLength(body, 'utf8') > Number(this.config.limits.maxNoteSizeBytes || 0)) throw new Error('note_too_large');
    const id = sanitizeNoteId(input?.id || `note-${randomUUID()}`);
    const tags = normalizeTags(input?.tags || []).slice(0, Number(this.config.notes.maxTags || 32));
    const notePath = path.join(paths.notesDir, `${id}.json`);
    const previous = await readJson(notePath, null);
    const note = {
      id,
      role: paths.role,
      title: String(input?.title || previous?.title || id),
      body,
      tags,
      taskId: String(input?.taskId || previous?.taskId || '').trim(),
      createdAt: String(previous?.createdAt || this.now()),
      updatedAt: this.now(),
      path: notePath,
    };
    await atomicWriteJson(notePath, note);
    const index = await this.readIndex(paths.indexPath);
    index.notes = index.notes || {};
    index.notes[id] = noteMetaFromRecord(note);
    await this.writeIndex(paths.indexPath, index);
    if (this.sqlite) this.sqlite.upsertNote.run(paths.role, id, JSON.stringify(index.notes[id]), note.updatedAt);
    await this.#emit('desk.note.updated', { role: paths.role, noteId: id, metadata: index.notes[id] });
    return clone(note);
  }

  async getNote(role = '', id = '') {
    const paths = await this.ensureRole(role);
    const noteId = sanitizeNoteId(id);
    const notePath = path.join(paths.notesDir, `${noteId}.json`);
    return await readJson(notePath, null);
  }

  async listNotes(role = '', { query = '', tags = [], taskId = '' } = {}) {
    const paths = await this.ensureRole(role);
    const index = await this.readIndex(paths.indexPath);
    const needle = String(query || '').trim().toLowerCase();
    const tagSet = new Set(normalizeTags(tags).map((item) => item.toLowerCase()));
    const hits = [];
    for (const meta of Object.values(index.notes || {})) {
      if (taskId && String(meta?.taskId || '') !== String(taskId)) continue;
      if (tagSet.size > 0) {
        const noteTags = new Set(normalizeTags(meta?.tags || []).map((tag) => tag.toLowerCase()));
        let allMatch = true;
        for (const tag of tagSet) if (!noteTags.has(tag)) allMatch = false;
        if (!allMatch) continue;
      }
      const note = await this.getNote(paths.role, meta.id);
      if (!note) continue;
      if (needle) {
        const hay = `${note.title || ''} ${note.body || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      hits.push(note);
    }
    return hits.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).map((item) => clone(item));
  }

  async deleteNote(role = '', id = '') {
    const paths = await this.ensureRole(role);
    const noteId = sanitizeNoteId(id);
    const notePath = path.join(paths.notesDir, `${noteId}.json`);
    const note = await readJson(notePath, null);
    if (!note) return { ok: false, error: 'note_not_found' };
    try { await fsp.unlink(notePath); } catch {}
    const index = await this.readIndex(paths.indexPath);
    if (index.notes) delete index.notes[noteId];
    await this.writeIndex(paths.indexPath, index);
    if (this.sqlite) this.sqlite.deleteNote.run(paths.role, noteId);
    await this.#emit('desk.note.deleted', { role: paths.role, noteId, metadata: noteMetaFromRecord(note) });
    return { ok: true, note: clone(note) };
  }

  async deliverSharedFile({ fromRole = '', toRole = '', name = '', buffer = Buffer.alloc(0), mimeType = '', tags = [], taskId = '', title = '' } = {}) {
    const sourceRole = sanitizeRoleName(fromRole);
    const targetRole = sanitizeRoleName(toRole);
    const sharedName = sanitizeFileName(name || `${sourceRole}-${Date.now()}`);
    const dropbox = await this.ensureCollaborationArea();
    const fileName = `${targetRole}__${sharedName}`;
    const filePath = path.join(dropbox.dropboxDir, fileName);
    await fsp.writeFile(filePath, buffer);
    const stat = await fsp.stat(filePath);
    const index = await this.readIndex(dropbox.indexPath);
    index.files = index.files || {};
    index.files[fileName] = {
      name: fileName,
      originalName: sharedName,
      fromRole: sourceRole,
      toRole: targetRole,
      path: filePath,
      relativePath: path.relative(this.baseDir, filePath),
      mimeType: String(mimeType || detectMimeType(sharedName)),
      size: Number(stat.size || 0),
      tags: normalizeTags(tags),
      taskId: String(taskId || ''),
      title: String(title || sharedName),
      createdAt: this.now(),
      updatedAt: this.now(),
      shared: true,
    };
    await this.writeIndex(dropbox.indexPath, index);
    await this.#emit('desk.shared.delivered', { fromRole: sourceRole, toRole: targetRole, name: fileName, metadata: index.files[fileName] });
    return clone(index.files[fileName]);
  }

  async listSharedInbox(role = '', { query = '', taskId = '' } = {}) {
    const targetRole = sanitizeRoleName(role);
    const dropbox = await this.ensureCollaborationArea();
    const index = await this.readIndex(dropbox.indexPath);
    const needle = String(query || '').trim().toLowerCase();
    return Object.values(index.files || {})
      .filter((item) => String(item?.toRole || '') === targetRole)
      .filter((item) => !taskId || String(item?.taskId || '') === String(taskId))
      .filter((item) => !needle || `${item?.name || ''} ${item?.title || ''} ${(item?.tags || []).join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .map((item) => clone(item));
  }

  watchRole(role = '', onEvent) {
    const paths = this.rolePaths(role);
    const key = paths.role;
    const existing = this.watchers.get(key);
    if (existing) return existing.close;
    const watchTargets = [paths.filesDir, paths.notesDir];
    const listeners = [];
    const notify = (eventType, filename, area) => {
      if (typeof onEvent === 'function') onEvent({ role: paths.role, eventType, filename: String(filename || ''), area, ts: Date.now() });
    };
    const start = async () => {
      await this.ensureRole(paths.role);
      for (const target of watchTargets) {
        const area = target.endsWith('/files') ? 'files' : 'notes';
        const watcher = fs.watch(target, (eventType, filename) => notify(eventType, filename, area));
        listeners.push(watcher);
      }
    };
    void start();
    const close = () => {
      for (const watcher of listeners) {
        try { watcher.close(); } catch {}
      }
      this.watchers.delete(key);
    };
    this.watchers.set(key, { close });
    return close;
  }

  close() {
    for (const item of this.watchers.values()) item?.close?.();
    this.watchers.clear();
    try { this.sqlite?.db?.close?.(); } catch {}
    return { ok: true };
  }
}

export function createDeskStorage(options = {}) {
  return new DeskStorage(options);
}

export default {
  DeskStorage,
  createDeskStorage,
  detectMimeType,
  loadDeskConfig,
};

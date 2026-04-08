import path from 'node:path';
import { createDeskStorage, detectMimeType, loadDeskConfig } from './desk-storage.mjs';

function normalizeTags(tags = []) {
  return [...new Set((Array.isArray(tags) ? tags : [tags]).map((item) => String(item || '').trim()).filter(Boolean))];
}

function ensureBuffer(input = null, encoding = 'utf8') {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === 'string') return Buffer.from(input, encoding);
  return Buffer.alloc(0);
}

export class AgentDesk {
  constructor({ storage = null, eventBus = null, config = {}, logger = console } = {}) {
    this.config = loadDeskConfig(config?.configPath || undefined);
    this.storage = storage || createDeskStorage({ config: { ...this.config, ...(config || {}) }, eventBus, logger });
    this.eventBus = eventBus || null;
    this.logger = logger || console;
  }

  async ensureDesk(role = '') {
    return this.storage.ensureRole(role);
  }

  async uploadFile(role = '', input = {}) {
    const buffer = input?.base64
      ? Buffer.from(String(input.base64 || ''), 'base64')
      : ensureBuffer(input?.buffer ?? input?.content ?? '', input?.encoding || 'utf8');
    const name = String(input?.name || input?.fileName || input?.filename || '').trim();
    if (!name) throw new Error('file_name_required');
    const mimeType = String(input?.mimeType || input?.contentType || detectMimeType(name)).trim();
    return this.storage.putFile(role, {
      name,
      buffer,
      mimeType,
      tags: normalizeTags(input?.tags || []),
      taskId: String(input?.taskId || '').trim(),
      title: String(input?.title || name),
      type: String(input?.type || 'file'),
      sourceRole: String(input?.sourceRole || role),
      shared: !!input?.shared,
    });
  }

  async getFile(role = '', name = '', options = {}) {
    return this.storage.getFile(role, name, options);
  }

  async listFiles(role = '', options = {}) {
    return this.storage.listFiles(role, options);
  }

  async searchFiles(role = '', query = '', options = {}) {
    return this.storage.listFiles(role, { ...options, query });
  }

  async deleteFile(role = '', name = '') {
    return this.storage.deleteFile(role, name);
  }

  async saveNote(role = '', input = {}) {
    return this.storage.putNote(role, input);
  }

  async getNote(role = '', id = '') {
    return this.storage.getNote(role, id);
  }

  async listNotes(role = '', options = {}) {
    return this.storage.listNotes(role, options);
  }

  async searchNotes(role = '', query = '', options = {}) {
    return this.storage.listNotes(role, { ...options, query });
  }

  async deleteNote(role = '', id = '') {
    return this.storage.deleteNote(role, id);
  }

  async deliverSharedFile({ fromRole = '', toRole = '', name = '', buffer = null, base64 = '', mimeType = '', tags = [], taskId = '', title = '' } = {}) {
    const payload = base64 ? Buffer.from(String(base64 || ''), 'base64') : ensureBuffer(buffer);
    const resolvedName = String(name || '').trim() || `shared-${Date.now()}`;
    return this.storage.deliverSharedFile({
      fromRole,
      toRole,
      name: resolvedName,
      buffer: payload,
      mimeType: String(mimeType || detectMimeType(resolvedName)),
      tags: normalizeTags(tags),
      taskId,
      title,
    });
  }

  async listSharedInbox(role = '', options = {}) {
    return this.storage.listSharedInbox(role, options);
  }

  getPaths(role = '') {
    return this.storage.rolePaths(role);
  }

  resolveAbsolutePath(role = '', area = 'files', name = '') {
    const paths = this.getPaths(role);
    if (area === 'notes') return path.join(paths.notesDir, name);
    return path.join(paths.filesDir, name);
  }

  watchDesk(role = '', onEvent) {
    return this.storage.watchRole(role, onEvent);
  }

  close() {
    return this.storage.close();
  }
}

export function createAgentDesk(options = {}) {
  return new AgentDesk(options);
}

export default {
  AgentDesk,
  createAgentDesk,
};

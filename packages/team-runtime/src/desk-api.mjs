import { randomUUID } from 'node:crypto';
import { createAgentDesk } from './agent-desk.mjs';

function sendJson(res, status = 200, payload = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(payload)}\n`);
}

function collectBody(req, maxBytes = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(String(text || '')); } catch { return fallback; }
}

function splitPathname(url = '') {
  const parsed = new URL(String(url || ''), 'http://127.0.0.1');
  return parsed.pathname.split('/').filter(Boolean);
}

function parseQuery(url = '') {
  const parsed = new URL(String(url || ''), 'http://127.0.0.1');
  return parsed.searchParams;
}

function normalizeTagsParam(value = '') {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function buildDownloadHeaders(meta = {}) {
  return {
    'content-type': String(meta?.mimeType || 'application/octet-stream'),
    'content-length': String(meta?.size || 0),
    'content-disposition': `inline; filename="${String(meta?.name || 'file').replace(/"/g, '_')}"`,
  };
}

export function createDeskApi({ desk = null, eventBus = null, config = {}, logger = console } = {}) {
  const runtimeDesk = desk || createAgentDesk({ eventBus, config, logger });

  async function handleListFiles(req, res, role) {
    const query = parseQuery(req.url);
    const items = await runtimeDesk.listFiles(role, {
      query: query.get('q') || '',
      taskId: query.get('taskId') || '',
      tags: normalizeTagsParam(query.get('tags') || ''),
      shared: query.get('shared') == null ? null : ['1', 'true', 'yes'].includes(String(query.get('shared')).toLowerCase()),
    });
    sendJson(res, 200, { ok: true, items });
  }

  async function handleGetFile(_req, res, role, name) {
    const file = await runtimeDesk.getFile(role, name, { withContent: true });
    if (!file) return sendJson(res, 404, { ok: false, error: 'file_not_found' });
    res.writeHead(200, buildDownloadHeaders(file));
    res.end(file.buffer);
  }

  async function handleUploadFile(req, res, role) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const body = await collectBody(req, Number(config?.limits?.maxFileSizeBytes || 55 * 1024 * 1024));

    if (contentType.includes('application/json')) {
      const payload = safeJsonParse(body.toString('utf8'), null);
      if (!payload) return sendJson(res, 400, { ok: false, error: 'invalid_json' });
      const item = await runtimeDesk.uploadFile(role, payload);
      return sendJson(res, 201, { ok: true, item });
    }

    const headerName = String(req.headers['x-file-name'] || req.headers['x-filename'] || '').trim();
    if (!headerName) return sendJson(res, 400, { ok: false, error: 'x_file_name_required_for_binary_upload' });
    const tags = normalizeTagsParam(String(req.headers['x-file-tags'] || ''));
    const item = await runtimeDesk.uploadFile(role, {
      name: headerName,
      buffer: body,
      mimeType: contentType.split(';')[0] || 'application/octet-stream',
      taskId: String(req.headers['x-task-id'] || ''),
      tags,
      title: String(req.headers['x-file-title'] || headerName),
      sourceRole: String(req.headers['x-source-role'] || role),
    });
    return sendJson(res, 201, { ok: true, item });
  }

  async function handleDeleteFile(_req, res, role, name) {
    const result = await runtimeDesk.deleteFile(role, name);
    sendJson(res, result.ok ? 200 : 404, result.ok ? result : { ok: false, error: result.error || 'file_not_found' });
  }

  async function handleListNotes(req, res, role) {
    const query = parseQuery(req.url);
    const items = await runtimeDesk.listNotes(role, {
      query: query.get('q') || '',
      taskId: query.get('taskId') || '',
      tags: normalizeTagsParam(query.get('tags') || ''),
    });
    sendJson(res, 200, { ok: true, items });
  }

  async function handleUpsertNote(req, res, role) {
    const body = await collectBody(req, Number(config?.limits?.maxNoteSizeBytes || 3 * 1024 * 1024));
    const payload = safeJsonParse(body.toString('utf8'), null);
    if (!payload) return sendJson(res, 400, { ok: false, error: 'invalid_json' });
    const note = await runtimeDesk.saveNote(role, {
      id: payload.id || `note-${randomUUID()}`,
      title: payload.title || '',
      body: payload.body || payload.content || '',
      tags: payload.tags || [],
      taskId: payload.taskId || '',
    });
    sendJson(res, 201, { ok: true, item: note });
  }

  async function handleDeleteNote(_req, res, role, id) {
    const result = await runtimeDesk.deleteNote(role, id);
    sendJson(res, result.ok ? 200 : 404, result.ok ? result : { ok: false, error: result.error || 'note_not_found' });
  }

  async function handleRequest(req, res) {
    const parts = splitPathname(req.url);
    if (parts[0] !== 'desks') return false;
    const role = parts[1] || '';
    const area = parts[2] || '';
    const item = parts[3] || '';

    try {
      if (req.method === 'GET' && area === 'files' && !item) { await handleListFiles(req, res, role); return true; }
      if (req.method === 'GET' && area === 'files' && item) { await handleGetFile(req, res, role, decodeURIComponent(item)); return true; }
      if (req.method === 'POST' && area === 'files' && !item) { await handleUploadFile(req, res, role); return true; }
      if (req.method === 'DELETE' && area === 'files' && item) { await handleDeleteFile(req, res, role, decodeURIComponent(item)); return true; }
      if (req.method === 'GET' && area === 'notes' && !item) { await handleListNotes(req, res, role); return true; }
      if (req.method === 'POST' && area === 'notes' && !item) { await handleUpsertNote(req, res, role); return true; }
      if (req.method === 'DELETE' && area === 'notes' && item) { await handleDeleteNote(req, res, role, decodeURIComponent(item)); return true; }
      return false;
    } catch (error) {
      logger?.error?.('[desk-api] request failed', error);
      sendJson(res, error?.message === 'body_too_large' ? 413 : 400, { ok: false, error: String(error?.message || error || 'desk_api_failed') });
      return true;
    }
  }

  return {
    desk: runtimeDesk,
    handleRequest,
  };
}

export function tryHandleDeskApiRoute(req, res, ctx = {}) {
  if (!ctx?.deskApi?.handleRequest) return false;
  void ctx.deskApi.handleRequest(req, res);
  return true;
}

export default {
  createDeskApi,
  tryHandleDeskApiRoute,
};

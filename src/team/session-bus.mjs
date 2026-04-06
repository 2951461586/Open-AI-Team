import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createEventBus } from './event-bus.mjs';
import { TEAM_EVENT_TYPES, createSessionId } from './event-types.mjs';

async function ensureDirFor(filePath = '') {
  const dir = path.dirname(String(filePath || ''));
  if (!dir || dir === '.' || dir === '/') return;
  await fsp.mkdir(dir, { recursive: true });
}

function clone(v) {
  return JSON.parse(JSON.stringify(v ?? null));
}

function nowIso() {
  return new Date().toISOString();
}

function makeChannelKey(channel = '', nativeUserId = '') {
  return `${String(channel || '').trim()}::${String(nativeUserId || '').trim()}`;
}

export class SessionBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(Number(options?.maxListeners || 100));
    this.storePath = String(options?.storePath || path.resolve('state/session-bus.json'));
    this.eventBus = options?.eventBus || createEventBus({
      logPath: path.resolve('state/team-events.jsonl'),
    });
    this.sessions = new Map();
    this.aliases = new Map();
    this._ready = this.load();
  }

  async load() {
    try {
      if (!fs.existsSync(this.storePath)) return { ok: true, loaded: 0 };
      const raw = await fsp.readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(String(raw || '{}'));
      const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
      const aliases = Array.isArray(parsed?.aliases) ? parsed.aliases : [];
      this.sessions.clear();
      this.aliases.clear();
      for (const item of sessions) {
        if (!item?.sessionId) continue;
        this.sessions.set(String(item.sessionId), item);
      }
      for (const item of aliases) {
        if (!item?.aliasKey || !item?.sessionId) continue;
        this.aliases.set(String(item.aliasKey), String(item.sessionId));
      }
      return { ok: true, loaded: this.sessions.size };
    } catch (err) {
      this.emit('session:error', { error: String(err?.message || err), stage: 'load' });
      return { ok: false, error: String(err?.message || err) };
    }
  }

  async persist() {
    await ensureDirFor(this.storePath);
    const payload = {
      version: 1,
      savedAt: nowIso(),
      sessions: [...this.sessions.values()],
      aliases: [...this.aliases.entries()].map(([aliasKey, sessionId]) => ({ aliasKey, sessionId })),
    };
    const tmp = `${this.storePath}.tmp-${process.pid}-${Date.now()}`;
    await fsp.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fsp.rename(tmp, this.storePath);
    this.emit('session:persisted', { storePath: this.storePath, count: this.sessions.size });
    return { ok: true, storePath: this.storePath, count: this.sessions.size };
  }

  async ensureReady() {
    return await this._ready;
  }

  async createSession(input = {}) {
    await this.ensureReady();
    const sessionId = String(input?.sessionId || createSessionId());
    const channel = String(input?.channel || '').trim();
    const nativeUserId = String(input?.nativeUserId || input?.channelUserId || '').trim();
    const userId = String(input?.userId || nativeUserId || '').trim();
    const existingAlias = channel && nativeUserId ? this.aliases.get(makeChannelKey(channel, nativeUserId)) : '';
    if (existingAlias && this.sessions.has(existingAlias)) {
      return { ok: true, created: false, session: clone(this.sessions.get(existingAlias)) };
    }

    const session = {
      sessionId,
      canonicalSessionId: String(input?.canonicalSessionId || sessionId),
      userId,
      channel,
      nativeUserId,
      status: String(input?.status || 'active'),
      state: (input?.state && typeof input.state === 'object' && !Array.isArray(input.state)) ? { ...input.state } : {},
      metadata: (input?.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)) ? { ...input.metadata } : {},
      linkedSessionIds: Array.isArray(input?.linkedSessionIds) ? [...new Set(input.linkedSessionIds.map(String))] : [],
      createdAt: String(input?.createdAt || nowIso()),
      updatedAt: String(input?.updatedAt || nowIso()),
      lastChannelAt: String(input?.lastChannelAt || nowIso()),
    };

    this.sessions.set(sessionId, session);
    if (channel && nativeUserId) this.aliases.set(makeChannelKey(channel, nativeUserId), sessionId);
    await this.persist();
    this.emit('session:created', clone(session));
    void this.eventBus.publish({
      type: TEAM_EVENT_TYPES.SESSION_CREATED,
      sessionId,
      userId,
      important: true,
      payload: { sessionId, userId, channel, nativeUserId },
    });
    return { ok: true, created: true, session: clone(session) };
  }

  getSession(sessionId = '') {
    const session = this.sessions.get(String(sessionId || ''));
    return session ? clone(session) : null;
  }

  findSessionByChannel(channel = '', nativeUserId = '') {
    const foundId = this.aliases.get(makeChannelKey(channel, nativeUserId));
    return foundId ? this.getSession(foundId) : null;
  }

  listSessionsByUser(userId = '') {
    const uid = String(userId || '').trim();
    return [...this.sessions.values()]
      .filter((item) => String(item?.userId || '') === uid)
      .map((item) => clone(item));
  }

  async syncState(sessionId = '', patch = {}, options = {}) {
    await this.ensureReady();
    const current = this.sessions.get(String(sessionId || ''));
    if (!current) return { ok: false, error: 'session_not_found' };
    const next = {
      ...current,
      state: {
        ...(current.state || {}),
        ...((patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {}),
      },
      updatedAt: nowIso(),
      lastChannelAt: options?.touchChannel === false ? current.lastChannelAt : nowIso(),
    };
    this.sessions.set(next.sessionId, next);
    await this.persist();
    this.emit('session:updated', clone(next));
    void this.eventBus.publish({
      type: TEAM_EVENT_TYPES.SESSION_UPDATED,
      sessionId: next.sessionId,
      userId: next.userId,
      payload: { sessionId: next.sessionId, patch, channel: next.channel },
    });
    return { ok: true, session: clone(next) };
  }

  async linkSessions(primarySessionId = '', secondarySessionId = '', options = {}) {
    await this.ensureReady();
    const a = this.sessions.get(String(primarySessionId || ''));
    const b = this.sessions.get(String(secondarySessionId || ''));
    if (!a || !b) return { ok: false, error: 'session_not_found' };

    const canonical = String(options?.canonicalSessionId || a.canonicalSessionId || a.sessionId);
    const applyLink = (session) => ({
      ...session,
      canonicalSessionId: canonical,
      linkedSessionIds: [...new Set([...(session.linkedSessionIds || []), a.sessionId, b.sessionId].filter((id) => id !== session.sessionId))],
      updatedAt: nowIso(),
    });

    const nextA = applyLink(a);
    const nextB = applyLink(b);
    this.sessions.set(nextA.sessionId, nextA);
    this.sessions.set(nextB.sessionId, nextB);
    await this.persist();
    this.emit('session:linked', { canonicalSessionId: canonical, sessions: [clone(nextA), clone(nextB)] });
    void this.eventBus.publish({
      type: TEAM_EVENT_TYPES.SESSION_LINKED,
      sessionId: canonical,
      userId: nextA.userId || nextB.userId,
      important: true,
      payload: {
        canonicalSessionId: canonical,
        linkedSessionId: nextB.sessionId,
        primarySessionId: nextA.sessionId,
        secondarySessionId: nextB.sessionId,
      },
    });
    return { ok: true, canonicalSessionId: canonical, sessions: [clone(nextA), clone(nextB)] };
  }

  async switchSession(fromSessionId = '', toSessionId = '', options = {}) {
    await this.ensureReady();
    const from = this.sessions.get(String(fromSessionId || ''));
    const to = this.sessions.get(String(toSessionId || ''));
    if (!from || !to) return { ok: false, error: 'session_not_found' };

    const reason = String(options?.reason || 'manual_switch');
    const fromNext = { ...from, status: 'inactive', updatedAt: nowIso() };
    const toNext = { ...to, status: 'active', updatedAt: nowIso(), lastChannelAt: nowIso() };
    this.sessions.set(fromNext.sessionId, fromNext);
    this.sessions.set(toNext.sessionId, toNext);
    await this.persist();
    this.emit('session:switched', { from: clone(fromNext), to: clone(toNext), reason });
    void this.eventBus.publish({
      type: TEAM_EVENT_TYPES.SESSION_SWITCHED,
      sessionId: toNext.sessionId,
      userId: toNext.userId,
      important: true,
      payload: { fromSessionId, toSessionId, reason },
    });
    return { ok: true, from: clone(fromNext), to: clone(toNext), reason };
  }

  async migrateSession(fromSessionId = '', target = {}) {
    await this.ensureReady();
    const from = this.sessions.get(String(fromSessionId || ''));
    if (!from) return { ok: false, error: 'session_not_found' };

    const toSessionId = String(target?.sessionId || createSessionId());
    const toChannel = String(target?.channel || from.channel || '').trim();
    const toNativeUserId = String(target?.nativeUserId || from.nativeUserId || '').trim();

    const migrated = {
      ...from,
      sessionId: toSessionId,
      canonicalSessionId: String(from.canonicalSessionId || from.sessionId),
      channel: toChannel,
      nativeUserId: toNativeUserId,
      status: String(target?.status || 'active'),
      metadata: {
        ...(from.metadata || {}),
        migratedFrom: from.sessionId,
        migratedAt: nowIso(),
        ...(target?.metadata && typeof target.metadata === 'object' && !Array.isArray(target.metadata) ? target.metadata : {}),
      },
      linkedSessionIds: [...new Set([...(from.linkedSessionIds || []), from.sessionId])],
      updatedAt: nowIso(),
      lastChannelAt: nowIso(),
    };

    this.sessions.set(toSessionId, migrated);
    if (toChannel && toNativeUserId) this.aliases.set(makeChannelKey(toChannel, toNativeUserId), toSessionId);
    await this.persist();
    this.emit('session:migrated', { from: clone(from), to: clone(migrated) });
    void this.eventBus.publish({
      type: TEAM_EVENT_TYPES.SESSION_MIGRATED,
      sessionId: migrated.sessionId,
      userId: migrated.userId,
      important: true,
      payload: {
        fromSessionId: from.sessionId,
        toSessionId: migrated.sessionId,
        fromChannel: from.channel,
        toChannel: migrated.channel,
      },
    });
    return { ok: true, from: clone(from), to: clone(migrated) };
  }

  async upsertChannelSession(input = {}) {
    await this.ensureReady();
    const channel = String(input?.channel || '').trim();
    const nativeUserId = String(input?.nativeUserId || input?.channelUserId || '').trim();
    if (!channel || !nativeUserId) return { ok: false, error: 'channel_and_native_user_id_required' };
    const existing = this.findSessionByChannel(channel, nativeUserId);
    if (existing) {
      if (input?.state && typeof input.state === 'object' && !Array.isArray(input.state)) {
        return await this.syncState(existing.sessionId, input.state, { touchChannel: true });
      }
      return { ok: true, created: false, session: existing };
    }
    return await this.createSession(input);
  }

  listAllSessions() {
    return [...this.sessions.values()].map((item) => clone(item));
  }
}

export function createSessionBus(options = {}) {
  return new SessionBus(options);
}

export default {
  SessionBus,
  createSessionBus,
};

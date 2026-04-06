import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  createEventEnvelope,
  createHandlerMatcher,
  validateEventShape,
  TEAM_EVENT_TYPES,
} from './event-types.mjs';

function noop() {}

async function ensureDirFor(filePath = '') {
  const dir = path.dirname(String(filePath || ''));
  if (!dir || dir === '.' || dir === '/') return;
  await fsp.mkdir(dir, { recursive: true });
}

function parseJsonLine(line = '') {
  const text = String(line || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function defaultPersistDecider(event) {
  return !!(event?.important || event?.visibility === 'audit' || event?.priority === 'critical');
}

export class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(Number(options?.maxListeners || 100));
    this.logPath = String(options?.logPath || path.resolve('state/team-events.jsonl'));
    this.persistEvent = typeof options?.persistEvent === 'function' ? options.persistEvent : defaultPersistDecider;
    this.onError = typeof options?.onError === 'function' ? options.onError : noop;
    this.routeHandlers = new Map();
    this.subscriptions = new Map();
    this.processing = new Set();
    this._closed = false;
  }

  subscribe(typeOrPattern, handler, options = {}) {
    if (typeof handler !== 'function') throw new TypeError('event_handler_required');
    const id = String(options?.id || `sub:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
    const matcher = createHandlerMatcher(typeOrPattern);
    const subscription = {
      id,
      matcher,
      handler,
      once: !!options?.once,
      async: options?.async !== false,
      pattern: String(typeOrPattern || '*'),
    };
    this.subscriptions.set(id, subscription);
    return () => this.unsubscribe(id);
  }

  onceEvent(typeOrPattern, handler, options = {}) {
    return this.subscribe(typeOrPattern, handler, { ...options, once: true });
  }

  unsubscribe(id = '') {
    return this.subscriptions.delete(String(id || ''));
  }

  route(typeOrPattern, handler, options = {}) {
    if (typeof handler !== 'function') throw new TypeError('route_handler_required');
    const key = String(options?.id || `route:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
    this.routeHandlers.set(key, {
      id: key,
      matcher: createHandlerMatcher(typeOrPattern),
      handler,
      pattern: String(typeOrPattern || '*'),
    });
    return () => this.routeHandlers.delete(key);
  }

  async publish(input = {}) {
    if (this._closed) return { ok: false, error: 'event_bus_closed' };

    const event = createEventEnvelope(input);
    const validation = validateEventShape(event);
    if (!validation.ok) {
      const error = new Error(`invalid_event:${validation.issues.join(',')}`);
      this.onError(error, event);
      this.emit('event:error', { event, validation, error });
      return { ok: false, error: error.message, validation };
    }

    if (this.persistEvent(event)) {
      void this.persist(event).catch((err) => this.onError(err, event));
    }

    this.emit('event', event);
    this.emit(`event:${event.type}`, event);

    const tasks = [];

    for (const route of this.routeHandlers.values()) {
      if (!route.matcher(event)) continue;
      tasks.push(this.#invokeHandler(route.handler, event, { bucket: 'route', id: route.id }));
    }

    for (const sub of [...this.subscriptions.values()]) {
      if (!sub.matcher(event)) continue;
      tasks.push(this.#invokeHandler(sub.handler, event, { bucket: 'subscription', id: sub.id }));
      if (sub.once) this.subscriptions.delete(sub.id);
    }

    queueMicrotask(() => {
      this.emit('event:dispatched', {
        event,
        handlers: tasks.length,
      });
    });

    return {
      ok: true,
      event,
      dispatched: tasks.length,
      pending: Promise.allSettled(tasks),
    };
  }

  async persist(event = {}) {
    const line = `${JSON.stringify(event)}\n`;
    await ensureDirFor(this.logPath);
    await fsp.appendFile(this.logPath, line, 'utf8');
    this.emit('event:persisted', event);
    return { ok: true, path: this.logPath };
  }

  async replay(options = {}) {
    const logPath = String(options?.logPath || this.logPath);
    const filter = typeof options?.filter === 'function' ? options.filter : () => true;
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options.limit) : Infinity;
    const includeReplayMeta = options?.includeReplayMeta !== false;

    if (!fs.existsSync(logPath)) {
      return { ok: true, logPath, replayed: 0, events: [] };
    }

    const raw = await fsp.readFile(logPath, 'utf8');
    const lines = String(raw || '').split(/\r?\n/);
    const replayed = [];

    for (const line of lines) {
      if (replayed.length >= limit) break;
      const parsed = parseJsonLine(line);
      if (!parsed || !filter(parsed)) continue;
      const event = includeReplayMeta
        ? createEventEnvelope({
            ...parsed,
            replay: true,
            causationId: parsed.id || '',
            type: parsed.type || TEAM_EVENT_TYPES.EVENT_REPLAYED,
            meta: {
              ...(parsed.meta || {}),
              replayedFrom: parsed.id || '',
              replayLogPath: logPath,
            },
          })
        : { ...parsed, replay: true };
      replayed.push(event);
      void this.publish(event).catch((err) => this.onError(err, event));
    }

    return { ok: true, logPath, replayed: replayed.length, events: replayed };
  }

  listSubscriptions() {
    return [...this.subscriptions.values()].map((item) => ({
      id: item.id,
      once: item.once,
      async: item.async,
      pattern: item.pattern,
    }));
  }

  listRoutes() {
    return [...this.routeHandlers.values()].map((item) => ({
      id: item.id,
      pattern: item.pattern,
    }));
  }

  close() {
    this._closed = true;
    this.subscriptions.clear();
    this.routeHandlers.clear();
    this.removeAllListeners();
    return { ok: true };
  }

  async #invokeHandler(handler, event, meta = {}) {
    const token = `${meta.bucket || 'handler'}:${meta.id || 'unknown'}:${event.id}`;
    this.processing.add(token);
    try {
      return await Promise.resolve().then(() => handler(event, meta, this));
    } catch (err) {
      this.onError(err, event);
      this.emit('event:handler_error', { event, meta, error: String(err?.message || err) });
      return { ok: false, error: String(err?.message || err) };
    } finally {
      this.processing.delete(token);
    }
  }
}

export function createEventBus(options = {}) {
  return new EventBus(options);
}

export default {
  EventBus,
  createEventBus,
};

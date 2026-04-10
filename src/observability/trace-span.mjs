import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { FileTraceExporter } from './trace-exporter.mjs';
import { LangSmithExporter } from './langsmith-exporter.mjs';
import { LangfuseExporter } from './langfuse-exporter.mjs';

function normalizeStatus(status = 'ok') {
  return String(status || 'ok').toLowerCase() === 'error' ? 'error' : 'ok';
}

function normalizeAttributes(attributes = {}) {
  return attributes && typeof attributes === 'object' && !Array.isArray(attributes) ? { ...attributes } : {};
}

function toTimestamp(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function ensureDirSync(filePath = '') {
  const dir = path.dirname(String(filePath || ''));
  if (!dir || dir === '.' || dir === '/') return;
  fs.mkdirSync(dir, { recursive: true });
}

function parseJsonLine(line = '') {
  const text = String(line || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export class TraceSpan {
  constructor({ traceId = randomUUID(), spanId = randomUUID(), parentSpanId = '', operationName = '', startTime = new Date(), endTime = null, duration = 0, status = 'ok', attributes = {}, events = [] } = {}) {
    this.traceId = String(traceId || randomUUID());
    this.spanId = String(spanId || randomUUID());
    this.parentSpanId = String(parentSpanId || '');
    this.operationName = String(operationName || '');
    this.startTime = toTimestamp(startTime);
    this.endTime = endTime ? toTimestamp(endTime) : null;
    this.duration = Number(duration || 0);
    this.status = normalizeStatus(status);
    this.attributes = normalizeAttributes(attributes);
    this.events = Array.isArray(events) ? [...events] : [];
  }

  addEvent(name = '', attributes = {}) {
    const event = {
      timestamp: toTimestamp(),
      name: String(name || 'event'),
      attributes: normalizeAttributes(attributes),
    };
    this.events.push(event);
    return event;
  }

  end(status = 'ok', attributes = {}) {
    const endTime = new Date();
    this.endTime = toTimestamp(endTime);
    this.duration = Math.max(0, new Date(this.endTime).getTime() - new Date(this.startTime).getTime());
    this.status = normalizeStatus(status);
    this.attributes = { ...this.attributes, ...normalizeAttributes(attributes) };
    return this;
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      operationName: this.operationName,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
    };
  }
}

export class TraceContext {
  constructor({ traceId = '', spanId = '', parentSpanId = '' } = {}) {
    this.traceId = String(traceId || '');
    this.spanId = String(spanId || '');
    this.parentSpanId = String(parentSpanId || '');
  }

  static fromSpan(span = null) {
    if (!span) return null;
    return new TraceContext({ traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId });
  }
}

export class MultiTraceExporter {
  constructor(options = {}) {
    this.exporters = [];
    this.defaultExporter = null;
    this.addExporter(new FileTraceExporter(String(options?.traceLogPath || path.resolve(process.cwd(), 'state/observability/traces.jsonl'))));

    if (options?.langsmith?.enabled !== false && options?.langsmith?.apiKey) {
      this.addExporter(new LangSmithExporter(options.langsmith));
    }
    if (options?.langfuse?.enabled !== false && options?.langfuse?.publicKey) {
      this.addExporter(new LangfuseExporter(options.langfuse));
    }
  }

  addExporter(exporter) {
    if (!exporter) return;
    this.exporters.push(exporter);
    if (!this.defaultExporter) {
      this.defaultExporter = exporter;
    }
  }

  async export(spans = [], options = {}) {
    if (spans.length === 0) {
      return { ok: true, count: 0, skipped: true };
    }

    const results = await Promise.allSettled(
      this.exporters.map((exporter) => exporter.export(spans, options))
    );

    const ok = results.every((r) => r.status === 'fulfilled' && r.value?.ok);
    const totalCount = results.reduce((sum, r) => sum + (r.value?.count || 0), 0);
    const errors = results
      .filter((r) => r.status === 'rejected' || !r.value?.ok)
      .map((r) => (r.status === 'rejected' ? r.reason?.message || r.reason : r.value?.error));

    return {
      ok,
      count: totalCount,
      errors: errors.filter(Boolean),
      details: results.map((r, i) => ({
        exporter: this.exporters[i]?.constructor?.name || 'unknown',
        status: r.status,
        result: r.status === 'fulfilled' ? r.value : r.reason?.message,
      })),
    };
  }

  async flush() {
    const results = await Promise.allSettled(this.exporters.map((exporter) => exporter.flush?.()));
    return {
      ok: results.every((r) => r.status === 'fulfilled'),
      results: results.map((r, i) => ({
        exporter: this.exporters[i]?.constructor?.name || 'unknown',
        result: r.status === 'fulfilled' ? r.value : r.reason?.message,
      })),
    };
  }

  getExporter(index = 0) {
    return this.exporters[index] || null;
  }

  getDefaultExporter() {
    return this.defaultExporter;
  }
}

export class TraceCollector {
  constructor(options = {}) {
    this.buffer = [];
    this.spansById = new Map();
    this.activeSpans = new Map();
    this.storage = options?.storage || new AsyncLocalStorage();
    this.flushIntervalMs = Math.max(0, Number(options?.flushIntervalMs || 0));
    this.maxBufferSize = Math.max(1, Number(options?.maxBufferSize || 100));

    if (options?.multiExporter) {
      this.multiExporter = options.multiExporter;
    } else {
      this.multiExporter = new MultiTraceExporter(options);
    }

    if (options?.exporter && !options?.multiExporter) {
      this.multiExporter.addExporter(options.exporter);
    }

    const defaultExporter = this.multiExporter.getDefaultExporter();
    this.traceLogPath = defaultExporter?.filePath || String(options?.traceLogPath || path.resolve(process.cwd(), 'state/observability/traces.jsonl'));
    ensureDirSync(this.traceLogPath);
    this.flushTimer = null;
    if (this.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => { void this.flush(); }, this.flushIntervalMs);
      this.flushTimer.unref?.();
    }
  }

  addExporter(exporter) {
    if (!exporter) return;
    this.multiExporter.addExporter(exporter);
  }

  getExporters() {
    return this.multiExporter.exporters;
  }

  startSpan(operationName = '', parentContext = null, attributes = {}) {
    const currentContext = parentContext || this.getCurrentSpan();
    const traceId = currentContext?.traceId || randomUUID();
    const parentSpanId = currentContext?.spanId || '';
    const span = new TraceSpan({
      traceId,
      parentSpanId,
      operationName,
      attributes: normalizeAttributes(attributes),
    });
    this.activeSpans.set(span.spanId, span);
    this.spansById.set(span.spanId, span);
    this.storage.enterWith(TraceContext.fromSpan(span));
    return span;
  }

  withSpan(operationName = '', fn, options = {}) {
    const parentContext = options?.parentContext || this.getCurrentSpan();
    const span = this.startSpan(operationName, parentContext, options?.attributes || {});
    const ctx = TraceContext.fromSpan(span);
    return this.storage.run(ctx, async () => {
      try {
        const result = await fn(span, ctx);
        this.endSpan(span.spanId, 'ok', options?.endAttributes || {});
        return result;
      } catch (error) {
        span.addEvent('exception', {
          name: error?.name || 'Error',
          message: String(error?.message || error || ''),
          stack: String(error?.stack || ''),
        });
        this.endSpan(span.spanId, 'error', {
          ...(options?.errorAttributes || {}),
          errorName: error?.name || 'Error',
          errorMessage: String(error?.message || error || ''),
        });
        throw error;
      }
    });
  }

  endSpan(spanId = '', status = 'ok', attributes = {}) {
    const span = this.activeSpans.get(String(spanId || '')) || this.spansById.get(String(spanId || ''));
    if (!span) return null;
    span.end(status, attributes);
    this.activeSpans.delete(span.spanId);
    this.buffer.push(span.toJSON());
    if (this.buffer.length >= this.maxBufferSize) void this.flush();
    const current = this.getCurrentSpan();
    if (current?.spanId === span.spanId) {
      const parentSpan = span.parentSpanId ? this.spansById.get(span.parentSpanId) : null;
      this.storage.enterWith(TraceContext.fromSpan(parentSpan));
    }
    return span.toJSON();
  }

  annotateCurrentSpan(eventName = '', attributes = {}) {
    const current = this.getCurrentSpan();
    if (!current?.spanId) return null;
    const span = this.activeSpans.get(current.spanId) || this.spansById.get(current.spanId);
    if (!span) return null;
    return span.addEvent(eventName, attributes);
  }

  getCurrentSpan() {
    return this.storage.getStore() || null;
  }

  exportSpans() {
    return [...this.buffer].map((span) => ({ ...span, attributes: { ...(span.attributes || {}) }, events: Array.isArray(span.events) ? [...span.events] : [] }));
  }

  async flush(options = {}) {
    if (this.buffer.length === 0) return { ok: true, count: 0, skipped: true };
    const spans = this.buffer.splice(0, this.buffer.length);
    return this.multiExporter.export(spans, options);
  }

  async close() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.multiExporter.flush();
    return this.flush();
  }

  async queryByTraceId(traceId = '') {
    const normalized = String(traceId || '').trim();
    const spans = await this.readPersistedSpans();
    const matched = spans.filter((span) => String(span.traceId || '') === normalized);
    return {
      ok: true,
      traceId: normalized,
      spans: matched,
      tree: buildTraceTree(matched),
    };
  }

  async listRecent(limit = 50) {
    const spans = await this.readPersistedSpans();
    const groups = new Map();
    for (const span of spans) {
      const key = String(span.traceId || '');
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(span);
    }
    const traces = [...groups.entries()].map(([traceId, items]) => {
      const sorted = items.slice().sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
      const root = sorted.find((item) => !item.parentSpanId) || sorted[0] || {};
      const endTime = sorted.reduce((latest, item) => String(item.endTime || item.startTime || '') > String(latest) ? String(item.endTime || item.startTime || '') : latest, String(root.endTime || root.startTime || ''));
      return {
        traceId,
        rootOperationName: String(root.operationName || ''),
        status: sorted.some((item) => String(item.status || '') === 'error') ? 'error' : 'ok',
        spanCount: sorted.length,
        startTime: String(root.startTime || ''),
        endTime,
        tree: buildTraceTree(sorted),
      };
    });
    traces.sort((a, b) => String(b.startTime || '').localeCompare(String(a.startTime || '')));
    return { ok: true, traces: traces.slice(0, Math.max(1, Number(limit || 50))) };
  }

  async readPersistedSpans() {
    const persisted = [];
    if (this.traceLogPath && fs.existsSync(this.traceLogPath)) {
      const raw = await fsp.readFile(this.traceLogPath, 'utf8').catch(() => '');
      for (const line of String(raw || '').split(/\r?\n/)) {
        const parsed = parseJsonLine(line);
        if (parsed) persisted.push(parsed);
      }
    }
    return [...persisted, ...this.exportSpans()];
  }
}

export function buildTraceTree(spans = []) {
  const nodes = new Map();
  for (const span of spans) {
    const normalized = {
      ...span,
      children: [],
    };
    nodes.set(String(normalized.spanId || ''), normalized);
  }
  const roots = [];
  for (const node of nodes.values()) {
    const parentId = String(node.parentSpanId || '');
    if (parentId && nodes.has(parentId)) nodes.get(parentId).children.push(node);
    else roots.push(node);
  }
  const sortTree = (items = []) => items.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || ''))).map((item) => ({ ...item, children: sortTree(item.children || []) }));
  return sortTree(roots);
}

export function createTraceCollector(options = {}) {
  return new TraceCollector(options);
}

export function createMultiTraceExporter(options = {}) {
  return new MultiTraceExporter(options);
}

export default {
  TraceSpan,
  TraceContext,
  TraceCollector,
  MultiTraceExporter,
  buildTraceTree,
  createTraceCollector,
  createMultiTraceExporter,
};

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function ensureDirSync(filePath = '') {
  const dir = path.dirname(String(filePath || ''));
  if (!dir || dir === '.' || dir === '/') return;
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeStatus(status = 'ok') {
  return String(status || 'ok').toLowerCase() === 'error' ? 'error' : 'ok';
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export class TraceExporter {
  async export(_spans = []) {
    throw new Error('trace_exporter_not_implemented');
  }

  formatSpan(span = {}) {
    return {
      traceId: String(span.traceId || ''),
      spanId: String(span.spanId || ''),
      parentSpanId: String(span.parentSpanId || ''),
      operationName: String(span.operationName || ''),
      startTime: toIso(span.startTime),
      endTime: span.endTime ? toIso(span.endTime) : null,
      duration: Number(span.duration || 0),
      status: normalizeStatus(span.status),
      attributes: span.attributes && typeof span.attributes === 'object' ? span.attributes : {},
      events: Array.isArray(span.events) ? span.events : [],
    };
  }

  toLangfuseSpan(span = {}) {
    const formatted = this.formatSpan(span);
    return {
      id: formatted.spanId,
      traceId: formatted.traceId,
      parentObservationId: formatted.parentSpanId || null,
      name: formatted.operationName,
      startTime: formatted.startTime,
      endTime: formatted.endTime,
      input: formatted.attributes?.input ?? null,
      output: formatted.attributes?.output ?? null,
      level: formatted.status === 'error' ? 'ERROR' : 'DEFAULT',
      statusMessage: formatted.attributes?.errorMessage || '',
      metadata: {
        ...formatted.attributes,
        durationMs: formatted.duration,
        events: formatted.events,
      },
      type: 'span',
    };
  }

  formatSpans(spans = [], options = {}) {
    const target = String(options?.format || 'internal').trim().toLowerCase();
    if (target === 'langfuse' || target === 'otel' || target === 'opentelemetry') {
      return spans.map((span) => this.toLangfuseSpan(span));
    }
    return spans.map((span) => this.formatSpan(span));
  }
}

export class FileTraceExporter extends TraceExporter {
  constructor(filePath = '', options = {}) {
    super();
    this.filePath = String(filePath || path.resolve(process.cwd(), 'state/observability/traces.jsonl'));
    this.format = String(options?.format || 'internal');
    ensureDirSync(this.filePath);
  }

  async export(spans = [], options = {}) {
    const rows = this.formatSpans(spans, { format: options?.format || this.format });
    if (rows.length === 0) return { ok: true, count: 0, path: this.filePath, skipped: true };
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    const content = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
    await fsp.appendFile(this.filePath, content, 'utf8');
    return { ok: true, count: rows.length, path: this.filePath, format: options?.format || this.format };
  }
}

export class ConsoleTraceExporter extends TraceExporter {
  constructor(options = {}) {
    super();
    this.logger = options?.logger || console;
    this.format = String(options?.format || 'internal');
  }

  async export(spans = [], options = {}) {
    const rows = this.formatSpans(spans, { format: options?.format || this.format });
    for (const row of rows) this.logger.log('[trace]', JSON.stringify(row));
    return { ok: true, count: rows.length, target: 'console', format: options?.format || this.format };
  }
}

export default {
  TraceExporter,
  FileTraceExporter,
  ConsoleTraceExporter,
};

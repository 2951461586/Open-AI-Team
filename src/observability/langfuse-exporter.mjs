export class LangfuseExporter {
  constructor(options = {}) {
    this.publicKey = String(options.publicKey || process.env.LANGFUSE_PUBLIC_KEY || '');
    this.secretKey = String(options.secretKey || process.env.LANGFUSE_SECRET_KEY || '');
    this.baseUrl = String(options.baseUrl || process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com');
    this.enabled = Boolean(options.enabled ?? (Boolean(this.publicKey && this.secretKey)));
    this.flushIntervalMs = Math.max(0, Number(options.flushIntervalMs || 5000));
    this.maxBatchSize = Math.max(1, Number(options.maxBatchSize || 100));
    this.buffer = [];
    this.flushTimer = null;

    if (this.enabled && this.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => void this.flush(), this.flushIntervalMs);
      if (this.flushTimer?.unref) this.flushTimer.unref();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async export(spans = []) {
    if (!this.enabled) {
      return { ok: true, skipped: true, reason: 'langfuse_disabled' };
    }

    if (spans.length === 0) {
      return { ok: true, count: 0, skipped: true };
    }

    const observations = spans.map((span) => this.spanToLangfuseObservation(span));

    try {
      const response = await fetch(`${this.baseUrl}/api/public/ingestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          batch: observations.map((obs) => ({
            id: obs.id,
            trace_id: obs.traceId,
            parent_observation_id: obs.parentObservationId || null,
            project_id: obs.projectId || null,
            name: obs.name,
            start_time: obs.startTime,
            end_time: obs.endTime,
            model: obs.model || null,
            type: obs.type,
            input: obs.input,
            output: obs.output,
            status: obs.status,
            level: obs.level,
            status_message: obs.statusMessage || '',
            usage: obs.usage || null,
            prompt: obs.prompt || null,
            completion: obs.completion || null,
            metadata: obs.metadata,
            tags: obs.tags || [],
            user_id: obs.userId || null,
          })),
          auth: {
            public_key: this.publicKey,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[LangfuseExporter] Failed to export observations: ${response.status} ${errorText}`);
        return { ok: false, error: `HTTP ${response.status}`, count: 0 };
      }

      return { ok: true, count: observations.length };
    } catch (error) {
      console.warn(`[LangfuseExporter] Export error: ${error.message}`);
      return { ok: false, error: error.message, count: 0 };
    }
  }

  spanToLangfuseObservation(span = {}) {
    const name = span.operationName || 'unknown';
    const spanId = span.spanId || span.traceId;
    const traceId = span.traceId;

    return {
      id: spanId,
      traceId: traceId,
      parentObservationId: span.parentSpanId || null,
      projectId: null,
      name: name,
      startTime: span.startTime ? new Date(span.startTime).toISOString() : new Date().toISOString(),
      endTime: span.endTime ? new Date(span.endTime).toISOString() : null,
      type: this.inferType(name),
      status: this.mapStatus(span.status),
      statusMessage: span.attributes?.errorMessage || '',
      level: this.mapLevel(span.status),
      input: span.attributes?.input ? JSON.stringify(span.attributes.input) : null,
      output: span.attributes?.output ? JSON.stringify(span.attributes.output) : null,
      metadata: {
        ...span.attributes,
        events: span.events,
        durationMs: span.duration,
      },
      tags: [],
      userId: span.attributes?.userId || null,
      usage: span.attributes?.usage || null,
    };
  }

  inferType(name = '') {
    const n = name.toLowerCase();
    if (n.includes('llm') || n.includes('chat') || n.includes('generate')) return 'generation';
    if (n.includes('tool') || n.includes('execute') || n.includes('function')) return 'tool';
    if (n.includes('retriev') || n.includes('search')) return 'retrieval';
    if (n.includes('trace') || n.includes('span')) return 'span';
    return 'event';
  }

  mapStatus(status = '') {
    const s = String(status).toLowerCase();
    if (s === 'error') return 'ERROR';
    return 'SUCCESS';
  }

  mapLevel(status = '') {
    const s = String(status).toLowerCase();
    if (s === 'error') return 'ERROR';
    return 'DEFAULT';
  }

  async flush() {
    if (this.buffer.length === 0) return { ok: true, count: 0 };
    const spans = this.buffer.splice(0, this.buffer.length);
    return this.export(spans);
  }

  async close() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    return this.flush();
  }
}

export function createLangfuseExporter(options = {}) {
  return new LangfuseExporter(options);
}

export default {
  LangfuseExporter,
  createLangfuseExporter,
};

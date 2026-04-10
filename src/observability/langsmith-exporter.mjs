export class LangSmithExporter {
  constructor(options = {}) {
    this.apiKey = String(options.apiKey || process.env.LANGSMITH_API_KEY || '');
    this.endpoint = String(options.endpoint || process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com');
    this.project = String(options.project || process.env.LANGSMITH_PROJECT || 'ai-team');
    this.enabled = Boolean(options.enabled ?? (Boolean(this.apiKey)));
    this.flushIntervalMs = Math.max(0, Number(options.flushIntervalMs || 5000));
    this.maxBatchSize = Math.max(1, Number(options.maxBatchSize || 100));
    this.buffer = [];
    this.flushTimer = null;
    this.metadata = {
      project_name: this.project,
      run_type: 'chain',
      ...options.metadata,
    };

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
      return { ok: true, skipped: true, reason: 'langsmith_disabled' };
    }

    if (spans.length === 0) {
      return { ok: true, count: 0, skipped: true };
    }

    const runs = spans.map((span) => this.spanToLangSmithRun(span));
    const endpoint = `${this.endpoint}/v1/runs`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(runs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[LangSmithExporter] Failed to export runs: ${response.status} ${errorText}`);
        return { ok: false, error: `HTTP ${response.status}`, count: 0 };
      }

      return { ok: true, count: runs.length };
    } catch (error) {
      console.warn(`[LangSmithExporter] Export error: ${error.message}`);
      return { ok: false, error: error.message, count: 0 };
    }
  }

  spanToLangSmithRun(span = {}) {
    const startTime = new Date(span.startTime).getTime() / 1000;
    const endTime = span.endTime ? new Date(span.endTime).getTime() / 1000 : null;
    const duration = endTime ? (endTime - startTime) * 1000 : span.duration || 0;

    return {
      id: span.spanId || span.traceId,
      trace_id: span.traceId,
      parent_run_id: span.parentSpanId || null,
      name: span.operationName || 'unknown',
      start_time: startTime,
      end_time: endTime,
      extra: {
        metadata: {
          ...span.attributes,
          events: span.events,
        },
      },
      error: span.status === 'error' ? true : undefined,
      status: this.mapStatus(span.status),
      run_type: this.inferRunType(span),
      inputs: span.attributes?.input || null,
      outputs: span.attributes?.output || null,
    };
  }

  mapStatus(status = '') {
    const s = String(status).toLowerCase();
    if (s === 'error') return 'error';
    if (s === 'ok') return 'completed';
    return 'completed';
  }

  inferRunType(span = {}) {
    const name = String(span.operationName || '').toLowerCase();
    if (name.includes('llm') || name.includes('chat') || name.includes('generate')) return 'llm';
    if (name.includes('tool') || name.includes('execute') || name.includes('function')) return 'tool';
    if (name.includes('retriev') || name.includes('search')) return 'retrieval';
    if (name.includes('agent')) return 'agent';
    return 'chain';
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

export function createLangSmithExporter(options = {}) {
  return new LangSmithExporter(options);
}

export default {
  LangSmithExporter,
  createLangSmithExporter,
};

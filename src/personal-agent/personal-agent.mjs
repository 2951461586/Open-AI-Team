import { normalizePersonalConfig } from './personal-agent-config.mjs';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export class PersonalAgent {
  constructor(config = {}) {
    this.config = normalizePersonalConfig(config);
    this.id = this.config.id;
    this.name = this.config.name;
    this.model = this.config.model;
    this.personality = clone(this.config.personality);
    this.memory = {
      enabled: this.config.memory.enabled !== false,
      scope: this.config.memory.scope,
      summary: this.config.memory.summary || '',
      recentLimit: this.config.memory.recentLimit,
      entries: [],
    };
    this.cronJobs = [];
    this.initialized = false;
    this.startedAt = 0;
  }

  async initialize() {
    if (this.initialized) return this.getState();
    this.personality = clone(this.config.personality);
    this.memory.summary = String(this.config.memory.summary || '');
    this.memory.scope = String(this.config.memory.scope || `personal/${this.id}`);
    this.memory.recentLimit = Math.max(1, Number(this.config.memory.recentLimit || 20));
    this.cronJobs = (this.config.cronJobs || []).map((job) => ({
      ...clone(job),
      status: job.enabled === false ? 'disabled' : 'ready',
      registeredAt: new Date().toISOString(),
    }));
    this.initialized = true;
    this.startedAt = Date.now();
    return this.getState();
  }

  async process(message, context = {}) {
    if (!this.initialized) await this.initialize();
    const text = String(message ?? '').trim();
    const envelope = {
      id: String(context?.messageId || context?.id || `msg-${Date.now()}`),
      role: 'user',
      text,
      context: clone(context),
      createdAt: new Date().toISOString(),
    };
    if (this.memory.enabled && text) {
      this.memory.entries.push(envelope);
      if (this.memory.entries.length > this.memory.recentLimit) {
        this.memory.entries = this.memory.entries.slice(-this.memory.recentLimit);
      }
    }
    const reply = this.composeReply(text, context);
    const assistantEntry = {
      id: `${envelope.id}:reply`,
      role: 'assistant',
      text: reply,
      createdAt: new Date().toISOString(),
    };
    if (this.memory.enabled) this.memory.entries.push(assistantEntry);
    if (this.memory.entries.length > this.memory.recentLimit) {
      this.memory.entries = this.memory.entries.slice(-this.memory.recentLimit);
    }
    return {
      ok: true,
      agent: this.id,
      model: this.model,
      reply,
      memoryScope: this.memory.scope,
      memoryCount: this.memory.entries.length,
      personality: clone(this.personality),
      cronJobs: this.cronJobs.map((job) => ({ ...job })),
    };
  }

  composeReply(message, context = {}) {
    const traits = Array.isArray(this.personality?.traits) ? this.personality.traits.filter(Boolean) : [];
    const summary = this.memory.summary ? `记忆摘要：${this.memory.summary}` : '记忆摘要：无';
    const recent = this.memory.entries
      .slice(-Math.max(0, Number(context?.historyLimit || 3)))
      .map((entry) => `${entry.role}: ${entry.text}`)
      .join(' | ');
    const recentBlock = recent ? ` 最近上下文：${recent}` : '';
    return `[${this.name}] ${message || '收到空消息。'} | 风格=${this.personality?.tone || '自然'}/${this.personality?.style || '清晰'} | traits=${traits.join(',') || 'none'} | ${summary}${recentBlock}`;
  }

  getState() {
    return {
      ok: true,
      id: this.id,
      name: this.name,
      model: this.model,
      initialized: this.initialized,
      startedAt: this.startedAt,
      personality: clone(this.personality),
      memory: {
        enabled: this.memory.enabled,
        scope: this.memory.scope,
        summary: this.memory.summary,
        recentLimit: this.memory.recentLimit,
        entries: clone(this.memory.entries),
      },
      cronJobs: this.cronJobs.map((job) => ({ ...job })),
    };
  }

  async shutdown() {
    const snapshot = this.getState();
    this.cronJobs = [];
    this.initialized = false;
    this.startedAt = 0;
    return {
      ok: true,
      agent: this.id,
      clearedCronJobs: snapshot.cronJobs.length,
      retainedMemoryEntries: snapshot.memory.entries.length,
    };
  }
}

export default PersonalAgent;

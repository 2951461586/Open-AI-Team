import { EventEmitter } from 'node:events';
import { normalizeChannelMessage } from '../channel-message.mjs';

export class ChannelAdapterBase extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...config };
    this.channel = String(config.channel || 'unknown').trim() || 'unknown';
    this.state = 'idle';
    this.startedAt = 0;
    this.lastSeenAt = 0;
    this.lastError = '';
    this.capabilities = Array.isArray(config.capabilities) ? [...config.capabilities] : [];
  }

  async init(_context = {}) {
    this.state = 'ready';
    this.startedAt = Date.now();
    this.emit('state', this.getStatus());
    return this.getStatus();
  }

  async send(_message = {}, _context = {}) {
    throw new Error(`${this.constructor.name}.send_not_implemented`);
  }

  async receive(payload = {}, context = {}) {
    const message = normalizeChannelMessage(payload, { channel: this.channel, metadata: { adapter: this.constructor.name } });
    this.lastSeenAt = Date.now();
    this.emit('message', message, context);
    return message;
  }

  async disconnect(_context = {}) {
    this.state = 'disconnected';
    this.emit('state', this.getStatus());
    return this.getStatus();
  }

  setState(state = 'ready', extra = {}) {
    this.state = String(state || 'ready');
    if (extra.error) this.lastError = String(extra.error);
    this.emit('state', this.getStatus());
    return this.getStatus();
  }

  getStatus() {
    return {
      channel: this.channel,
      adapter: this.constructor.name,
      state: this.state,
      startedAt: this.startedAt || 0,
      lastSeenAt: this.lastSeenAt || 0,
      lastError: this.lastError || '',
      capabilities: [...this.capabilities],
      config: {
        mode: this.config.mode || '',
        endpoint: this.config.endpoint || this.config.webhookUrl || '',
      },
    };
  }
}

export default ChannelAdapterBase;

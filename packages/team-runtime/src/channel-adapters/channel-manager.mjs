import { EventEmitter } from 'node:events';
import { TelegramChannelAdapter } from './channel-telegram.mjs';
import { FeishuChannelAdapter } from './channel-feishu.mjs';
import { WechatChannelAdapter } from './channel-wechat.mjs';
import { QQChannelAdapter } from './channel-qq.mjs';
import { BotCommandRegistry, createBotCommandRegistry } from './bot-commands.mjs';

const CHANNEL_TYPES = {
  telegram: TelegramChannelAdapter,
  feishu: FeishuChannelAdapter,
  wechat: WechatChannelAdapter,
  qq: QQChannelAdapter,
};

export class ChannelManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.channels = new Map();
    this.commandRegistry = options.commandRegistry || createBotCommandRegistry({
      contextProviders: {
        getStatus: () => this.getStatus(),
        listSkills: options.listSkills || null,
        resetSession: options.resetSession || null,
        setLanguage: options.setLanguage || null,
        setModel: options.setModel || null,
      },
    });
    this.config = options.config || {};
    this.logger = options.logger || console;
  }

  async addChannel(type, config = {}) {
    const ChannelClass = CHANNEL_TYPES[type?.toLowerCase()];
    if (!ChannelClass) {
      throw new Error(`channel_type_not_supported:${type}`);
    }

    if (this.channels.has(type)) {
      await this.removeChannel(type);
    }

    const adapter = new ChannelClass(config);
    adapter.on('message', (msg, ctx) => this.handleMessage(type, msg, ctx));
    adapter.on('error', (err) => this.emit('error', { channel: type, error: err }));

    await adapter.init({ channelManager: this });

    this.channels.set(type, {
      adapter,
      config,
      status: 'active',
      addedAt: new Date().toISOString(),
    });

    this.emit('channel:added', { type, adapter, config });
    return adapter;
  }

  async removeChannel(type) {
    const channel = this.channels.get(type);
    if (!channel) return false;

    try {
      await channel.adapter.disconnect();
      this.channels.delete(type);
      this.emit('channel:removed', { type });
      return true;
    } catch (error) {
      this.emit('error', { channel: type, error });
      return false;
    }
  }

  async getChannel(type) {
    return this.channels.get(type)?.adapter || null;
  }

  async listChannels() {
    return [...this.channels.entries()].map(([type, { adapter, config, status, addedAt }]) => ({
      type,
      status,
      config: this.sanitizeConfig(config),
      addedAt,
      state: adapter.getStatus(),
    }));
  }

  sanitizeConfig(config) {
    const safe = { ...config };
    const sensitive = ['botToken', 'appSecret', 'appKey', 'apiKey'];
    for (const key of sensitive) {
      if (safe[key]) safe[key] = '***';
    }
    return safe;
  }

  async handleMessage(channelType, message, context = {}) {
    const content = message.content || '';
    
    if (content.startsWith('/')) {
      const result = await this.commandRegistry.execute(content, {
        channel: channelType,
        senderId: message.senderId,
        chatId: message.chatId,
        ...context,
      });

      if (result.ok && result.data?.message) {
        const channel = this.channels.get(channelType);
        if (channel) {
          await channel.adapter.send({ content: result.data.message }, context);
        }
      }
      
      this.emit('command', { channel: channelType, message, result, context });
      return result;
    }

    this.emit('message', { channel: channelType, message, context });
    return message;
  }

  async sendMessage(channelType, message, context = {}) {
    const channel = this.channels.get(channelType);
    if (!channel) {
      throw new Error(`channel_not_found:${channelType}`);
    }
    return channel.adapter.send(message, context);
  }

  async broadcast(message, context = {}) {
    const results = [];
    for (const [type, { adapter }] of this.channels) {
      try {
        const result = await adapter.send(message, { ...context, channel: type });
        results.push({ type, ok: true, result });
      } catch (error) {
        results.push({ type, ok: false, error: error.message });
      }
    }
    return results;
  }

  async getStatus() {
    const channels = {};
    for (const [type, { adapter, status }] of this.channels) {
      channels[type] = {
        status,
        state: adapter.getStatus?.() || {},
      };
    }
    return channels;
  }

  async disconnectAll() {
    const results = [];
    for (const [type, { adapter }] of this.channels) {
      try {
        await adapter.disconnect();
        results.push({ type, ok: true });
      } catch (error) {
        results.push({ type, ok: false, error: error.message });
      }
    }
    this.channels.clear();
    return results;
  }
}

export function createChannelManager(options = {}) {
  return new ChannelManager(options);
}

export default {
  ChannelManager,
  createChannelManager,
};

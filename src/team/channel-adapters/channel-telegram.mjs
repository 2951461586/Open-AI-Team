import { ChannelAdapterBase } from './channel-adapter-base.mjs';
import { normalizeChannelMessage, CHANNEL_MESSAGE_TYPES } from '../channel-message.mjs';

function tgApi(config = {}, method = '') {
  const token = String(config.botToken || '').trim();
  if (!token) throw new Error('telegram_bot_token_required');
  return `https://api.telegram.org/bot${token}/${method}`;
}

function inferType(message = {}) {
  if (message.photo?.length) return CHANNEL_MESSAGE_TYPES.IMAGE;
  if (message.document) return CHANNEL_MESSAGE_TYPES.FILE;
  if (message.voice || message.audio) return CHANNEL_MESSAGE_TYPES.AUDIO;
  if (message.video) return CHANNEL_MESSAGE_TYPES.VIDEO;
  return CHANNEL_MESSAGE_TYPES.TEXT;
}

export class TelegramChannelAdapter extends ChannelAdapterBase {
  constructor(config = {}) {
    super({ ...config, channel: 'telegram' });
    this.offset = Number(config.initialOffset || 0);
    this.abortController = null;
  }

  async init(context = {}) {
    await super.init(context);
    this.setState(this.config.mode === 'webhook' ? 'webhook_ready' : 'polling_ready');
    return this.getStatus();
  }

  normalizeInbound(payload = {}) {
    const update = payload.update_id ? payload : { message: payload };
    const message = update.message || update.edited_message || update.callback_query?.message || {};
    const from = message.from || update.callback_query?.from || {};
    const text = update.callback_query?.data || message.text || message.caption || '';
    return normalizeChannelMessage({
      channel: 'telegram',
      chatId: String(message.chat?.id || ''),
      senderId: String(from.id || ''),
      content: String(text || ''),
      type: inferType(message),
      timestamp: (message.date ? Number(message.date) * 1000 : Date.now()),
      metadata: {
        updateId: update.update_id || 0,
        messageId: message.message_id || '',
        chatType: message.chat?.type || '',
        username: from.username || '',
        raw: payload,
      },
    });
  }

  async receive(payload = {}, context = {}) {
    const normalized = this.normalizeInbound(payload);
    this.lastSeenAt = Date.now();
    this.emit('message', normalized, context);
    return normalized;
  }

  async pollOnce(context = {}) {
    const body = {
      offset: this.offset > 0 ? this.offset : undefined,
      timeout: Number(this.config.polling?.timeoutSeconds || 25),
      limit: Number(this.config.polling?.limit || 50),
      allowed_updates: this.config.polling?.allowedUpdates || ['message'],
    };
    const response = await fetch(tgApi(this.config, 'getUpdates'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });
    const data = await response.json();
    if (!data?.ok) throw new Error(`telegram_get_updates_failed:${data?.description || response.status}`);
    const updates = Array.isArray(data.result) ? data.result : [];
    for (const update of updates) {
      this.offset = Math.max(this.offset, Number(update.update_id || 0) + 1);
      await this.receive(update, context);
    }
    return updates.length;
  }

  async startPolling(context = {}) {
    this.abortController = new AbortController();
    this.setState('polling');
    while (!this.abortController.signal.aborted) {
      try {
        await this.pollOnce(context);
      } catch (error) {
        this.lastError = String(error?.message || error);
        this.emit('error', error);
        await new Promise((resolve) => setTimeout(resolve, Number(this.config.polling?.retryMs || 1500)));
      }
    }
  }

  async send(message = {}, _context = {}) {
    const normalized = normalizeChannelMessage(message, { channel: 'telegram' });
    const response = await fetch(tgApi(this.config, 'sendMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: normalized.chatId,
        text: normalized.content,
        reply_to_message_id: normalized.metadata.replyToMessageId || undefined,
      }),
    });
    const data = await response.json();
    if (!data?.ok) throw new Error(`telegram_send_failed:${data?.description || response.status}`);
    return data.result;
  }

  async disconnect(context = {}) {
    this.abortController?.abort?.();
    this.abortController = null;
    return super.disconnect(context);
  }
}

export default TelegramChannelAdapter;

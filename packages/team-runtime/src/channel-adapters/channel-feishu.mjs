import { ChannelAdapterBase } from './channel-adapter-base.mjs';
import { normalizeChannelMessage, CHANNEL_MESSAGE_TYPES } from '../channel-message.mjs';

export class FeishuChannelAdapter extends ChannelAdapterBase {
  constructor(config = {}) {
    super({ ...config, channel: 'feishu' });
    this.tenantAccessToken = '';
    this.tenantAccessTokenExpireAt = 0;
  }

  get endpoint() {
    return String(this.config.endpoint || 'https://open.feishu.cn').replace(/\/$/, '');
  }

  async init(context = {}) {
    await super.init(context);
    this.setState('ready');
    return this.getStatus();
  }

  async ensureTenantAccessToken() {
    if (this.tenantAccessToken && Date.now() < this.tenantAccessTokenExpireAt - 30000) return this.tenantAccessToken;
    const response = await fetch(`${this.endpoint}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }),
    });
    const data = await response.json();
    if (Number(data?.code || 0) !== 0 || !data?.tenant_access_token) {
      throw new Error(`feishu_token_failed:${data?.msg || response.status}`);
    }
    this.tenantAccessToken = String(data.tenant_access_token);
    this.tenantAccessTokenExpireAt = Date.now() + Number(data.expire || 7200) * 1000;
    return this.tenantAccessToken;
  }

  normalizeInbound(payload = {}) {
    const event = payload.event || payload;
    const sender = event.sender?.sender_id || {};
    const message = event.message || {};
    let content = '';
    try {
      const parsed = typeof message.content === 'string' ? JSON.parse(message.content) : (message.content || {});
      content = parsed.text || parsed.content || '';
    } catch {
      content = String(message.content || '');
    }
    return normalizeChannelMessage({
      channel: 'feishu',
      chatId: String(message.chat_id || event.open_chat_id || ''),
      senderId: String(sender.open_id || sender.user_id || sender.union_id || ''),
      content,
      type: message.message_type === 'text' ? CHANNEL_MESSAGE_TYPES.TEXT : CHANNEL_MESSAGE_TYPES.UNKNOWN,
      timestamp: event.create_time ? Number(event.create_time) : Date.now(),
      metadata: {
        messageId: message.message_id || '',
        chatType: message.chat_type || '',
        eventId: payload.header?.event_id || '',
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

  async send(message = {}, _context = {}) {
    const normalized = normalizeChannelMessage(message, { channel: 'feishu' });
    const token = await this.ensureTenantAccessToken();
    const response = await fetch(`${this.endpoint}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: normalized.chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: normalized.content }),
      }),
    });
    const data = await response.json();
    if (Number(data?.code || 0) !== 0) throw new Error(`feishu_send_failed:${data?.msg || response.status}`);
    return data.data || {};
  }
}

export default FeishuChannelAdapter;

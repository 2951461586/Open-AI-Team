import { ChannelAdapterBase } from './channel-adapter-base.mjs';
import { normalizeChannelMessage, CHANNEL_MESSAGE_TYPES } from '../channel-message.mjs';

export class QQChannelAdapter extends ChannelAdapterBase {
  constructor(config = {}) {
    super({ ...config, channel: 'qq' });
    this.accessToken = '';
    this.accessTokenExpireAt = 0;
  }

  get endpoint() {
    return String(this.config.endpoint || 'https://api.sgroup.qq.com').replace(/\/$/, '');
  }

  async ensureAccessToken() {
    if (this.accessToken && Date.now() < this.accessTokenExpireAt - 30000) return this.accessToken;
    if (this.config.accessToken) return String(this.config.accessToken);
    throw new Error('qq_access_token_required');
  }

  normalizeInbound(payload = {}) {
    const author = payload.author || payload.member || {};
    const content = payload.content || payload.message || '';
    return normalizeChannelMessage({
      channel: 'qq',
      chatId: String(payload.channel_id || payload.group_openid || payload.guild_id || ''),
      senderId: String(author.id || author.user_openid || author.member_openid || ''),
      content: String(content || ''),
      type: CHANNEL_MESSAGE_TYPES.TEXT,
      timestamp: payload.timestamp || Date.now(),
      metadata: {
        messageId: payload.id || payload.msg_id || '',
        guildId: payload.guild_id || '',
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
    const normalized = normalizeChannelMessage(message, { channel: 'qq' });
    const token = await this.ensureAccessToken();
    const appId = String(this.config.appId || '').trim();
    if (!appId) throw new Error('qq_app_id_required');
    const response = await fetch(`${this.endpoint}/channels/${encodeURIComponent(normalized.chatId)}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `QQBot ${token}`,
        'x-union-appid': appId,
      },
      body: JSON.stringify({ content: normalized.content }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`qq_send_failed:${data?.message || response.status}`);
    return data;
  }
}

export default QQChannelAdapter;

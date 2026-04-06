import crypto from 'node:crypto';
import { parseStringPromise } from 'xml2js';
import { ChannelAdapterBase } from './channel-adapter-base.mjs';
import { normalizeChannelMessage, CHANNEL_MESSAGE_TYPES } from '../channel-message.mjs';

function toArray(value) {
  return Array.isArray(value) ? value : (value == null ? [] : [value]);
}

function first(value, fallback = '') {
  if (Array.isArray(value)) return first(value[0], fallback);
  if (value == null) return fallback;
  if (typeof value === 'object') {
    if ('_' in value) return first(value._, fallback);
    return fallback;
  }
  return String(value);
}

function safeBase64Decode(value = '') {
  return Buffer.from(String(value || ''), 'base64');
}

function inferMessageType(message = {}) {
  const msgType = String(message.MsgType || '').trim().toLowerCase();
  if (msgType === 'text') return CHANNEL_MESSAGE_TYPES.TEXT;
  if (msgType === 'image') return CHANNEL_MESSAGE_TYPES.IMAGE;
  if (msgType === 'voice') return CHANNEL_MESSAGE_TYPES.AUDIO;
  if (msgType === 'video' || msgType === 'shortvideo') return CHANNEL_MESSAGE_TYPES.VIDEO;
  if (msgType === 'file') return CHANNEL_MESSAGE_TYPES.FILE;
  if (msgType === 'event') return CHANNEL_MESSAGE_TYPES.EVENT;
  return CHANNEL_MESSAGE_TYPES.UNKNOWN;
}

function normalizeWechatPayload(payload = {}) {
  const root = payload?.xml || payload || {};
  const message = {};
  for (const [key, value] of Object.entries(root)) message[key] = first(value, '');
  return message;
}

function buildNonce(size = 8) {
  return crypto.randomBytes(size).toString('hex');
}

async function parseWechatXml(xml = '') {
  const parsed = await parseStringPromise(String(xml || '').trim(), {
    trim: true,
    explicitArray: true,
    explicitRoot: true,
  });
  return normalizeWechatPayload(parsed || {});
}

function buildXmlResponse(fields = {}) {
  const order = Object.entries(fields).filter(([, value]) => value !== undefined && value !== null);
  return `<xml>${order.map(([key, value]) => `<${key}><![CDATA[${String(value)}]]></${key}>`).join('')}</xml>`;
}

export class WechatChannelAdapter extends ChannelAdapterBase {
  constructor(config = {}) {
    super({ ...config, channel: 'wechat' });
    this.accessToken = '';
    this.accessTokenExpireAt = 0;
  }

  get endpoint() {
    return String(this.config.endpoint || 'https://api.weixin.qq.com').replace(/\/$/, '');
  }

  async init(context = {}) {
    await super.init(context);
    this.setState('webhook_ready');
    return this.getStatus();
  }

  async ensureAccessToken() {
    if (this.accessToken && Date.now() < this.accessTokenExpireAt - 30000) return this.accessToken;
    const appId = String(this.config.appId || '').trim();
    const appSecret = String(this.config.appSecret || '').trim();
    if (!appId) throw new Error('wechat_app_id_required');
    if (!appSecret) throw new Error('wechat_app_secret_required');
    const url = `${this.endpoint}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) {
      throw new Error(`wechat_token_failed:${data?.errmsg || response.status}`);
    }
    this.accessToken = String(data.access_token);
    this.accessTokenExpireAt = Date.now() + Number(data.expires_in || 7200) * 1000;
    return this.accessToken;
  }

  computeSignature({ timestamp = '', nonce = '', encrypted = '' } = {}) {
    const token = String(this.config.token || '').trim();
    if (!token) throw new Error('wechat_token_required');
    const items = [token, String(timestamp || ''), String(nonce || '')];
    if (encrypted) items.push(String(encrypted || ''));
    return crypto.createHash('sha1').update(items.sort().join('')).digest('hex');
  }

  verifySignature({ signature = '', timestamp = '', nonce = '', encrypted = '' } = {}) {
    const expected = this.computeSignature({ timestamp, nonce, encrypted });
    return expected === String(signature || '').trim();
  }

  decryptMessage(encrypted = '') {
    const encodingAESKey = String(this.config.encodingAESKey || '').trim();
    if (!encodingAESKey) return String(encrypted || '');
    const aesKey = safeBase64Decode(`${encodingAESKey}=`);
    const encryptedBuffer = safeBase64Decode(encrypted);
    const iv = aesKey.subarray(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(false);
    const plain = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    const pad = plain[plain.length - 1];
    const content = plain.subarray(0, plain.length - pad);
    const xmlLength = content.readUInt32BE(16);
    const xml = content.subarray(20, 20 + xmlLength).toString('utf8');
    const appId = content.subarray(20 + xmlLength).toString('utf8');
    const configuredAppId = String(this.config.appId || '').trim();
    if (configuredAppId && appId && appId !== configuredAppId) throw new Error('wechat_app_id_mismatch');
    return xml;
  }

  encryptMessage(xml = '', nonce = '', timestamp = '') {
    const encodingAESKey = String(this.config.encodingAESKey || '').trim();
    if (!encodingAESKey) return { encrypt: String(xml || '') };
    const aesKey = safeBase64Decode(`${encodingAESKey}=`);
    const iv = aesKey.subarray(0, 16);
    const appId = String(this.config.appId || '').trim();
    const xmlBuffer = Buffer.from(String(xml || ''), 'utf8');
    const random16 = crypto.randomBytes(16);
    const msgLength = Buffer.alloc(4);
    msgLength.writeUInt32BE(xmlBuffer.length, 0);
    const plain = Buffer.concat([random16, msgLength, xmlBuffer, Buffer.from(appId, 'utf8')]);
    const blockSize = 32;
    const padSize = blockSize - (plain.length % blockSize || blockSize);
    const padded = Buffer.concat([plain, Buffer.alloc(padSize, padSize)]);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
    const msgSignature = this.computeSignature({ timestamp, nonce, encrypted });
    return { encrypt: encrypted, msgSignature };
  }

  async parseInboundPayload(raw = {}) {
    if (typeof raw === 'string') return parseWechatXml(raw);
    if (raw?.xml) return normalizeWechatPayload(raw);
    if (raw?.Encrypt || raw?.MsgType) return normalizeWechatPayload(raw);
    return normalizeWechatPayload(raw || {});
  }

  normalizeInbound(payload = {}) {
    const message = normalizeWechatPayload(payload);
    const content = String(
      message.Content
      || message.EventKey
      || message.PicUrl
      || message.MediaId
      || message.Recognition
      || message.Label
      || ''
    );
    const messageId = message.MsgId || message.CreateTime || `${message.FromUserName || 'wechat'}:${message.MsgType || 'msg'}`;
    return normalizeChannelMessage({
      channel: 'wechat',
      chatId: String(message.FromUserName || ''),
      senderId: String(message.FromUserName || ''),
      content,
      type: inferMessageType(message),
      timestamp: message.CreateTime ? Number(message.CreateTime) * 1000 : Date.now(),
      metadata: {
        messageId: String(messageId),
        toUserName: String(message.ToUserName || ''),
        fromUserName: String(message.FromUserName || ''),
        msgType: String(message.MsgType || ''),
        event: String(message.Event || ''),
        eventKey: String(message.EventKey || ''),
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
    const normalized = normalizeChannelMessage(message, { channel: 'wechat' });
    const token = await this.ensureAccessToken();
    const response = await fetch(`${this.endpoint}/cgi-bin/message/custom/send?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        touser: normalized.chatId,
        msgtype: 'text',
        text: { content: normalized.content },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || Number(data?.errcode || 0) !== 0) {
      throw new Error(`wechat_send_failed:${data?.errmsg || response.status}`);
    }
    return data;
  }

  async buildEncryptedReply({ toUserName = '', fromUserName = '', content = '', nonce = '', timestamp = '' } = {}) {
    const replyXml = buildXmlResponse({
      ToUserName: toUserName,
      FromUserName: fromUserName,
      CreateTime: timestamp,
      MsgType: 'text',
      Content: content,
    });
    if (!this.config.encodingAESKey) return replyXml;
    const { encrypt, msgSignature } = this.encryptMessage(replyXml, nonce, timestamp);
    return buildXmlResponse({
      Encrypt: encrypt,
      MsgSignature: msgSignature,
      TimeStamp: timestamp,
      Nonce: nonce,
    });
  }
}

export { parseWechatXml, buildXmlResponse, normalizeWechatPayload, inferMessageType, buildNonce };
export default WechatChannelAdapter;

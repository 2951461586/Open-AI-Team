export const CHANNEL_TYPES = {
  TELEGRAM: 'telegram',
  SLACK: 'slack',
  FEISHU: 'feishu',
  WECOM: 'wecom',
  QQ: 'qq',
  WECHAT: 'wechat',
  DISCORD: 'discord',
  LOCAL: 'local',
};

export const CHANNEL_TRANSPORTS = {
  HTTP: 'http',
  WEBSOCKET: 'websocket',
  LONG_POLLING: 'long_polling',
  WEBHOOK: 'webhook',
};

export function createChannelAdapter({
  type = CHANNEL_TYPES.LOCAL,
  transport = CHANNEL_TRANSPORTS.WEBSOCKET,
  credentials = {},
  options = {},
} = {}) {
  const state = {
    type,
    transport,
    credentials,
    options,
    connected: false,
    sessionMappings: new Map(),
  };

  async function connect() {
    if (state.connected) return { ok: true, alreadyConnected: true };
    state.connected = true;
    return { ok: true };
  }

  async function disconnect() {
    if (!state.connected) return { ok: true };
    state.sessionMappings.clear();
    state.connected = false;
    return { ok: true };
  }

  async function sendMessage(channelId = '', message = {}, options = {}) {
    if (!state.connected) {
      return { ok: false, error: 'channel_not_connected' };
    }
    return {
      ok: true,
      messageId: `${type}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  async function receiveMessage(rawMessage = {}, options = {}) {
    return {
      ok: true,
      message: normalizeMessage(rawMessage),
      sessionKey: resolveSession(rawMessage),
    };
  }

  function normalizeMessage(raw = {}) {
    return {
      id: String(raw.id || raw.message_id || `${Date.now()}`),
      type: String(raw.type || 'text').toLowerCase(),
      content: extractContent(raw),
      sender: extractSender(raw),
      channel: state.type,
      timestamp: raw.timestamp || raw.date || new Date().toISOString(),
      metadata: extractMetadata(raw),
    };
  }

  function extractContent(raw = {}) {
    if (typeof raw.text === 'string') return raw.text;
    if (typeof raw.content === 'string') return raw.content;
    if (typeof raw.message === 'string') return raw.message;
    return JSON.stringify(raw);
  }

  function extractSender(raw = {}) {
    return {
      id: String(raw.from?.id || raw.sender?.id || raw.user_id || 'unknown'),
      name: String(raw.from?.first_name || raw.from?.username || raw.sender?.name || ''),
      username: String(raw.from?.username || raw.sender?.username || ''),
    };
  }

  function extractMetadata(raw = {}) {
    const meta = {};
    if (raw.chat?.id) meta.chatId = raw.chat.id;
    if (raw.chat?.type) meta.chatType = raw.chat.type;
    if (raw.reply_to_message_id) meta.replyTo = raw.reply_to_message_id;
    return meta;
  }

  function resolveSession(raw = {}) {
    const senderId = String(raw.from?.id || raw.sender?.id || raw.user_id || '');
    const key = `${state.type}:${senderId}`;
    return state.sessionMappings.get(key) || key;
  }

  function mapSession(nativeUserId = '', sessionKey = '') {
    const key = `${state.type}:${nativeUserId}`;
    state.sessionMappings.set(key, String(sessionKey));
    return { ok: true };
  }

  function unmapSession(nativeUserId = '') {
    const key = `${state.type}:${nativeUserId}`;
    return state.sessionMappings.delete(key);
  }

  function getStatus() {
    return {
      type: state.type,
      transport: state.transport,
      connected: state.connected,
      sessionCount: state.sessionMappings.size,
    };
  }

  return {
    type,
    transport,
    connect,
    disconnect,
    sendMessage,
    receiveMessage,
    normalizeMessage,
    resolveSession,
    mapSession,
    unmapSession,
    getStatus,
  };
}

export function createMultiChannelRouter({
  channels = [],
  defaultChannel = CHANNEL_TYPES.LOCAL,
} = {}) {
  const channelMap = new Map();
  for (const channel of channels) {
    channelMap.set(channel.type, channel);
  }

  async function routeMessage(rawMessage = {}, options = {}) {
    const channelType = options.channel || detectChannelType(rawMessage) || defaultChannel;
    const channel = channelMap.get(channelType);
    if (!channel) {
      return { ok: false, error: `channel_not_found: ${channelType}` };
    }
    return channel.receiveMessage(rawMessage, options);
  }

  async function sendToChannel(channelType = '', channelId = '', message = {}, options = {}) {
    const channel = channelMap.get(channelType);
    if (!channel) {
      return { ok: false, error: `channel_not_found: ${channelType}` };
    }
    return channel.sendMessage(channelId, message, options);
  }

  function detectChannelType(rawMessage = {}) {
    if (rawMessage.update_id !== undefined && rawMessage.message?.from?.id !== undefined) {
      return CHANNEL_TYPES.TELEGRAM;
    }
    if (rawMessage.type === 'message' && rawMessage.channel) {
      return CHANNEL_TYPES.SLACK;
    }
    if (rawMessage.schema === 'im.message' || rawMessage.event_type === 'im.message.receive_v1') {
      return CHANNEL_TYPES.FEISHU;
    }
    if (rawMessage.msgtype === 'text' && rawMessage.from_username) {
      return CHANNEL_TYPES.WECOM;
    }
    return null;
  }

  function registerChannel(channel = {}) {
    channelMap.set(channel.type, channel);
  }

  function unregisterChannel(channelType = '') {
    return channelMap.delete(channelType);
  }

  function listChannels() {
    return [...channelMap.values()].map((ch) => ({
      type: ch.type,
      transport: ch.transport,
      getStatus: ch.getStatus ? ch.getStatus() : null,
    }));
  }

  return {
    routeMessage,
    sendToChannel,
    registerChannel,
    unregisterChannel,
    listChannels,
    detectChannelType,
  };
}

export default {
  CHANNEL_TYPES,
  CHANNEL_TRANSPORTS,
  createChannelAdapter,
  createMultiChannelRouter,
};

export const CHANNEL_MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  AUDIO: 'audio',
  VIDEO: 'video',
  EVENT: 'event',
  COMMAND: 'command',
  UNKNOWN: 'unknown',
});

export function nowIso(input = Date.now()) {
  const value = input instanceof Date ? input.getTime() : Number(input || Date.now());
  return new Date(Number.isFinite(value) ? value : Date.now()).toISOString();
}

export function createChannelMessage(input = {}) {
  const metadata = input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {};
  const message = {
    channel: String(input.channel || metadata.channel || 'unknown').trim() || 'unknown',
    chatId: String(input.chatId || metadata.chatId || '').trim(),
    senderId: String(input.senderId || metadata.senderId || '').trim(),
    content: String(input.content ?? '').trim(),
    type: String(input.type || metadata.type || CHANNEL_MESSAGE_TYPES.UNKNOWN).trim() || CHANNEL_MESSAGE_TYPES.UNKNOWN,
    timestamp: input.timestamp ? nowIso(input.timestamp) : nowIso(),
    metadata,
  };
  if (!message.metadata.messageId && input.messageId) message.metadata.messageId = String(input.messageId);
  if (!message.metadata.sessionKey && input.sessionKey) message.metadata.sessionKey = String(input.sessionKey);
  if (!message.metadata.threadId && input.threadId) message.metadata.threadId = String(input.threadId);
  return message;
}

export function normalizeChannelMessage(input = {}, defaults = {}) {
  return createChannelMessage({
    ...defaults,
    ...input,
    metadata: {
      ...(defaults.metadata || {}),
      ...(input.metadata || {}),
    },
  });
}

export function buildScopeKeyFromMessage(message = {}) {
  const normalized = normalizeChannelMessage(message);
  return `${normalized.channel}:${normalized.chatId || normalized.metadata.threadId || normalized.senderId || 'unknown'}`;
}

export function buildSessionKeyFromMessage(message = {}) {
  const normalized = normalizeChannelMessage(message);
  const thread = normalized.metadata.threadId || normalized.metadata.sessionId || normalized.chatId || 'default';
  return `${normalized.channel}:${thread}`;
}

export function isRenderableMessage(message = {}) {
  const normalized = normalizeChannelMessage(message);
  return !!normalized.channel && !!normalized.chatId && !!normalized.senderId && (normalized.content.length > 0 || normalized.type === CHANNEL_MESSAGE_TYPES.EVENT);
}

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScopeKeyFromMessage, buildSessionKeyFromMessage, normalizeChannelMessage, isRenderableMessage } from './channel-message.mjs';
import { TelegramChannelAdapter } from './channel-adapters/channel-telegram.mjs';
import { FeishuChannelAdapter } from './channel-adapters/channel-feishu.mjs';
import { QQChannelAdapter } from './channel-adapters/channel-qq.mjs';
import { WechatChannelAdapter } from './channel-adapters/channel-wechat.mjs';

const __dirname = typeof import.meta?.url === 'string'
  ? path.dirname(fileURLToPath(import.meta.url))
  : process.cwd();

const ADAPTER_TYPES = {
  telegram: TelegramChannelAdapter,
  feishu: FeishuChannelAdapter,
  qq: QQChannelAdapter,
  wechat: WechatChannelAdapter,
};

function nowMs() {
  return Date.now();
}

function safeJsonParse(text, fallback = {}) {
  try { return JSON.parse(String(text || '')); } catch { return fallback; }
}

function makeId(prefix = 'im') {
  return `${prefix}:${randomUUID()}`;
}

class MemoryQueue {
  constructor({ maxSize = 1000, dropPolicy = 'oldest' } = {}) {
    this.maxSize = Math.max(1, Number(maxSize || 1000));
    this.dropPolicy = String(dropPolicy || 'oldest');
    this.items = [];
  }

  push(item) {
    if (this.items.length >= this.maxSize) {
      if (this.dropPolicy === 'reject') return false;
      if (this.dropPolicy === 'latest') this.items.pop();
      else this.items.shift();
    }
    this.items.push(item);
    return true;
  }

  shift() {
    return this.items.shift() || null;
  }

  size() {
    return this.items.length;
  }

  snapshot(limit = 100) {
    return this.items.slice(0, Math.max(1, Number(limit || 100)));
  }
}

function loadRouterConfig(configPath) {
  const resolved = configPath
    ? path.resolve(String(configPath))
    : path.resolve(__dirname, '..', '..', 'config', 'team', 'channels.json');
  if (!fs.existsSync(resolved)) {
    return {
      path: resolved,
      config: { version: '1.0.0', channels: {}, queue: { maxSize: 1000, dropPolicy: 'oldest' }, defaultRoute: {} },
      loaded: false,
    };
  }
  return {
    path: resolved,
    config: safeJsonParse(fs.readFileSync(resolved, 'utf8'), { channels: {}, queue: { maxSize: 1000, dropPolicy: 'oldest' }, defaultRoute: {} }),
    loaded: true,
  };
}

export function createIMChannelRouter({
  tlRuntime,
  teamStore,
  governanceRuntime,
  configPath,
  adapters = {},
  now = nowMs,
  idgen = makeId,
  logger = console,
  onEvent,
} = {}) {
  const loaded = loadRouterConfig(configPath);
  const config = loaded.config || {};
  const queue = new MemoryQueue(config.queue || {});
  const registry = new Map();
  const sessions = new Map();
  let draining = false;

  function emit(event = {}) {
    try { if (typeof onEvent === 'function') onEvent(event); } catch {}
    return event;
  }

  function getAdapterStatus() {
    return Array.from(registry.entries()).map(([channel, entry]) => ({ channel, ...(entry.adapter?.getStatus?.() || { state: entry.state || 'unknown' }) }));
  }

  function resolveAdapterClass(type = '') {
    const key = String(type || '').trim().toLowerCase();
    return ADAPTER_TYPES[key] || null;
  }

  function routeMessageToSession(message = {}) {
    const normalized = normalizeChannelMessage(message);
    const scopeKey = buildScopeKeyFromMessage(normalized);
    const sessionKey = buildSessionKeyFromMessage(normalized);
    const existing = sessions.get(sessionKey);
    if (existing) {
      existing.lastMessageAt = now();
      existing.messageCount += 1;
      return { scopeKey, sessionKey, taskId: existing.taskId || '', isNew: false, session: existing };
    }
    const created = {
      sessionKey,
      scopeKey,
      channel: normalized.channel,
      chatId: normalized.chatId,
      senderId: normalized.senderId,
      taskId: '',
      createdAt: now(),
      lastMessageAt: now(),
      messageCount: 1,
      metadata: {
        threadId: normalized.metadata.threadId || '',
        messageId: normalized.metadata.messageId || '',
      },
    };
    sessions.set(sessionKey, created);
    return { scopeKey, sessionKey, taskId: '', isNew: true, session: created };
  }

  async function deliverReply(adapter, originalMessage, result = {}) {
    if (!adapter || !result) return { ok: false, error: 'adapter_or_result_required' };
    const reply = String(result.reply || result.tlReply || result.summary || result.message || '').trim();
    if (!reply) return { ok: true, skipped: true };
    await adapter.send({
      channel: originalMessage.channel,
      chatId: originalMessage.chatId,
      senderId: 'team:tl',
      content: reply,
      type: 'text',
      metadata: {
        replyToMessageId: originalMessage.metadata.messageId || '',
        sessionKey: buildSessionKeyFromMessage(originalMessage),
        taskId: result.taskId || result.task?.taskId || '',
      },
    });
    return { ok: true, reply };
  }

  async function invokeTL(normalizedMessage, route) {
    const runtime = tlRuntime || {};
    const governanceHint = governanceRuntime?.shouldEscalateToHuman?.({ riskLevel: 'medium', taskMode: 'execution' }) || { escalate: false };
    const baseEvent = {
      text: normalizedMessage.content,
      scopeKey: route.scopeKey,
      source: 'im_channel_router',
      ingressKind: 'channel_message',
      sourceEventId: normalizedMessage.metadata.messageId || idgen('msg'),
      deliveryTarget: normalizedMessage.chatId,
      recipientId: normalizedMessage.chatId,
      recipientType: 'chat',
      deliveryMode: config?.defaultRoute?.deliveryMode || 'reply',
      channel: normalizedMessage.channel,
      metadata: {
        senderId: normalizedMessage.senderId,
        ...normalizedMessage.metadata,
      },
      riskLevel: governanceHint.escalate ? 'high' : (config?.defaultRoute?.riskLevel || 'medium'),
      taskMode: config?.defaultRoute?.taskMode || 'general',
    };

    if (route.session?.taskId && typeof runtime.handleTaskChat === 'function') {
      return runtime.handleTaskChat({ taskId: route.session.taskId, text: normalizedMessage.content, target: 'tl', intent: 'followup' });
    }
    if (typeof runtime.createTeamRunFromEvent === 'function') {
      return runtime.createTeamRunFromEvent(baseEvent);
    }
    if (typeof runtime.handleTeamRun === 'function') {
      return runtime.handleTeamRun({ text: normalizedMessage.content, scopeKey: route.scopeKey, history: [] }, {});
    }
    return { ok: false, error: 'tl_runtime_unavailable' };
  }

  async function processQueueItem(item) {
    const adapterEntry = registry.get(item.message.channel);
    if (!adapterEntry?.adapter) return { ok: false, error: 'adapter_not_registered' };
    const route = routeMessageToSession(item.message);
    const result = await invokeTL(item.message, route);

    const taskId = String(result?.taskId || result?.task?.taskId || result?.entry?.taskId || route.session?.taskId || '').trim();
    if (taskId) {
      const existing = sessions.get(route.sessionKey) || route.session;
      existing.taskId = taskId;
      existing.lastMessageAt = now();
      sessions.set(route.sessionKey, existing);
      try {
        teamStore?.updateTaskMetadata?.({
          taskId,
          metadata: {
            imChannel: item.message.channel,
            imChatId: item.message.chatId,
            imSenderId: item.message.senderId,
            imSessionKey: route.sessionKey,
            lastInboundMessageId: item.message.metadata.messageId || '',
          },
        });
      } catch (error) {
        logger?.warn?.('[im-router] failed to update task metadata', error);
      }
    }

    await deliverReply(adapterEntry.adapter, item.message, result);

    emit({
      type: 'im.route.completed',
      channel: item.message.channel,
      chatId: item.message.chatId,
      sessionKey: route.sessionKey,
      taskId,
      ok: !!result?.ok,
      timestamp: now(),
    });

    return { ok: true, result, route };
  }

  async function drainQueue() {
    if (draining) return;
    draining = true;
    try {
      while (queue.size() > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          await processQueueItem(item);
        } catch (error) {
          logger?.error?.('[im-router] process failed', error);
          emit({
            type: 'im.route.failed',
            channel: item.message.channel,
            chatId: item.message.chatId,
            error: String(error?.message || error),
            timestamp: now(),
          });
        }
      }
    } finally {
      draining = false;
    }
  }

  async function enqueueInbound(message = {}, context = {}) {
    const normalized = normalizeChannelMessage(message);
    if (!isRenderableMessage(normalized)) return { ok: false, error: 'invalid_message' };
    const accepted = queue.push({ id: idgen('queue'), message: normalized, context, createdAt: now() });
    if (!accepted) return { ok: false, error: 'queue_full' };
    emit({ type: 'im.queue.accepted', channel: normalized.channel, chatId: normalized.chatId, timestamp: now(), size: queue.size() });
    void drainQueue();
    return { ok: true, queued: true, size: queue.size() };
  }

  async function registerChannel(channel, adapterOrConfig = {}) {
    const name = String(channel || adapterOrConfig.channel || '').trim().toLowerCase();
    if (!name) throw new Error('channel_required');
    if (registry.has(name)) await unregisterChannel(name);

    let adapter = adapterOrConfig;
    if (!adapter || typeof adapter.init !== 'function') {
      const AdapterClass = resolveAdapterClass(adapterOrConfig.adapter || name);
      if (!AdapterClass) throw new Error(`unknown_adapter:${name}`);
      adapter = new AdapterClass({ ...adapterOrConfig, channel: name });
    }

    adapter.on('message', (message, context) => { void enqueueInbound(message, context); });
    adapter.on('state', (state) => emit({ type: 'im.channel.state', channel: name, state, timestamp: now() }));
    adapter.on('error', (error) => emit({ type: 'im.channel.error', channel: name, error: String(error?.message || error), timestamp: now() }));

    await adapter.init({ router: api, teamStore, tlRuntime, governanceRuntime });
    registry.set(name, { adapter, state: adapter.getStatus?.().state || 'ready', registeredAt: now() });
    emit({ type: 'im.channel.registered', channel: name, timestamp: now() });
    return adapter.getStatus?.() || { channel: name, state: 'ready' };
  }

  async function unregisterChannel(channel) {
    const name = String(channel || '').trim().toLowerCase();
    const entry = registry.get(name);
    if (!entry) return { ok: false, error: 'channel_not_found' };
    await entry.adapter?.disconnect?.({ router: api });
    registry.delete(name);
    emit({ type: 'im.channel.unregistered', channel: name, timestamp: now() });
    return { ok: true, channel: name };
  }

  async function initEnabledChannels() {
    const all = config.channels && typeof config.channels === 'object' ? config.channels : {};
    for (const [channel, channelConfig] of Object.entries(all)) {
      if (!channelConfig?.enabled) continue;
      await registerChannel(channel, channelConfig);
    }
    return getAdapterStatus();
  }

  const api = {
    initEnabledChannels,
    registerChannel,
    unregisterChannel,
    enqueueInbound,
    routeMessageToSession,
    getAdapter: (channel) => registry.get(String(channel || '').trim().toLowerCase())?.adapter || null,
    getChannelStatus: (channel) => registry.get(String(channel || '').trim().toLowerCase())?.adapter?.getStatus?.() || null,
    listChannelStatus: getAdapterStatus,
    listSessions: () => Array.from(sessions.values()).map((item) => ({ ...item })),
    getSession: (sessionKey) => {
      const row = sessions.get(String(sessionKey || ''));
      return row ? { ...row } : null;
    },
    getQueueSnapshot: (limit = 100) => queue.snapshot(limit),
    getQueueSize: () => queue.size(),
    drainQueue,
    config: () => ({ ...config, path: loaded.path, loaded: loaded.loaded }),
  };

  return api;
}

export default createIMChannelRouter;

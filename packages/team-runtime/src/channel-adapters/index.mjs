export { ChannelManager, createChannelManager } from './channel-manager.mjs';
export { BotCommandRegistry, createBotCommandRegistry, BOT_COMMANDS } from './bot-commands.mjs';
export { TelegramChannelAdapter } from './channel-telegram.mjs';
export { FeishuChannelAdapter } from './channel-feishu.mjs';
export { WechatChannelAdapter } from './channel-wechat.mjs';
export { QQChannelAdapter } from './channel-qq.mjs';
export { ChannelAdapterBase } from './channel-adapter-base.mjs';
export { normalizeChannelMessage, CHANNEL_MESSAGE_TYPES } from '../channel-message.mjs';

export default {
  ChannelManager,
  createChannelManager,
  BotCommandRegistry,
  createBotCommandRegistry,
  BOT_COMMANDS,
  TelegramChannelAdapter,
  FeishuChannelAdapter,
  WechatChannelAdapter,
  QQChannelAdapter,
  ChannelAdapterBase,
};

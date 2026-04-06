import path from 'node:path';
import { asObject, buildToolDefinition, getProviderConfig, isProviderEnabled, isoNow, loadJson, loadToolsConfig, makeId, saveJson } from './tool-common.mjs';

async function readBox(filePath, key = 'messages') {
  const data = asObject(await loadJson(filePath, {}), {});
  return Array.isArray(data[key]) ? data[key] : [];
}

export async function createEmailProvider({ rootDir = process.cwd(), configPath = 'config/team/tools.json', ...overrides } = {}) {
  const config = await loadToolsConfig({ rootDir, configPath });
  if (!isProviderEnabled(config, 'email', overrides)) return [];
  const providerConfig = getProviderConfig(config, 'email', overrides);
  const inboxPath = path.resolve(rootDir, providerConfig.storagePath || 'tmp/tool-data/email-messages.json');
  const sentPath = path.resolve(rootDir, providerConfig.sentPath || 'tmp/tool-data/email-sent.json');
  const source = { type: 'provider', name: 'email-provider' };

  return [
    buildToolDefinition({ id: 'email.list_inbox', title: 'List inbox', description: 'List inbox messages from a local JSON mailbox.', source, permissions: { public: true, capabilities: ['email.read'] }, inputSchema: { type: 'object', properties: { unreadOnly: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 200 } }, additionalProperties: false }, outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' }, unread: { type: 'integer' } }, required: ['items', 'count', 'unread'], additionalProperties: true } }, async ({ unreadOnly = false, limit = 50 } = {}) => {
      const items = (await readBox(inboxPath)).filter((msg) => !unreadOnly || msg.read !== true).slice(0, Number(limit || 50));
      return { items, count: items.length, unread: items.filter((msg) => msg.read !== true).length };
    }),
    buildToolDefinition({ id: 'email.send', title: 'Send email', description: 'Store an outbound email in local sent mailbox.', source, permissions: { public: true, capabilities: ['email.send'] }, inputSchema: { type: 'object', properties: { to: { type: 'array', items: { type: 'string' }, minItems: 1 }, cc: { type: 'array', items: { type: 'string' } }, bcc: { type: 'array', items: { type: 'string' } }, subject: { type: 'string', minLength: 1 }, text: { type: 'string', minLength: 1 }, from: { type: 'string' } }, required: ['to', 'subject', 'text'], additionalProperties: false }, outputSchema: { type: 'object', properties: { message: { type: 'object' }, queued: { type: 'boolean' }, sentPath: { type: 'string' } }, required: ['message', 'queued', 'sentPath'], additionalProperties: true } }, async ({ to = [], cc = [], bcc = [], subject = '', text = '', from = '' } = {}) => {
      const messages = await readBox(sentPath);
      const message = { id: makeId('mail'), from: from || providerConfig.defaultFrom || 'agent@local.test', to, cc, bcc, subject, text, read: true, folder: 'sent', createdAt: isoNow() };
      messages.unshift(message);
      await saveJson(sentPath, { messages });
      return { message, queued: true, sentPath };
    }),
    buildToolDefinition({ id: 'email.mark', title: 'Mark email read or unread', description: 'Mark an inbox email as read/unread.', source, permissions: { public: true, capabilities: ['email.write'] }, inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1 }, read: { type: 'boolean' } }, required: ['id', 'read'], additionalProperties: false }, outputSchema: { type: 'object', properties: { id: { type: 'string' }, read: { type: 'boolean' }, updated: { type: 'boolean' } }, required: ['id', 'read', 'updated'], additionalProperties: false } }, async ({ id = '', read = true } = {}) => {
      const messages = await readBox(inboxPath);
      const item = messages.find((msg) => msg.id === id);
      if (!item) throw new Error(`email_not_found:${id}`);
      item.read = read === true;
      item.updatedAt = isoNow();
      await saveJson(inboxPath, { messages });
      return { id, read: item.read, updated: true };
    }),
  ];
}

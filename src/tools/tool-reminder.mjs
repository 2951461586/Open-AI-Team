import path from 'node:path';
import { asObject, buildToolDefinition, getProviderConfig, isProviderEnabled, isoNow, loadJson, loadToolsConfig, makeId, saveJson } from './tool-common.mjs';

async function readStore(filePath) {
  const data = asObject(await loadJson(filePath, {}), {});
  return Array.isArray(data?.reminders) ? data.reminders : [];
}

export async function createReminderProvider({ rootDir = process.cwd(), configPath = 'config/team/tools.json', ...overrides } = {}) {
  const config = await loadToolsConfig({ rootDir, configPath });
  if (!isProviderEnabled(config, 'reminder', overrides)) return [];
  const providerConfig = getProviderConfig(config, 'reminder', overrides);
  const storagePath = path.resolve(rootDir, providerConfig.storagePath || 'tmp/tool-data/reminders.json');
  const source = { type: 'provider', name: 'reminder-provider' };

  return [
    buildToolDefinition({ id: 'reminder.create', title: 'Create reminder', description: 'Create a local reminder record.', source, permissions: { public: true, capabilities: ['reminder.write'] }, inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1 }, remindAt: { type: 'string', minLength: 1 }, note: { type: 'string' }, timezone: { type: 'string' } }, required: ['title', 'remindAt'], additionalProperties: false }, outputSchema: { type: 'object', properties: { reminder: { type: 'object' }, created: { type: 'boolean' } }, required: ['reminder', 'created'], additionalProperties: true } }, async ({ title = '', remindAt = '', note = '', timezone = '' } = {}) => {
      const reminders = await readStore(storagePath);
      const reminder = { id: makeId('rem'), title, remindAt, note, timezone: timezone || providerConfig.defaultTimezone || 'UTC', status: 'active', createdAt: isoNow() };
      reminders.unshift(reminder);
      await saveJson(storagePath, { reminders });
      return { reminder, created: true };
    }),
    buildToolDefinition({ id: 'reminder.list', title: 'List reminders', description: 'List local reminders.', source, permissions: { public: true, capabilities: ['reminder.read'] }, inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'cancelled', 'all'] }, limit: { type: 'integer', minimum: 1, maximum: 200 } }, additionalProperties: false }, outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' } }, required: ['items', 'count'], additionalProperties: true } }, async ({ status = 'active', limit = 50 } = {}) => {
      const reminders = await readStore(storagePath);
      const items = reminders.filter((item) => status === 'all' ? true : item.status === status).slice(0, Number(limit || 50));
      return { items, count: items.length };
    }),
    buildToolDefinition({ id: 'reminder.cancel', title: 'Cancel reminder', description: 'Cancel a local reminder by id.', source, permissions: { public: true, capabilities: ['reminder.write'] }, inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1 } }, required: ['id'], additionalProperties: false }, outputSchema: { type: 'object', properties: { id: { type: 'string' }, cancelled: { type: 'boolean' } }, required: ['id', 'cancelled'], additionalProperties: false } }, async ({ id = '' } = {}) => {
      const reminders = await readStore(storagePath);
      const item = reminders.find((entry) => entry.id === id);
      if (!item) throw new Error(`reminder_not_found:${id}`);
      item.status = 'cancelled';
      item.cancelledAt = isoNow();
      await saveJson(storagePath, { reminders });
      return { id, cancelled: true };
    }),
  ];
}

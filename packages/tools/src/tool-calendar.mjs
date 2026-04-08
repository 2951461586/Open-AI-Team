import path from 'node:path';
import { asObject, buildToolDefinition, getProviderConfig, isProviderEnabled, isoNow, loadJson, loadToolsConfig, makeId, saveJson } from './tool-common.mjs';

async function readStore(filePath) {
  return asObject(await loadJson(filePath, {}), { events: [] });
}

async function writeStore(filePath, store) {
  return saveJson(filePath, { events: Array.isArray(store?.events) ? store.events : [] });
}

function sortEvents(events = []) {
  return [...events].sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
}

export async function createCalendarProvider({ rootDir = process.cwd(), configPath = 'config/team/tools.json', ...overrides } = {}) {
  const config = await loadToolsConfig({ rootDir, configPath });
  if (!isProviderEnabled(config, 'calendar', overrides)) return [];
  const providerConfig = getProviderConfig(config, 'calendar', overrides);
  const storagePath = path.resolve(rootDir, providerConfig.storagePath || 'tmp/tool-data/calendar-events.json');
  const source = { type: 'provider', name: 'calendar-provider' };

  return [
    buildToolDefinition({
      id: 'calendar.list_events', title: 'List calendar events', description: 'List calendar events from local JSON store.', source,
      permissions: { public: true, capabilities: ['calendar.read'] },
      inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200 } }, additionalProperties: false },
      outputSchema: { type: 'object', properties: { items: { type: 'array' }, count: { type: 'integer' }, storagePath: { type: 'string' } }, required: ['items', 'count', 'storagePath'], additionalProperties: true },
    }, async ({ from = '', to = '', limit = 50 } = {}) => {
      const store = await readStore(storagePath);
      const items = sortEvents(store.events || []).filter((item) => (!from || String(item.start || '') >= String(from)) && (!to || String(item.start || '') <= String(to))).slice(0, Number(limit || 50));
      return { items, count: items.length, storagePath };
    }),
    buildToolDefinition({
      id: 'calendar.create_event', title: 'Create calendar event', description: 'Create a calendar event with optional reminders.', source,
      permissions: { public: true, capabilities: ['calendar.write'] },
      inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1 }, start: { type: 'string', minLength: 1 }, end: { type: 'string' }, location: { type: 'string' }, notes: { type: 'string' }, timezone: { type: 'string' }, reminders: { type: 'array', items: { type: 'integer' } } }, required: ['title', 'start'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { event: { type: 'object' }, created: { type: 'boolean' }, storagePath: { type: 'string' } }, required: ['event', 'created', 'storagePath'], additionalProperties: true },
    }, async (args = {}) => {
      const store = await readStore(storagePath);
      const event = { id: makeId('evt'), title: args.title, start: args.start, end: args.end || '', location: args.location || '', notes: args.notes || '', timezone: args.timezone || providerConfig.defaultTimezone || 'UTC', reminders: Array.isArray(args.reminders) && args.reminders.length ? args.reminders : [Number(providerConfig.defaultReminderMinutes || 30)], createdAt: isoNow(), updatedAt: isoNow() };
      store.events = sortEvents([...(store.events || []), event]);
      await writeStore(storagePath, store);
      return { event, created: true, storagePath };
    }),
    buildToolDefinition({
      id: 'calendar.update_event', title: 'Update calendar event', description: 'Patch a calendar event by id.', source,
      permissions: { public: true, capabilities: ['calendar.write'] },
      inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1 }, title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, location: { type: 'string' }, notes: { type: 'string' }, timezone: { type: 'string' }, reminders: { type: 'array', items: { type: 'integer' } } }, required: ['id'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { event: { type: 'object' }, updated: { type: 'boolean' } }, required: ['event', 'updated'], additionalProperties: true },
    }, async ({ id = '', ...patch } = {}) => {
      const store = await readStore(storagePath);
      const index = (store.events || []).findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`calendar_event_not_found:${id}`);
      const current = store.events[index];
      const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), updatedAt: isoNow() };
      store.events[index] = next;
      store.events = sortEvents(store.events);
      await writeStore(storagePath, store);
      return { event: next, updated: true };
    }),
    buildToolDefinition({
      id: 'calendar.delete_event', title: 'Delete calendar event', description: 'Delete a calendar event by id.', source,
      permissions: { public: true, capabilities: ['calendar.write'] },
      inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1 } }, required: ['id'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { id: { type: 'string' }, deleted: { type: 'boolean' } }, required: ['id', 'deleted'], additionalProperties: false },
    }, async ({ id = '' } = {}) => {
      const store = await readStore(storagePath);
      const before = (store.events || []).length;
      store.events = (store.events || []).filter((item) => item.id !== id);
      await writeStore(storagePath, store);
      return { id, deleted: store.events.length !== before };
    }),
    buildToolDefinition({
      id: 'calendar.set_reminder', title: 'Set event reminders', description: 'Replace reminder minutes for a calendar event.', source,
      permissions: { public: true, capabilities: ['calendar.write'] },
      inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1 }, reminders: { type: 'array', items: { type: 'integer' }, minItems: 1 } }, required: ['id', 'reminders'], additionalProperties: false },
      outputSchema: { type: 'object', properties: { id: { type: 'string' }, reminders: { type: 'array' }, updated: { type: 'boolean' } }, required: ['id', 'reminders', 'updated'], additionalProperties: true },
    }, async ({ id = '', reminders = [] } = {}) => {
      const store = await readStore(storagePath);
      const item = (store.events || []).find((entry) => entry.id === id);
      if (!item) throw new Error(`calendar_event_not_found:${id}`);
      item.reminders = reminders.map((value) => Number(value)).filter(Number.isFinite);
      item.updatedAt = isoNow();
      await writeStore(storagePath, store);
      return { id, reminders: item.reminders, updated: true };
    }),
  ];
}

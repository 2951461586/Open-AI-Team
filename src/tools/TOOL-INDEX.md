# Tool Provider Index

This directory contains optional tool providers that follow the P1 `registerTool` contract used by `src/agent-harness-core/tool-runtime.mjs`.

## Design rules

- Pure Node.js ESM
- No extra npm dependencies
- Tools return standard provider definitions with:
  - `id`
  - `title`
  - `description`
  - `inputSchema`
  - `outputSchema`
  - `permissions`
  - `source`
  - `execute`
- Provider enable/disable is controlled by `config/team/tools.json`
- External calls use built-in `fetch`
- Local state falls back to JSON files under `tmp/tool-data/`

## Providers

### `tool-calendar.mjs`
Calendar/event management provider.

Tools:
- `calendar.list_events`
- `calendar.create_event`
- `calendar.update_event`
- `calendar.delete_event`
- `calendar.set_reminder`

Default backend:
- Local JSON event store

### `tool-email.mjs`
Inbox and outbound mail simulation/provider adapter.

Tools:
- `email.list_inbox`
- `email.send`
- `email.mark`

Default backend:
- Local JSON inbox/sent store

### `tool-git.mjs`
Safe Git workspace operations.

Tools:
- `git.status`
- `git.log`
- `git.diff`
- `git.create_branch`
- `git.commit`
- `git.push`

Backend:
- Local `git` CLI via `child_process.execFile`

### `tool-weather.mjs`
Weather and forecast provider.

Tools:
- `weather.current`
- `weather.forecast`

Backends:
- Open-Meteo (default)
- wttr.in fallback

### `tool-reminder.mjs`
Reminder/task scheduler store.

Tools:
- `reminder.create`
- `reminder.list`
- `reminder.cancel`

Default backend:
- Local JSON reminder store

### `tool-browser.mjs`
Basic browser/page interaction.

Tools:
- `browser.open`
- `browser.extract_text`
- `browser.screenshot`

Backends:
- HTTP fetch for open/text extraction
- Playwright if available for screenshots
- Otherwise returns a clear capability error for screenshot capture

## Example registration

```js
import { createLocalToolRuntime } from '../agent-harness-core/tool-runtime.mjs';
import { createCalendarProvider } from './tool-calendar.mjs';
import { createEmailProvider } from './tool-email.mjs';
import { createGitProvider } from './tool-git.mjs';
import { createWeatherProvider } from './tool-weather.mjs';
import { createReminderProvider } from './tool-reminder.mjs';
import { createBrowserProvider } from './tool-browser.mjs';

const runtime = createLocalToolRuntime({ sandbox });
runtime.registerTools([
  ...createCalendarProvider({ rootDir: process.cwd() }),
  ...createEmailProvider({ rootDir: process.cwd() }),
  ...createGitProvider({ rootDir: process.cwd() }),
  ...createWeatherProvider({ rootDir: process.cwd() }),
  ...createReminderProvider({ rootDir: process.cwd() }),
  ...createBrowserProvider({ rootDir: process.cwd() }),
]);
```

## Config loading

Each provider reads `config/team/tools.json` by default and returns `[]` when disabled.

This makes it safe to compose all providers and let config decide which ones are available.

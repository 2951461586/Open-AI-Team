# @ai-team/tools

Canonical package authority for reusable tool providers and tool-side helpers.

## Current status

**This package is now the implementation authority for the public tool-provider island.**

Package-owned implementation currently includes:

- `src/tool-common.mjs`
- `src/tool-browser.mjs`
- `src/tool-calendar.mjs`
- `src/tool-email.mjs`
- `src/tool-git.mjs`
- `src/tool-reminder.mjs`
- `src/tool-weather.mjs`
- `src/index.mjs`

## Compatibility rule

Legacy source paths under `src/tools/` remain as thin compatibility shims only.
New tool-provider logic should land in this package, not in `src/tools/`.

## Responsibilities

- tool provider implementations
- tool-side helpers/utilities
- package export surface for reusable providers

## Non-goals

This package does **not** own harness-core tool runtime implementation from `packages/agent-harness/`.
Those surfaces remain under the harness package boundary, not the tools package.

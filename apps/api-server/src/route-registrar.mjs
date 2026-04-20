// ─── route-registrar.mjs ───────────────────────────────────────────
// Legacy route registrar — returns 410 Gone for retired endpoints,
// redirecting callers to the current /api/v1/ surfaces.
//
// Surviving non-v1 routes:
//   /health            — health check (used by Docker + monitors)
//   /mcp/*             — MCP Server JSON-RPC + health
//   /ws/chat           — WebSocket (handled by index.mjs upgrade)
//   /webhook/telegram/* — IM webhooks (external callbacks)
//   /webhook/qq        — IM webhooks
//   /webhook/wechat    — IM webhooks
//   /webhook/feishu    — IM webhooks
//
// All other legacy paths return 410 with migration guidance.
// ───────────────────────────────────────────────────────────────────

import { tryHandleIMWebhookRoute } from './routes/index-routes-im-webhook.mjs';
import { tryHandleMcpRoute } from './routes/index-routes-mcp.mjs';

// ── Legacy route retirement map ───────────────────────────────────
// Maps old path prefixes to their /api/v1/ replacements.
const RETIRED_ROUTES = [
  { prefix: '/state/team',         replacement: '/api/v1/state/team' },
  { prefix: '/state/',             replacement: '/api/v1/state' },
  { prefix: '/internal/team/task',         replacement: '/api/v1/internal/team/task' },
  { prefix: '/internal/team/message',      replacement: '/api/v1/internal/team/message' },
  { prefix: '/internal/team/dispatch',     replacement: '/api/v1/internal/team/dispatch' },
  { prefix: '/internal/team/control',      replacement: '/api/v1/internal/team/control' },
  { prefix: '/internal/team/governance',   replacement: '/api/v1/internal/team/governance' },
  { prefix: '/internal/team/ingress',      replacement: '/api/v1/team/chat' },
  { prefix: '/internal/team/resident',     replacement: '/api/v1/internal/team' },
  { prefix: '/internal/team/agent',        replacement: '/api/v1/internal/team' },
  { prefix: '/internal/debate',    replacement: '/api/v1/team/chat (TL-driven execution)' },
  { prefix: '/internal/commands',  replacement: '/api/v1/internal/team' },
  { prefix: '/roles',              replacement: '/api/v1/team/config/roles' },
  { prefix: '/api/personal',       replacement: '(personal agent retired — use /api/v1/team/chat)' },
  { prefix: '/api/trace',          replacement: '/api/v1/state (observability via Langfuse/LangSmith)' },
  { prefix: '/desks/',             replacement: '/api/v1/state/team/workbench' },
];

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function getPathname(req) {
  try {
    return new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    return String(req.url || '').split('?')[0] || '/';
  }
}

function findRetiredRoute(pathname) {
  for (const route of RETIRED_ROUTES) {
    if (pathname === route.prefix || pathname.startsWith(route.prefix + '/') || pathname.startsWith(route.prefix + '?')) {
      return route;
    }
  }
  return null;
}

/**
 * Try to handle a registered route.
 * Returns true if the route was handled (including 410 responses).
 * Returns false if the route is not recognized (caller should continue to static file serving).
 */
export async function tryHandleRegisteredRoute(req, res, ctx = {}) {
  const pathname = getPathname(req);

  // ── Health check (always alive) ──
  if (pathname === '/health' || pathname === '/health/') {
    const stats = ctx.teamStore?.stats?.() || {};
    sendJson(res, 200, {
      ok: true,
      service: 'ai-team-runtime',
      mode: 'team-runtime-v1',
      team: { stats },
    });
    return true;
  }

  // ── IM Webhooks (external callbacks) ──
  if (await tryHandleIMWebhookRoute(req, res, ctx)) return true;

  // ── MCP Server ──
  if (await tryHandleMcpRoute(req, res, ctx)) return true;

  // ── Retired legacy routes — return 410 with migration guidance ──
  const retired = findRetiredRoute(pathname);
  if (retired) {
    sendJson(res, 410, {
      ok: false,
      error: 'route_retired',
      message: `The endpoint ${pathname} has been retired.`,
      migration: `Use ${retired.replacement} instead.`,
      docs: 'See README.md and docs/api/ for current API reference.',
    });
    return true;
  }

  return false;
}

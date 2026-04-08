import { tryHandleTeamRoute } from './routes/index-routes-team.mjs';
import { tryHandleHealthStateRoute } from './routes/index-routes-health-state.mjs';
import { tryHandleEntryRoute } from './routes/index-routes-entry.mjs';
import { tryHandleMcpRoute } from './routes/index-routes-mcp.mjs';
import { tryHandleIMWebhookRoute } from './routes/index-routes-im-webhook.mjs';

export function tryHandleRegisteredRoute(req, res, baseRouteCtx = {}) {
  if (tryHandleHealthStateRoute(req, res, baseRouteCtx)) return true;
  if (tryHandleEntryRoute(req, res, baseRouteCtx)) return true;
  if (tryHandleIMWebhookRoute(req, res, baseRouteCtx)) return true;
  if (tryHandleTeamRoute(req, res, baseRouteCtx)) return true;
  if (tryHandleMcpRoute(req, res, baseRouteCtx)) return true;
  return false;
}

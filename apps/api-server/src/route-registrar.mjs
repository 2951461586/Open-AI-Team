import { tryHandleTeamRoute } from './routes/index-routes-team.mjs';
import { tryHandleHealthStateRoute } from './routes/index-routes-health-state.mjs';
import { tryHandleEntryRoute } from './routes/index-routes-entry.mjs';
import { tryHandleMcpRoute } from './routes/index-routes-mcp.mjs';
import { tryHandleIMWebhookRoute } from './routes/index-routes-im-webhook.mjs';

export async function tryHandleRegisteredRoute(req, res, baseRouteCtx = {}) {
  if (await tryHandleHealthStateRoute(req, res, baseRouteCtx)) return true;
  if (await tryHandleEntryRoute(req, res, baseRouteCtx)) return true;
  if (await tryHandleIMWebhookRoute(req, res, baseRouteCtx)) return true;
  if (await tryHandleTeamRoute(req, res, baseRouteCtx)) return true;
  if (await tryHandleMcpRoute(req, res, baseRouteCtx)) return true;
  return false;
}

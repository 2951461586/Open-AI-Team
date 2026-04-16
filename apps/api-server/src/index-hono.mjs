import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createDeskApi } from '@ai-team/team-runtime';
import { createAppContext } from './index-bootstrap.mjs';
import { loadIndexConfig } from './index-env.mjs';
import { consumeWebhookEvent } from './webhook-event-router.mjs';
import { dispatchDashboardChat } from './routes/team-route-dispatch-v2.mjs';
import { createTeamRoutes } from './routes/v1/team-routes.mjs';
import { createStateRoutes } from './routes/v1/state-routes.mjs';
import { createInternalRoutes } from './routes/v1/internal-routes.mjs';
import { createAuthMiddleware } from './middleware/auth.mjs';
import { createApiResponse } from './middleware/response.mjs';

const DASHBOARD_OUT_DIR = process.env.DASHBOARD_OUT_DIR || '/app/dashboard/out';

export function sendJson(c, code, body, extraHeaders = {}) {
  return c.json(body, code, extraHeaders);
}

export function handleJsonBody(c, onBody) {
  return onBody(c.body?.json() || {});
}

export function createAuthHelpers(config = {}) {
  const { ORCH_KICK_TOKEN, DASHBOARD_TOKEN, DASHBOARD_CORS_ORIGIN } = config;

  function isOrchAuthorized(req) {
    if (!ORCH_KICK_TOKEN) return true;
    const token = String(req?.headers?.['x-orch-token'] || '').trim();
    return token === ORCH_KICK_TOKEN;
  }

  function isDashboardAuthorized(req) {
    if (!DASHBOARD_TOKEN) return true;
    const auth = String(req?.headers?.authorization || '').trim();
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const dashboardToken = String(req?.headers?.['x-dashboard-token'] || '').trim();
    return bearer === DASHBOARD_TOKEN || dashboardToken === DASHBOARD_TOKEN;
  }

  return { isOrchAuthorized, isDashboardAuthorized, DASHBOARD_CORS_ORIGIN };
}

export async function createHonoServer(config = loadIndexConfig()) {
  const {
    PORT,
    BIND,
    TEAM_DB_PATH,
    TEAM_JUDGE_TRUE_EXECUTION,
  } = config;

  const ctx = await createAppContext(config);
  const deskApi = createDeskApi({
    desk: ctx.deskStorage || ctx.desk || null,
    eventBus: ctx.eventBus || null,
    config,
    logger: console,
  });
  const authHelpers = createAuthHelpers(config);

  const routeContext = {
    ...ctx,
    rootDir: process.cwd(),
    deskStorage: ctx.deskStorage || ctx.desk || deskApi.desk,
    deskApi,
    PORT,
    TEAM_DB_PATH,
    TEAM_JUDGE_TRUE_EXECUTION,
    sendJson,
    handleJsonBody,
    consumeWebhookEvent,
    ...authHelpers,
  };

  const app = new Hono();

  app.use('*', cors({
    origin: authHelpers.DASHBOARD_CORS_ORIGIN || '*',
    allowHeaders: ['content-type', 'authorization', 'x-orch-token', 'x-dashboard-token'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  }));

  app.use('*', createApiResponse());
  app.use('*', createAuthMiddleware(authHelpers));

  app.get('/health', (c) => {
    return c.json({
      ok: true,
      service: 'qq-orchestrator',
      port: PORT,
      mode: 'team-runtime-v1',
      team: {
        db: {
          path: ctx.teamStore?.dbPath,
          stats: ctx.teamStore?.stats?.(),
        },
        judge: {
          trueExecutionEnabled: TEAM_JUDGE_TRUE_EXECUTION,
        },
      },
    });
  });

  const teamRoutes = createTeamRoutes(routeContext);
  const stateRoutes = createStateRoutes(routeContext);
  const internalRoutes = createInternalRoutes(routeContext);

  app.route('/api/v1/team', teamRoutes);
  app.route('/api/v1/state', stateRoutes);
  app.route('/api/v1/internal', internalRoutes);

  app.post('/webhook/qq', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await consumeWebhookEvent({ body, headers: c.req.headers }, routeContext);
    return c.json(result);
  });

  app.notFound((c) => c.json({ ok: false, error: 'not_found' }, 404));

  const server = serve({
    fetch: app.fetch,
    port: Number(PORT || 19090),
    hostname: BIND || '0.0.0.0',
  });

  console.log(`[orchestrator] listening on ${BIND}:${PORT}`);
  console.log('[orchestrator] mode=team-runtime-v1 with Hono');

  return { server, app, config, ctx, deskApi, routeContext };
}

export async function startServer(config = loadIndexConfig()) {
  return await createHonoServer(config);
}

const isDirectRun = (() => {
  const entry = process.argv?.[1];
  if (!entry) return false;
  try {
    return import.meta.url === new URL(entry, 'file://').href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  await startServer();
}

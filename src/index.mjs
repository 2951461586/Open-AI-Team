import http from 'node:http';
import { createAppContext } from './index-bootstrap.mjs';
import { loadIndexConfig } from './index-env.mjs';
import { tryHandleTeamRoute } from './routes/index-routes-team.mjs';
import { tryHandleHealthStateRoute } from './routes/index-routes-health-state.mjs';
import { tryHandleEntryRoute } from './routes/index-routes-entry.mjs';
import { consumeWebhookEvent } from './webhook-event-router.mjs';

function sendJson(res, code, body, extraHeaders = {}) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(s);
}

function handleJsonBody(req, res, onBody) {
  let buf = '';
  req.on('data', (c) => (buf += c));
  req.on('end', async () => {
    try {
      const body = JSON.parse(buf || '{}');
      const out = await onBody(body);
      if (out === undefined) return;
      if (out && typeof out === 'object' && ('status' in out || 'body' in out || 'headers' in out)) {
        const status = Number(out.status || 200);
        const bodyPayload = out.body === undefined ? { ok: true } : out.body;
        const headers = out.headers && typeof out.headers === 'object' ? out.headers : {};
        sendJson(res, status, bodyPayload, headers);
        return;
      }
      sendJson(res, 200, out ?? { ok: true });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
  });
}

const config = loadIndexConfig();
const {
  PORT,
  BIND,
  ORCH_KICK_TOKEN,
  DASHBOARD_TOKEN,
  DASHBOARD_CORS_ORIGIN,
  TEAM_DB_PATH,
  TEAM_JUDGE_TRUE_EXECUTION,
} = config;

const ctx = await createAppContext(config);

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

function applyCors(req, res) {
  if (!DASHBOARD_CORS_ORIGIN) return;
  const origin = String(req?.headers?.origin || '').trim();
  if (!origin) return;
  if (DASHBOARD_CORS_ORIGIN === '*' || origin === DASHBOARD_CORS_ORIGIN) {
    res.setHeader('access-control-allow-origin', DASHBOARD_CORS_ORIGIN === '*' ? '*' : origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'content-type, authorization, x-orch-token, x-dashboard-token');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  }
}

const baseRouteCtx = {
  ...ctx,
  PORT,
  TEAM_DB_PATH,
  TEAM_JUDGE_TRUE_EXECUTION,
  isOrchAuthorized,
  isDashboardAuthorized,
  sendJson,
  handleJsonBody,
  consumeWebhookEvent,
};

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (tryHandleHealthStateRoute(req, res, baseRouteCtx)) return;
  if (tryHandleEntryRoute(req, res, baseRouteCtx)) return;
  if (tryHandleTeamRoute(req, res, baseRouteCtx)) return;

  sendJson(res, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, BIND, () => {
  console.log(`[orchestrator] listening on ${BIND}:${PORT}`);
  console.log('[orchestrator] mode=team-runtime-v1');
});

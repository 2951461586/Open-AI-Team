import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createAppContext } from './index-bootstrap.mjs';
import { loadIndexConfig } from './index-env.mjs';
import { tryHandleRegisteredRoute } from './route-registrar.mjs';
import { consumeWebhookEvent } from './webhook-event-router.mjs';
import { createDeskApi } from '../../../src/team/desk-api.mjs';
import { dispatchDashboardChat } from './routes/team-route-dispatch-v2.mjs';

function normalizeWsScopeKey(raw = '') {
  const scopeKey = String(raw || '').trim();
  return scopeKey || 'dashboard:main:chat:default';
}

function parseRequestUrl(req) {
  try {
    return new URL(req.url || '/', 'http://localhost');
  } catch {
    return new URL('http://localhost/');
  }
}

function writeHttpError(socket, status = 400, message = 'Bad Request') {
  try {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
  } catch {}
  try {
    socket.destroy();
  } catch {}
}

export function sendJson(res, code, body, extraHeaders = {}) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(s);
}

export function handleJsonBody(req, res, onBody) {
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

export function createAuthHelpers(config = {}) {
  const {
    ORCH_KICK_TOKEN,
    DASHBOARD_TOKEN,
    DASHBOARD_CORS_ORIGIN,
  } = config;

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

  return {
    isOrchAuthorized,
    isDashboardAuthorized,
    applyCors,
  };
}

export async function createServer(config = loadIndexConfig()) {
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
  const { isOrchAuthorized, isDashboardAuthorized, applyCors } = createAuthHelpers(config);

  const baseRouteCtx = {
    ...ctx,
    rootDir: process.cwd(),
    deskStorage: ctx.deskStorage || ctx.desk || deskApi.desk,
    deskApi,
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
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (tryHandleRegisteredRoute(req, res, baseRouteCtx)) return;

    sendJson(res, 404, { ok: false, error: 'not_found' });
  });

  const wss = new WebSocketServer({ noServer: true });
  const wsClients = new Map();

  function sendWs(ws, payload = {}) {
    if (!ws || ws.readyState !== ws.OPEN) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function broadcastWs(payload = {}, matcher = null) {
    for (const [ws, meta] of wsClients.entries()) {
      if (!meta || ws.readyState !== ws.OPEN) continue;
      if (typeof matcher === 'function' && !matcher(meta)) continue;
      sendWs(ws, payload);
    }
  }

  function scopeMatches(meta = {}, payload = {}) {
    const messageScope = normalizeWsScopeKey(payload.scopeKey || payload.scope_key || payload.scope || payload.workspaceScope || '');
    return normalizeWsScopeKey(meta.scopeKey) === messageScope;
  }

  const onEvent = (event = {}) => {
    if (!event || typeof event !== 'object') return;
    const type = String(event.type || '').trim();
    if (!type) return;
    broadcastWs(event, (meta) => scopeMatches(meta, event));
  };

  ctx.eventBus?.on?.('event', onEvent);

  wss.on('connection', (ws, req) => {
    const url = parseRequestUrl(req);
    const initialScopeKey = normalizeWsScopeKey(url.searchParams.get('scopeKey') || url.searchParams.get('scope') || '');
    wsClients.set(ws, { scopeKey: initialScopeKey, connectedAt: Date.now() });
    sendWs(ws, { type: 'ws_ready', scopeKey: initialScopeKey, timestamp: Date.now() });

    ws.on('message', async (raw) => {
      let msg = null;
      try {
        msg = JSON.parse(String(raw || '{}'));
      } catch {
        sendWs(ws, { type: 'error', error: 'invalid_json', timestamp: Date.now() });
        return;
      }

      const type = String(msg?.type || '').trim();
      if (type === 'subscribe') {
        const scopeKey = normalizeWsScopeKey(msg?.scopeKey || msg?.scope || '');
        const prev = wsClients.get(ws) || {};
        wsClients.set(ws, { ...prev, scopeKey });
        sendWs(ws, { type: 'subscribed', scopeKey, timestamp: Date.now() });
        return;
      }

      if (type === 'unsubscribe') {
        const prev = wsClients.get(ws) || {};
        wsClients.set(ws, { ...prev, scopeKey: 'dashboard:main:chat:default' });
        sendWs(ws, { type: 'unsubscribed', timestamp: Date.now() });
        return;
      }

      if (type === 'ping') {
        sendWs(ws, { type: 'pong', timestamp: Date.now() });
        return;
      }

      if (type === 'chat_input') {
        const text = String(msg?.text || '').trim();
        const scopeKey = normalizeWsScopeKey(msg?.scopeKey || msg?.scope || wsClients.get(ws)?.scopeKey || '');
        const history = Array.isArray(msg?.history) ? msg.history : [];
        const messageId = String(msg?.messageId || '').trim();
        if (!text) {
          sendWs(ws, { type: 'error', error: 'text_required', messageId, timestamp: Date.now() });
          return;
        }

        const streamId = `stream:${messageId || Date.now()}`;
        sendWs(ws, {
          type: 'stream_start',
          streamId,
          role: 'assistant',
          scopeKey,
          timestamp: Date.now(),
          content: '处理中…',
        });

        try {
          const out = await dispatchDashboardChat({
            text,
            scope: scopeKey,
            history,
            metadata: { source: 'dashboard_ws', transport: 'ws', messageId },
          }, baseRouteCtx);

          sendWs(ws, {
            type: 'stream_end',
            streamId,
            taskId: String(out?.taskId || ''),
            role: String(out?.action === 'task' ? 'planner' : 'assistant'),
            content: String(out?.summary || ''),
            scopeKey,
            timestamp: Date.now(),
          });
        } catch (err) {
          sendWs(ws, {
            type: 'error',
            error: String(err?.message || err || 'ws_chat_dispatch_failed'),
            messageId,
            scopeKey,
            timestamp: Date.now(),
          });
        }
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
    });
    ws.on('error', () => {
      wsClients.delete(ws);
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const url = parseRequestUrl(req);
    if (url.pathname !== '/ws/chat') {
      writeHttpError(socket, 404, 'Not Found');
      return;
    }
    const queryToken = String(url.searchParams.get('token') || '').trim();
    const configuredToken = String(config.DASHBOARD_TOKEN || '').trim();
    const queryAuthorized = !configuredToken || queryToken === configuredToken;
    if (!isDashboardAuthorized(req) && !queryAuthorized) {
      writeHttpError(socket, 401, 'Unauthorized');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  server.on('close', () => {
    ctx.eventBus?.off?.('event', onEvent);
    for (const ws of wsClients.keys()) {
      try {
        ws.close();
      } catch {}
    }
  });

  return { server, wss, config, ctx, deskApi, routeContext: baseRouteCtx };
}

export async function startServer(config = loadIndexConfig()) {
  const { server, config: resolvedConfig } = await createServer(config);
  await new Promise((resolve) => {
    server.listen(resolvedConfig.PORT, resolvedConfig.BIND, resolve);
  });
  console.log(`[orchestrator] listening on ${resolvedConfig.BIND}:${resolvedConfig.PORT}`);
  console.log('[orchestrator] mode=team-runtime-v1');
  return { server, config: resolvedConfig };
}

const isDirectRun = (() => {
  const entry = process.argv?.[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  await startServer();
}

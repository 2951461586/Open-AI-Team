import { normalizeChannelMessage } from '@ai-team/team-runtime';
import { buildNonce, parseWechatXml } from '@ai-team/im-channels/channel-adapters/channel-wechat';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);
  try {
    return JSON.parse(raw || '{}');
  } catch (error) {
    error.rawBody = raw;
    throw error;
  }
}

function getChannelsConfig(ctx = {}) {
  const config = ctx.imChannelRouter?.config?.() || {};
  return config.channels && typeof config.channels === 'object' ? config.channels : {};
}

function getPathname(req) {
  try {
    return new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    return String(req.url || '').split('?')[0] || '/';
  }
}

function getSearchParams(req) {
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams;
  } catch {
    return new URLSearchParams(String(req.url || '').split('?')[1] || '');
  }
}

function matchTelegramWebhook(pathname = '') {
  const match = /^\/webhook\/telegram\/([^/]+)$/.exec(String(pathname || '').trim());
  return match ? decodeURIComponent(match[1]) : '';
}

async function handleTelegramWebhook(req, res, ctx = {}, pathname = '') {
  const { sendJson, imChannelRouter } = ctx;
  const incomingBotToken = matchTelegramWebhook(pathname);
  if (!incomingBotToken) return false;

  const telegramConfig = getChannelsConfig(ctx).telegram || {};
  const configuredBotToken = String(telegramConfig.botToken || '').trim();
  if (configuredBotToken && incomingBotToken !== configuredBotToken) {
    sendJson(res, 401, { ok: false, error: 'invalid_telegram_bot_token' });
    return true;
  }

  const secretToken = String(telegramConfig.webhook?.secretToken || '').trim();
  const providedSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  if (secretToken && providedSecret !== secretToken) {
    sendJson(res, 401, { ok: false, error: 'invalid_telegram_secret' });
    return true;
  }

  const payload = await readJsonBody(req);
  const adapter = imChannelRouter?.getAdapter?.('telegram');
  if (!adapter) {
    sendJson(res, 503, { ok: false, error: 'telegram_channel_not_ready' });
    return true;
  }

  const normalized = normalizeChannelMessage(adapter.normalizeInbound?.(payload) || payload);
  const out = await imChannelRouter.enqueueInbound(normalized, { webhook: 'telegram', reqHeaders: req.headers, raw: payload });
  sendJson(res, 200, out?.ok ? { ok: true } : { ok: false, error: out?.error || 'enqueue_failed' });
  return true;
}

async function handleFeishuWebhook(req, res, ctx = {}) {
  const { sendJson, imChannelRouter } = ctx;
  const feishuConfig = getChannelsConfig(ctx).feishu || {};
  const larkSignature = String(req.headers['x-lark-signature'] || '').trim();
  const ttToken = String(req.headers['x-tt-token'] || '').trim();
  if (!larkSignature && !ttToken) {
    sendJson(res, 401, { ok: false, error: 'missing_feishu_signature' });
    return true;
  }
  if (feishuConfig.verificationToken && ttToken && ttToken !== String(feishuConfig.verificationToken)) {
    sendJson(res, 401, { ok: false, error: 'invalid_feishu_token' });
    return true;
  }

  const payload = await readJsonBody(req);
  if (String(payload?.type || '') === 'url_verification') {
    sendJson(res, 200, { challenge: payload.challenge || '' });
    return true;
  }

  const adapter = imChannelRouter?.getAdapter?.('feishu');
  if (!adapter) {
    sendJson(res, 503, { ok: false, error: 'feishu_channel_not_ready' });
    return true;
  }

  const normalized = normalizeChannelMessage(adapter.normalizeInbound?.(payload) || payload);
  const out = await imChannelRouter.enqueueInbound(normalized, { webhook: 'feishu', reqHeaders: req.headers, raw: payload });
  sendJson(res, 200, out?.ok ? { ok: true } : { ok: false, error: out?.error || 'enqueue_failed' });
  return true;
}

async function handleQQWebhook(req, res, ctx = {}) {
  const { sendJson, imChannelRouter } = ctx;
  const payload = await readJsonBody(req);

  const adapter = imChannelRouter?.getAdapter?.('qq');
  if (!adapter) {
    sendJson(res, 503, { ok: false, error: 'qq_channel_not_ready' });
    return true;
  }

  const normalized = normalizeChannelMessage(adapter.normalizeInbound?.(payload) || payload);
  const out = await imChannelRouter.enqueueInbound(normalized, { webhook: 'qq', reqHeaders: req.headers, raw: payload });
  sendJson(res, 200, out?.ok ? { ok: true } : { ok: false, error: out?.error || 'enqueue_failed' });
  return true;
}

async function handleWechatVerification(req, res, ctx = {}) {
  const { imChannelRouter } = ctx;
  const adapter = imChannelRouter?.getAdapter?.('wechat');
  if (!adapter) {
    res.statusCode = 503;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('wechat_channel_not_ready');
    return true;
  }
  const query = getSearchParams(req);
  const signature = String(query.get('signature') || query.get('msg_signature') || '').trim();
  const timestamp = String(query.get('timestamp') || '').trim();
  const nonce = String(query.get('nonce') || '').trim();
  const echostr = String(query.get('echostr') || '').trim();
  if (!signature || !timestamp || !nonce || !echostr) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('missing_wechat_verification_params');
    return true;
  }
  if (!adapter.verifySignature?.({ signature, timestamp, nonce })) {
    res.statusCode = 401;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('invalid_wechat_signature');
    return true;
  }
  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(echostr);
  return true;
}

async function handleWechatWebhook(req, res, ctx = {}) {
  const { imChannelRouter } = ctx;
  const adapter = imChannelRouter?.getAdapter?.('wechat');
  if (!adapter) {
    ctx.sendJson?.(res, 503, { ok: false, error: 'wechat_channel_not_ready' });
    return true;
  }

  const query = getSearchParams(req);
  const signature = String(query.get('msg_signature') || query.get('signature') || '').trim();
  const timestamp = String(query.get('timestamp') || '').trim();
  const nonce = String(query.get('nonce') || '').trim();
  const rawXml = await readRawBody(req);
  const outerPayload = await parseWechatXml(rawXml || '<xml></xml>');
  const encrypted = String(outerPayload.Encrypt || '').trim();
  if (!signature || !timestamp || !nonce) {
    ctx.sendJson?.(res, 400, { ok: false, error: 'missing_wechat_signature' });
    return true;
  }
  if (!adapter.verifySignature?.({ signature, timestamp, nonce, encrypted })) {
    ctx.sendJson?.(res, 401, { ok: false, error: 'invalid_wechat_signature' });
    return true;
  }

  const plainXml = encrypted ? adapter.decryptMessage?.(encrypted) : rawXml;
  const payload = await parseWechatXml(plainXml || '<xml></xml>');
  const normalized = normalizeChannelMessage(adapter.normalizeInbound?.(payload) || payload);
  const out = await imChannelRouter.enqueueInbound(normalized, {
    webhook: 'wechat',
    reqHeaders: req.headers,
    raw: payload,
    encrypted: !!encrypted,
  });

  const shouldReply = String(payload.MsgType || '').toLowerCase() === 'event'
    && ['subscribe', 'scan'].includes(String(payload.Event || '').toLowerCase())
    && String(adapter.config?.autoReplyOnSubscribe || '').trim();
  if (shouldReply) {
    const responseTimestamp = String(Math.floor(Date.now() / 1000));
    const responseNonce = nonce || buildNonce(4);
    const body = await adapter.buildEncryptedReply({
      toUserName: payload.FromUserName,
      fromUserName: payload.ToUserName,
      content: String(adapter.config.autoReplyOnSubscribe),
      nonce: responseNonce,
      timestamp: responseTimestamp,
    });
    res.statusCode = 200;
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.end(body);
    return true;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/xml; charset=utf-8');
  res.end('success');
  return true;
}

export function tryHandleIMWebhookRoute(req, res, ctx = {}) {
  const pathname = getPathname(req);
  if (req.method === 'GET' && pathname === '/webhook/wechat') {
    void handleWechatVerification(req, res, ctx).catch((error) => {
      res.statusCode = 400;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(String(error?.message || error));
    });
    return true;
  }
  if (req.method !== 'POST') return false;
  if (pathname.startsWith('/webhook/telegram/')) {
    void handleTelegramWebhook(req, res, ctx, pathname).catch((error) => {
      ctx.sendJson?.(res, 400, { ok: false, error: String(error?.message || error) });
    });
    return true;
  }
  if (pathname === '/webhook/feishu') {
    void handleFeishuWebhook(req, res, ctx).catch((error) => {
      ctx.sendJson?.(res, 400, { ok: false, error: String(error?.message || error) });
    });
    return true;
  }
  if (pathname === '/webhook/qq') {
    void handleQQWebhook(req, res, ctx).catch((error) => {
      ctx.sendJson?.(res, 400, { ok: false, error: String(error?.message || error) });
    });
    return true;
  }
  if (pathname === '/webhook/wechat') {
    void handleWechatWebhook(req, res, ctx).catch((error) => {
      ctx.sendJson?.(res, 400, { ok: false, error: String(error?.message || error) });
    });
    return true;
  }
  return false;
}

export default tryHandleIMWebhookRoute;

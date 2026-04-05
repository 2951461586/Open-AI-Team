import { resolveDeliveryTarget } from '../team/team-delivery-target.mjs';
import { isTeamOutputReceipt, handleTeamOutputReceipt } from '../team/team-output-receipt-host.mjs';

function buildNormalizedIngressEvent(body = {}) {
  const kind = String(body?.kind || '').trim();
  const payload = body?.payload || {};
  const normalizedScopeKey = String(payload?.scopeKey || payload?.scope_key || body?.scopeKey || body?.scope_key || body?.scope || '');
  const normalizedDeliveryTarget = String(
    payload?.deliveryTarget
    || payload?.delivery_target
    || body?.deliveryTarget
    || body?.delivery_target
    || body?.target_id
    || body?.chat_id
    || body?.room
    || ''
  );
  const normalizedRecipientId = String(
    payload?.recipientId
    || payload?.recipient_id
    || body?.recipientId
    || body?.recipient_id
    || body?.target_id
    || body?.chat_id
    || body?.room
    || ''
  );
  const resolvedDelivery = resolveDeliveryTarget({
    scopeKey: normalizedScopeKey,
    deliveryTarget: normalizedDeliveryTarget,
    deliveryMode: String(payload?.deliveryMode || payload?.delivery_mode || body?.deliveryMode || body?.delivery_mode || ''),
    channel: String(payload?.channel || body?.channel || body?.surface || ''),
    recipientId: normalizedRecipientId,
    recipientType: String(payload?.recipientType || payload?.recipient_type || body?.recipientType || body?.recipient_type || ''),
  });

  const evt = (kind === 'team.async_ingress.v1' || kind === 'team.visible_ingress.v1')
    ? {
        ...payload,
        kind,
        ingressKind: kind,
        source: 'async_ingress',
        sourceEventId: String(payload?.messageId || payload?.message_id || body?.messageId || body?.message_id || ''),
        message_id: String(payload?.messageId || payload?.message_id || body?.messageId || body?.message_id || ''),
        messageId: String(payload?.messageId || payload?.message_id || body?.messageId || body?.message_id || ''),
        scope_key: normalizedScopeKey,
        scopeKey: normalizedScopeKey,
        deliveryTarget: String(resolvedDelivery?.deliveryTarget || normalizedDeliveryTarget || ''),
        delivery_target: String(resolvedDelivery?.deliveryTarget || normalizedDeliveryTarget || ''),
        recipientId: String(resolvedDelivery?.recipientId || resolvedDelivery?.deliveryTarget || normalizedRecipientId || normalizedDeliveryTarget || ''),
        recipient_id: String(resolvedDelivery?.recipientId || resolvedDelivery?.deliveryTarget || normalizedRecipientId || normalizedDeliveryTarget || ''),
        recipientType: String(resolvedDelivery?.recipientType || ''),
        recipient_type: String(resolvedDelivery?.recipientType || ''),
        deliveryMode: String(resolvedDelivery?.deliveryMode || ''),
        delivery_mode: String(resolvedDelivery?.deliveryMode || ''),
        originNode: String(payload?.originNode || payload?.origin_node || ''),
        origin_node: String(payload?.originNode || payload?.origin_node || ''),
        sender_id: String(payload?.senderId || payload?.sender_id || ''),
        senderId: String(payload?.senderId || payload?.sender_id || ''),
        channel: String(resolvedDelivery?.channel || payload?.channel || ''),
        text: String(payload?.text || ''),
        taskMode: String(payload?.taskMode || payload?.task_mode || ''),
        riskLevel: String(payload?.riskLevel || payload?.risk_level || ''),
      }
    : body;

  return { kind, evt };
}

function readJsonBody(req, res, sendJson, onBody) {
  let buf = '';
  req.on('data', (c) => (buf += c));
  req.on('end', async () => {
    try {
      const body = JSON.parse(buf || '{}');
      await onBody(body);
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
  });
}

function buildRetiredLegacyRouteBody({
  surface = '',
  method = '',
  replacement = '',
  reason = 'legacy_receiver_retired',
  extra = {},
} = {}) {
  return {
    ok: false,
    error: 'legacy_receiver_retired',
    reason,
    surface,
    method,
    retired: true,
    deliveryLane: 'retired',
    replacement,
    ...extra,
  };
}

export function tryHandleEntryRoute(req, res, ctx = {}) {
  const {
    isOrchAuthorized,
    sendJson,
    consumeWebhookEvent,
  } = ctx;

  if (req.method === 'POST' && req.url === '/webhook/qq') {
    readJsonBody(req, res, sendJson, async (body) => {
      const { evt } = buildNormalizedIngressEvent(body);
      const out = await consumeWebhookEvent(evt, ctx);
      if (out?.entry && typeof out.entry === 'object') {
        out.entry.compatSurface = 'webhook/qq';
        out.entry.ingressSurface = 'compat';
      }
      sendJson(res, out?.ok === false ? 400 : 200, out, out?.extraHeaders || {});
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/ingress') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    readJsonBody(req, res, sendJson, async (body) => {
      const { evt } = buildNormalizedIngressEvent(body);
      const out = await consumeWebhookEvent(evt, ctx);
      if (out?.entry && typeof out.entry === 'object') {
        out.entry.compatSurface = '';
        out.entry.ingressSurface = 'internal/team/ingress';
      }
      sendJson(res, out?.ok === false ? 400 : 200, out, out?.extraHeaders || {});
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/commands/receipt') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    readJsonBody(req, res, sendJson, (body) => {
      if (isTeamOutputReceipt(body)) {
        const out = handleTeamOutputReceipt(body, ctx);
        sendJson(res, out?.ok === false ? 400 : 200, out);
        return;
      }
      sendJson(res, 410, buildRetiredLegacyRouteBody({
        surface: '/internal/commands/receipt',
        method: 'POST',
        replacement: '/internal/team/ingress + team_output_receipt',
        reason: 'legacy_debate_receipt_retired',
        extra: {
          accepted: false,
          advanced: false,
          type: 'legacy_debate_receipt',
        },
      }));
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/debate/sent') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    readJsonBody(req, res, sendJson, () => {
      sendJson(res, 410, buildRetiredLegacyRouteBody({
        surface: '/internal/debate/sent',
        method: 'POST',
        replacement: '/internal/team/ingress',
        reason: 'legacy_debate_sent_retired',
      }));
    });
    return true;
  }

  if (req.method === 'GET' && (req.url === '/internal/debate/governance' || req.url.startsWith('/internal/debate/governance?'))) {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const limitRaw = u.searchParams.get('limit');
      const limitNum = limitRaw == null || limitRaw === '' ? 50 : Number(limitRaw);
      if (!Number.isFinite(limitNum) || limitNum < 1) {
        sendJson(res, 400, { ok: false, error: 'bad_request' });
        return true;
      }
      sendJson(res, 410, buildRetiredLegacyRouteBody({
        surface: '/internal/debate/governance',
        method: 'GET',
        replacement: 'reference-only docs / archived diagnostics',
        reason: 'legacy_debate_governance_retired',
      }));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return true;
  }

  if (req.method === 'GET' && req.url.startsWith('/internal/debate/governance/')) {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const prefix = '/internal/debate/governance/';
      const debateId = decodeURIComponent(String(u.pathname.slice(prefix.length) || '')).trim();
      if (!debateId) {
        sendJson(res, 400, { ok: false, error: 'bad_request' });
        return true;
      }
      sendJson(res, 410, buildRetiredLegacyRouteBody({
        surface: '/internal/debate/governance/:debateId',
        method: 'GET',
        replacement: 'reference-only docs / archived diagnostics',
        reason: 'legacy_debate_governance_retired',
        extra: {
          debateId,
        },
      }));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return true;
  }

  return false;
}

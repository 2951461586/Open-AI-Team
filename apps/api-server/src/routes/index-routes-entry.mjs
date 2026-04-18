import path from 'node:path';
import { resolveDeliveryTarget } from '../team/team-delivery-target.mjs';
import { isTeamOutputReceipt, handleTeamOutputReceipt } from '../team/team-output-receipt-host.mjs';
import { PersonalAgent } from '../../../../src/personal-agent/personal-agent.mjs';
import { loadPersonalConfig, savePersonalConfig } from '../../../../src/personal-agent/personal-agent-config.mjs';
import { loadTeamModelsConfig, saveTeamModelsConfig } from '@ai-team/team-runtime';

const DEFAULT_PERSONAL_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'personal-agent.json');
const personalAgentRegistry = new Map();

function resolvePersonalConfigPath(body = {}, reqUrl = '') {
  const fallback = DEFAULT_PERSONAL_CONFIG_PATH;
  let queryPath = '';
  try {
    const u = new URL(reqUrl || '', 'http://127.0.0.1');
    queryPath = String(u.searchParams.get('path') || '').trim();
  } catch {}
  return path.resolve(String(body?.path || body?.configPath || queryPath || fallback));
}

function getOrCreatePersonalAgent(config) {
  const normalized = loadPersonalConfig(resolvePersonalConfigPath(config, ''));
  const cacheKey = normalized.id;
  const existing = personalAgentRegistry.get(cacheKey);
  if (existing) {
    existing.config = normalized;
    return existing;
  }
  const agent = new PersonalAgent(normalized);
  personalAgentRegistry.set(cacheKey, agent);
  return agent;
}

async function handlePersonalMessage(body = {}, sendJson, res) {
  const configPath = resolvePersonalConfigPath(body, '');
  const config = loadPersonalConfig(configPath);
  const agent = personalAgentRegistry.get(config.id) || new PersonalAgent(config);
  personalAgentRegistry.set(config.id, agent);
  const out = await agent.process(String(body?.message || body?.text || ''), body?.context || {});
  sendJson(res, 200, {
    ok: true,
    configPath,
    agent: agent.getState(),
    result: out,
  });
}

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

function governanceActorFromRequest(req, body = {}) {
  return String(
    body?.approvedBy
    || body?.rejectedBy
    || body?.operator
    || req?.headers?.['x-governance-actor']
    || req?.headers?.['x-actor-id']
    || 'orchestrator'
  ).trim();
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
    governanceRuntime,
  } = ctx;

  if (req.method === 'POST' && req.url === '/api/personal') {
    readJsonBody(req, res, sendJson, async (body) => {
      await handlePersonalMessage(body, sendJson, res);
    });
    return true;
  }

  if (req.method === 'GET' && (req.url === '/api/personal/config' || req.url.startsWith('/api/personal/config?'))) {
    try {
      const configPath = resolvePersonalConfigPath({}, req.url);
      const config = loadPersonalConfig(configPath);
      sendJson(res, 200, { ok: true, configPath, config });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return true;
  }

  if (req.method === 'POST' && req.url === '/api/personal/config') {
    readJsonBody(req, res, sendJson, async (body) => {
      try {
        const configPath = resolvePersonalConfigPath(body, req.url);
        const next = savePersonalConfig(body?.config || body || {}, configPath);
        const existing = personalAgentRegistry.get(next.id);
        if (existing) {
          await existing.shutdown();
          personalAgentRegistry.delete(next.id);
        }
        sendJson(res, 200, { ok: true, configPath, config: next });
      } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e) });
      }
    });
    return true;
  }

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

  if (req.method === 'GET' && (req.url === '/internal/team/governance/pending' || req.url.startsWith('/internal/team/governance/pending?'))) {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const scope = String(u.searchParams.get('scope') || '').trim();
      const out = governanceRuntime?.listPendingApprovals?.(scope) || { ok: true, items: [], total: 0, scope };
      sendJson(res, 200, out);
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/governance/approve') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    readJsonBody(req, res, sendJson, async (body) => {
      try {
        const approvalId = String(body?.approvalId || '').trim();
        if (!approvalId) {
          sendJson(res, 400, { ok: false, error: 'approvalId_required' });
          return;
        }
        const approvedBy = governanceActorFromRequest(req, body);
        const comment = String(body?.comment || '').trim();
        const out = governanceRuntime?.approvePending?.(approvalId, approvedBy, comment);
        sendJson(res, 200, out || { ok: false, error: 'governance_runtime_unavailable' });
      } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e) });
      }
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/governance/reject') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    readJsonBody(req, res, sendJson, async (body) => {
      try {
        const approvalId = String(body?.approvalId || '').trim();
        if (!approvalId) {
          sendJson(res, 400, { ok: false, error: 'approvalId_required' });
          return;
        }
        const rejectedBy = governanceActorFromRequest(req, body);
        const comment = String(body?.comment || '').trim();
        const out = governanceRuntime?.rejectPending?.(approvalId, rejectedBy, comment);
        sendJson(res, 200, out || { ok: false, error: 'governance_runtime_unavailable' });
      } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e) });
      }
    });
    return true;
  }


  if (req.method === 'GET' && req.url?.startsWith('/api/trace/recent')) {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const limit = Math.max(1, Number(u.searchParams.get('limit') || 50));
      Promise.resolve(ctx.traceCollector?.listRecent?.(limit) || { ok: true, traces: [] })
        .then((out) => sendJson(res, 200, out || { ok: true, traces: [] }))
        .catch((e) => sendJson(res, 400, { ok: false, error: String(e) }));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/trace?')) {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const traceId = String(u.searchParams.get('traceId') || '').trim();
      if (!traceId) {
        sendJson(res, 400, { ok: false, error: 'traceId_required' });
        return true;
      }
      Promise.resolve(ctx.traceCollector?.queryByTraceId?.(traceId) || { ok: true, traceId, spans: [], tree: [] })
        .then((out) => sendJson(res, 200, out || { ok: true, traceId, spans: [], tree: [] }))
        .catch((e) => sendJson(res, 400, { ok: false, error: String(e) }));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
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

  if (req.method === 'GET' && (req.url === '/api/v1/team/config/models' || req.url.startsWith('/api/v1/team/config/models?'))) {
    try {
      const config = loadTeamModelsConfig();
      sendJson(res, 200, { ok: true, config });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return true;
  }

  if (req.method === 'POST' && req.url === '/api/v1/team/config/models') {
    readJsonBody(req, res, sendJson, async (body) => {
      try {
        const { config, apiKey } = body;
        if (!config) {
          sendJson(res, 400, { ok: false, error: 'config_required' });
          return;
        }
        const saved = saveTeamModelsConfig(config);
        if (apiKey) {
          process.env.OPENAI_API_KEY = String(apiKey);
        }
        sendJson(res, 200, { ok: true, config: saved });
      } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e) });
      }
    });
    return true;
  }

  return false;
}

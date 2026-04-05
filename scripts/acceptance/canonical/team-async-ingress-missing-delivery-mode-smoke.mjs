import { randomUUID } from 'node:crypto';
import { loadIndexConfig } from '../../../src/index-env.mjs';
import { loadLiveEnvToken } from '../../../src/index-host-config.mjs';

function fail(summary, details = {}) {
  console.log(JSON.stringify({ ok: false, summary, ...details }, null, 2));
  process.exit(1);
}

const config = loadIndexConfig();
const orchToken = loadLiveEnvToken('ORCH_KICK_TOKEN', config);
const deliveryTarget = `288888${String(Math.floor(Math.random() * 9000) + 1000)}`;
const scopeKey = `qq:${deliveryTarget}`;
const messageId = `async-ingress:missing-delivery-mode:${randomUUID()}`;

const payload = {
  kind: 'team.async_ingress.v1',
  payload: {
    messageId,
    scopeKey,
    deliveryTarget,
    originNode: 'violet',
    senderId: 'missing-delivery-mode-smoke',
    channel: 'qqbot',
    taskMode: 'analysis',
    text: '请深度分析 Orchestrator 的 delivery contract 收口方案，并给出执行计划。这个用例用于验收 missing deliveryMode 时 ingress normalize 仍能自动补齐 group delivery contract。',
  },
};

const res = await fetch('http://127.0.0.1:19090/internal/team/ingress', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(orchToken ? { 'x-orch-token': orchToken } : {}),
  },
  body: JSON.stringify(payload),
});

let body = null;
try {
  body = await res.json();
} catch (err) {
  fail('webhook_response_not_json', { status: res.status, error: String(err) });
}

if (!res.ok || body?.ok !== true || body?.mode !== 'team_task') {
  fail('webhook_not_team_task', { status: res.status, body });
}

if (String(body?.entry?.deliveryMode || '') !== 'group') {
  fail('webhook_missing_inferred_delivery_mode', { status: res.status, body });
}

if (String(body?.entry?.deliveryTarget || '') !== deliveryTarget) {
  fail('webhook_delivery_target_mismatch', { status: res.status, body, expected: deliveryTarget });
}

if (String(body?.entry?.recipientId || '') !== deliveryTarget || String(body?.entry?.recipientType || '') !== 'group') {
  fail('webhook_missing_recipient_fields', { status: res.status, body, expectedRecipientId: deliveryTarget, expectedRecipientType: 'group' });
}

const q = await fetch(`http://127.0.0.1:19090/state/team/ingress?limit=10&originNode=violet&deliveryTarget=${encodeURIComponent(deliveryTarget)}&recipientId=${encodeURIComponent(deliveryTarget)}&recipientType=group`);
const jq = await q.json().catch(() => ({}));
const hit = Array.isArray(jq?.items) ? jq.items.find((x) => String(x?.sourceEventId || '') === messageId) : null;

if (!q.ok || !hit) {
  fail('ingress_query_missing_event', { status: q.status, body: jq, expectedMessageId: messageId, deliveryTarget });
}

if (String(hit?.deliveryMode || '') !== 'group') {
  fail('ingress_query_missing_inferred_delivery_mode', { status: q.status, body: jq, hit });
}

if (String(hit?.recipientId || '') !== deliveryTarget || String(hit?.recipientType || '') !== 'group') {
  fail('ingress_query_missing_recipient_fields', { status: q.status, body: jq, hit, expectedRecipientId: deliveryTarget, expectedRecipientType: 'group' });
}

console.log(JSON.stringify({
  ok: true,
  summary: {
    messageId,
    scopeKey,
    deliveryTarget,
    webhookMode: String(body?.mode || ''),
    webhookEntryDeliveryMode: String(body?.entry?.deliveryMode || ''),
    webhookEntryChannel: String(body?.entry?.channel || ''),
    webhookEntryRecipientId: String(body?.entry?.recipientId || ''),
    webhookEntryRecipientType: String(body?.entry?.recipientType || ''),
    ingressHitDeliveryMode: String(hit?.deliveryMode || ''),
    ingressHitRecipientId: String(hit?.recipientId || ''),
    ingressHitRecipientType: String(hit?.recipientType || ''),
    ingressHitChannel: String(hit?.channel || ''),
    ingressHitSource: String(hit?.source || ''),
    ingressHitIngressKind: String(hit?.ingressKind || ''),
  },
  response: body,
  ingressHit: hit,
}, null, 2));

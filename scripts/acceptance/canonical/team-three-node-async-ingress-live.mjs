import { randomUUID } from 'node:crypto';

async function postJson(url, body, timeoutMs = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text || '{}'); } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

async function getJson(url, timeoutMs = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctl.signal });
    const json = await res.json();
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const acceptance = 'team-three-node-async-ingress-live.v1';
const traceId = `acceptance:async-ingress:${randomUUID()}`;
const deliveryTarget = `299999${String(Math.floor(Math.random() * 9000) + 1000)}`;
const scopeKey = `qq:${deliveryTarget}`;

const reqBody = {
  kind: 'team.async_ingress.v1',
  payload: {
    messageId: traceId,
    scopeKey,
    deliveryTarget,
    originNode: 'violet',
    senderId: 'acceptance.async-ingress',
    channel: 'qqbot',
    taskMode: 'analysis',
    riskLevel: 'medium',
    text: '【验收】three-node async ingress live：violet -> laoda webhook -> team runtime.',
  },
};

const startedAt = Date.now();
const steps = [];

const post = await postJson('http://127.0.0.1:19090/webhook/qq', reqBody, 8000);
steps.push({ key: 'post', label: 'post async ingress envelope', ok: post.ok, status: post.status, response: post.json });

await sleep(1200);

const ingress = await getJson(`http://127.0.0.1:19090/state/team/ingress?limit=30&originNode=violet&deliveryTarget=${encodeURIComponent(deliveryTarget)}`, 8000);
const items = Array.isArray(ingress?.json?.items) ? ingress.json.items : [];
const hit = items.find((x) => String(x?.sourceEventId || '') === traceId) || null;
steps.push({
  key: 'query',
  label: 'query ingress list',
  ok: !!hit,
  summary: {
    items: items.length,
    hit: !!hit,
    taskId: String(hit?.taskId || ''),
    ingressKind: String(hit?.ingressKind || ''),
    source: 'async_ingress',
  },
});

const ok = steps.every((s) => s.ok);
const finishedAt = Date.now();
console.log(JSON.stringify({
  ok,
  acceptance,
  traceId,
  startedAt,
  finishedAt,
  durationMs: finishedAt - startedAt,
  steps,
  firstFailure: steps.find((s) => !s.ok) || null,
}, null, 2));

import { Hono } from 'hono';
import { requireOrchAuth } from '../../middleware/auth.mjs';
import { buildEnvelope, buildErrorEnvelope } from '../../middleware/response.mjs';

export function createInternalRoutes(ctx = {}) {
  const app = new Hono();
  const { teamStore, tlRuntime, nativeChat, sendJson } = ctx;

  app.post('/team/ingress', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    return c.json(buildEnvelope({
      route: 'internal/team/ingress',
      resourceKind: 'team_ingress',
      payload: { ok: true, ...body },
    }));
  });

  app.post('/team/task', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    const task = teamStore.createTask?.(body || {});
    return c.json({ ok: !!task, task });
  });

  app.post('/team/message', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    const teamId = String(body?.teamId || '').trim();
    const fromMemberId = String(body?.fromMemberId || '').trim();
    const toMemberId = String(body?.toMemberId || '').trim();
    const text = String(body?.text || '').trim();
    const kind = String(body?.kind || 'agent.message').trim();

    if (!teamId) return c.json({ ok: false, error: 'team_id_required' }, 400);
    if (!fromMemberId) return c.json({ ok: false, error: 'from_member_id_required' }, 400);
    if (!toMemberId) return c.json({ ok: false, error: 'to_member_id_required' }, 400);
    if (!text) return c.json({ ok: false, error: 'text_required' }, 400);

    const msg = teamStore.appendMailboxMessage?.({
      messageId: `msg:${crypto.randomUUID()}`,
      teamId,
      taskId: String(body?.taskId || '').trim(),
      kind,
      fromMemberId,
      toMemberId,
      payload: { text },
      status: 'delivered',
      createdAt: Date.now(),
      deliveredAt: Date.now(),
    });

    return c.json({ ok: !!msg, message: msg });
  });

  app.post('/team/dispatch', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    const scopeKey = String(body?.scopeKey || body?.scope || '').trim();

    if (!text) return c.json({ ok: false, error: 'text_required' }, 400);
    if (!scopeKey) return c.json({ ok: false, error: 'scope_key_required' }, 400);

    const { createTaskDispatcher } = await import('@ai-team/team-runtime');
    const dispatcher = createTaskDispatcher({ teamStore, tlRuntime, nativeChat });
    const result = await dispatcher.handleMessage({ text, scopeKey, metadata: body?.metadata || {} });

    return c.json(result);
  });

  app.post('/team/dispatch/classify', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = String(body?.text || '').trim();

    const { createTaskDispatcher } = await import('@ai-team/team-runtime');
    const dispatcher = createTaskDispatcher({ teamStore });
    const classification = dispatcher.classifyMessage({ text, metadata: body?.metadata || {} });

    return c.json({ ok: true, classification });
  });

  app.post('/team/control', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    return c.json(buildEnvelope({
      route: 'internal/team/control',
      resourceKind: 'team_control',
      payload: { ok: true, ...body },
    }));
  });

  app.get('/team/governance/pending', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    return c.json(buildEnvelope({
      route: 'internal/team/governance/pending',
      resourceKind: 'pending_governance',
      payload: { ok: true, items: [] },
    }));
  });

  app.post('/team/governance/approve', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, action: 'approve', ...body });
  });

  app.post('/team/governance/reject', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, action: 'reject', ...body });
  });

  app.post('/team/resident/heartbeat', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, ...body });
  });

  app.post('/team/resident/sweep', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, ...body });
  });

  app.post('/team/agent/register', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, agent: body });
  });

  app.post('/team/agent/heartbeat', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, ...body });
  });

  app.post('/team/agent/drain', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, ...body });
  });

  app.post('/team/agent/deregister', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, ...body });
  });

  app.post('/commands/receipt', async (c) => {
    const unauthorized = requireOrchAuth(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, receipt: body });
  });

  return app;
}

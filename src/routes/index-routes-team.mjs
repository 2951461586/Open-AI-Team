// ─── index-routes-team.mjs ────────────────────────────────────────
// P3 cleanup: pipeline orchestration routes retired.
// All execution is now handled by TL runtime (team-tl-runtime.mjs).
//
// Surviving routes:
//   /internal/team/task           — thin store write (regression + manual)
//   /internal/team/message        — thin store write (manual recovery)
//   /internal/team/plan           — 410 Gone (pipeline retired)
//   /internal/team/review         — 410 Gone (pipeline retired)
//   /internal/team/decision       — 410 Gone (pipeline retired)
//   /internal/team/judge/run      — 410 Gone (pipeline retired)
//   /internal/team/executor/run   — 410 Gone (pipeline retired)
//   /internal/team/executor-result — 410 Gone (pipeline retired)
//   /internal/team/reroute/consume — 410 Gone (pipeline retired)
//
// Delegates:
//   tryHandleTeamResidentRoute    — resident heartbeat (alive)
//   tryHandleTeamRuntimeExecRoute — 410 tombstones (alive)
//   tryHandleTeamControlRoute     — dashboard manual control (alive)
//   tryHandleTeamDispatchRouteV2  — TL-driven dispatch (alive)
//
// Original: archive/pipeline-adapters/index-routes-team-pre-p3.mjs
// ──────────────────────────────────────────────────────────────────

import { tryHandleTeamResidentRoute } from './team-route-resident.mjs';
import { tryHandleTeamRuntimeExecRoute } from './team-route-runtime-exec.mjs';
import { tryHandleTeamControlRoute } from './team-route-control.mjs';
import { tryHandleTeamDispatchRoute as tryHandleTeamDispatchRouteV2 } from './team-route-dispatch-v2.mjs';

// ── Shared 410 helper ───────────────────────────────────────────────
function send410(res, sendJson, route) {
  sendJson(res, 410, {
    ok: false,
    error: 'pipeline_retired',
    message: `${route} retired in P3 pipeline cleanup. All execution is now TL-driven.`,
    see: 'docs/ops/p3-pipeline-routes-retirement-2026-03-28.md',
  });
}

export function tryHandleTeamRoute(req, res, ctx = {}) {
  const {
    isOrchAuthorized,
    isDashboardAuthorized,
    sendJson,
    handleJsonBody,
    teamStore,
  } = ctx;

  // ── /internal/team/task — thin store write (kept for regression + manual recovery) ──
  if (req.method === 'POST' && req.url === '/internal/team/task') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => ({ ok: true, task: teamStore.createTask(body || {}) }));
    return true;
  }

  // ── Resident heartbeat (alive) ──
  if (tryHandleTeamResidentRoute(req, res, ctx)) return true;

  // ── /internal/team/message — thin store write (kept for manual recovery) ──
  if (req.method === 'POST' && req.url === '/internal/team/message') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      const teamId = String(body?.teamId || '').trim();
      const taskId = String(body?.taskId || '').trim();
      const fromMemberId = String(body?.fromMemberId || '').trim();
      const toMemberId = String(body?.toMemberId || '').trim();
      const text = String(body?.text || '').trim();
      const kind = String(body?.kind || 'agent.message').trim();
      if (!teamId) return { ok: false, error: 'team_id_required' };
      if (!fromMemberId) return { ok: false, error: 'from_member_id_required' };
      if (!toMemberId) return { ok: false, error: 'to_member_id_required' };
      if (!text) return { ok: false, error: 'text_required' };
      const msg = teamStore.appendMailboxMessage({
        messageId: `msg:${crypto.randomUUID()}`,
        teamId,
        taskId,
        kind,
        fromMemberId,
        toMemberId,
        payload: { text },
        status: 'delivered',
        createdAt: Date.now(),
        deliveredAt: Date.now(),
      });
      return { ok: !!msg, message: msg };
    });
    return true;
  }

  // ── Pipeline routes: 410 Gone ──
  if (req.method === 'POST' && req.url === '/internal/team/plan') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/plan');
    return true;
  }
  if (req.method === 'POST' && req.url === '/internal/team/review') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/review');
    return true;
  }
  if (req.method === 'POST' && req.url === '/internal/team/decision') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/decision');
    return true;
  }

  // ── P2 pipeline callback tombstones ──
  if (tryHandleTeamRuntimeExecRoute(req, res, ctx)) return true;

  // ── Dashboard manual control (alive) ──
  if (tryHandleTeamControlRoute(req, res, { ...ctx, isDashboardAuthorized })) return true;

  if (req.method === 'POST' && req.url === '/internal/team/judge/run') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/judge/run');
    return true;
  }
  if (req.method === 'POST' && req.url === '/internal/team/executor/run') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/executor/run');
    return true;
  }
  if (req.method === 'POST' && req.url === '/internal/team/executor-result') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/executor-result');
    return true;
  }
  if (req.method === 'POST' && req.url === '/internal/team/reroute/consume') {
    if (!isOrchAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return true; }
    send410(res, sendJson, '/internal/team/reroute/consume');
    return true;
  }

  // ── TL-driven dispatch (alive) ──
  if (tryHandleTeamDispatchRouteV2(req, res, ctx)) return true;

  return false;
}

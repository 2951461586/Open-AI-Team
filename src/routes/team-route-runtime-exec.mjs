// ─── team-route-runtime-exec.mjs ─────────────────────────────────
// P2 retirement: pipeline callback routes (planner-completion, critic-completion,
// executor-completion, executor-result) archived.
// All routes now return 410 Gone so old clients get a clear signal.
// Original: archive/pipeline-adapters/team-route-runtime-exec.mjs
// ──────────────────────────────────────────────────────────────────

function sendJson(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(s);
}

const RETIRED_ROUTES = [
  '/internal/team/planner-completion',
  '/internal/team/critic-completion',
  '/internal/team/executor-completion',
  '/internal/team/executor-result',
];

export function tryHandleTeamRuntimeExecRoute(req, res, ctx) {
  const url = String(req?.url || '').split('?')[0];
  if (req.method === 'POST' && RETIRED_ROUTES.includes(url)) {
    sendJson(res, 410, {
      ok: false,
      error: 'pipeline_retired',
      message: `${url} retired in P2 pipeline cleanup. Use TL runtime for all role execution.`,
    });
    return true;
  }
  return false;
}

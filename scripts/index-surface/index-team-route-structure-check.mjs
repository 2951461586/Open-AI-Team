import fs from 'node:fs';

const indexPath = new URL('../../src/index.mjs', import.meta.url);
const text = fs.readFileSync(indexPath, 'utf8');

const checks = {
  importsRegistrar: text.includes("import { tryHandleTeamRoute } from './routes/index-routes-team.mjs';"),
  callsRegistrar: text.includes('if (tryHandleTeamRoute(req, res, baseRouteCtx)) return;') || text.includes('if (tryHandleTeamRoute(req, res, {'),
  noInlineTask: !text.includes("if (req.method === 'POST' && req.url === '/internal/team/task')"),
  noInlinePlan: !text.includes("if (req.method === 'POST' && req.url === '/internal/team/plan')"),
  noInlineReview: !text.includes("if (req.method === 'POST' && req.url === '/internal/team/review')"),
  noInlinePlannerCompletion: !text.includes("if (req.method === 'POST' && req.url === '/internal/team/planner-completion')"),
  noInlineDecision: !text.includes("if (req.method === 'POST' && req.url === '/internal/team/decision')"),
  noInlineRerouteConsume: !text.includes("if (req.method === 'POST' && req.url === '/internal/team/reroute/consume')"),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);

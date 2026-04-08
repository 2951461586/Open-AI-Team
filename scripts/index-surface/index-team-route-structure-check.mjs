import fs from 'node:fs';

const indexPath = new URL('../../apps/api-server/src/index.mjs', import.meta.url);
const registrarPath = new URL('../../apps/api-server/src/route-registrar.mjs', import.meta.url);
const routePath = new URL('../../apps/api-server/src/routes/index-routes-team.mjs', import.meta.url);
const registrarText = fs.readFileSync(registrarPath, 'utf8');
const routeText = fs.readFileSync(routePath, 'utf8');
const text = fs.readFileSync(indexPath, 'utf8');

const checks = {
  importsRegistrar: text.includes("import { tryHandleRegisteredRoute } from './route-registrar.mjs';") && registrarText.includes("import { tryHandleTeamRoute } from './routes/index-routes-team.mjs';") && routeText.includes("from '../team/desk-api.mjs'"),
  callsRegistrar: text.includes('if (tryHandleRegisteredRoute(req, res, baseRouteCtx)) return;') || text.includes('if (tryHandleRegisteredRoute(req, res, {'),
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

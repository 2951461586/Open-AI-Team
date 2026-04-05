import fs from 'node:fs';

const indexPath = new URL('../../src/index.mjs', import.meta.url);
const text = fs.readFileSync(indexPath, 'utf8');

const checks = {
  importsRegistrar: text.includes("import { tryHandleHealthStateRoute } from './routes/index-routes-health-state.mjs';"),
  callsRegistrar: text.includes('if (tryHandleHealthStateRoute(req, res, baseRouteCtx)) return;') || text.includes('if (tryHandleHealthStateRoute(req, res, {'),
  noInlineHealth: !text.includes("if (req.method === 'GET' && req.url === '/health')"),
  noInlineStateRecent: !text.includes("if (req.method === 'GET' && req.url?.startsWith('/state/recent'))"),
  noInlineStateDebate: !text.includes("if (req.method === 'GET' && req.url === '/state/debate')"),
  noInlineStateTeam: !text.includes("if (req.method === 'GET' && req.url === '/state/team')"),
  noInlineStateTasks: !text.includes("if (req.method === 'GET' && req.url?.startsWith('/state/team/tasks'))"),
  noInlineStateMailbox: !text.includes("if (req.method === 'GET' && req.url?.startsWith('/state/team/mailbox'))"),
  noInlineStateBlackboard: !text.includes("if (req.method === 'GET' && req.url?.startsWith('/state/team/blackboard'))"),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);

import fs from 'node:fs';

const indexPath = new URL('../../src/index.mjs', import.meta.url);
const webhookPath = new URL('../../src/webhook-event-router.mjs', import.meta.url);
const policyPath = new URL('../../src/team/team-policy.mjs', import.meta.url);
const debateDir = new URL('../../src/debate', import.meta.url);
const text = fs.readFileSync(indexPath, 'utf8');
const webhookText = fs.readFileSync(webhookPath, 'utf8');
const policyText = fs.readFileSync(policyPath, 'utf8');

const checks = {
  importsEntryRegistrar: text.includes("import { tryHandleEntryRoute } from './routes/index-routes-entry.mjs';"),
  importsWebhookRouter: text.includes("import { consumeWebhookEvent } from './webhook-event-router.mjs';"),
  noDebateImports: !text.includes("from './debate/"),
  callsEntryRegistrar: text.includes('if (tryHandleEntryRoute(req, res, baseRouteCtx)) return;') || text.includes('if (tryHandleEntryRoute(req, res, {'),
  noInlineWebhook: !text.includes("if (req.method === 'POST' && req.url === '/webhook/qq')"),
  noInlineReceipt: !text.includes("if (req.method === 'POST' && req.url === '/internal/commands/receipt')"),
  noInlineDebateSent: !text.includes("if (req.method === 'POST' && req.url === '/internal/debate/sent')"),
  webhookNoDecisionFromEvent: !webhookText.includes('decisionFromEvent'),
  webhookNoDebateEnvelope: !webhookText.includes('x-debate-envelope'),
  webhookSimpleReplyFallback: webhookText.includes("mode: 'simple_reply'") && webhookText.includes("reason: 'team_runtime_simple_reply'"),
  policyNoDebateMode: !policyText.includes("return 'debate';"),
  srcDebateRemoved: !fs.existsSync(debateDir),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);

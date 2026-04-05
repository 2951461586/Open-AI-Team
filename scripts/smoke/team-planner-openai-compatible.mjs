import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';

const PORT = Number(process.env.PORT || 19097);
const ORCH_KICK_TOKEN = String(process.env.ORCH_KICK_TOKEN || 'test-orch-kick-token');

process.env.PORT = String(PORT);
process.env.ORCH_KICK_TOKEN = ORCH_KICK_TOKEN;
process.env.TEAM_PLANNER_RUNTIME = 'openai-compatible';
process.env.TEAM_PLANNER_OPENAI_BASE_URL = `http://127.0.0.1:${PORT}`;
process.env.TEAM_PLANNER_OPENAI_MODEL = 'mock-planner';
process.env.TEAM_PLANNER_TIMEOUT_MS = '10000';

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

let ctx = null;
const requests = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    requests.push({ kind: 'chat.completions', body });

    const content = JSON.stringify({
      ok: true,
      type: 'team.plan.v2',
      contractVersion: 'planner.plan.v2',
      summary: 'openai-compatible planner runtime produced a valid structured plan.',
      steps: ['读取任务上下文', '生成结构化计划', '通过 orchestrator completion 入口落地'],
      risks: ['代理输出格式可能漂移'],
      successCriteria: ['plan_is_actionable', 'steps_are_ordered', 'risks_are_explicit'],
      evidenceRequirements: ['task_context_cited', 'steps_have_exit_criteria', 'risks_have_mitigation'],
      source: 'planner_openai_compatible_smoke',
    });

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: `chatcmpl_${randomUUID()}`,
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/internal/team/planner-completion') {
    const token = String(req.headers['x-orch-token'] || '');
    if (token !== ORCH_KICK_TOKEN) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
      return;
    }

    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    requests.push({ kind: 'planner-completion', body });

    const task = ctx?.teamStore?.getTaskById?.(String(body?.taskId || '')) || null;
    const out = ctx?.teamAgentBridge?.consumePlannerCompletion?.({
      teamId: String(task?.teamId || ''),
      taskId: String(body?.taskId || ''),
      plannerMemberId: String(body?.plannerMemberId || 'planner'),
      completion: body?.completion || {},
    }) || { ok: false, error: 'bridge_not_ready' };

    res.writeHead(out?.ok ? 200 : 400, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found', path: url.pathname }));
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const startedAt = Date.now();
let exitCode = 0;
let result = null;

try {
  ctx = createAppContext(loadIndexConfig());
  const { teamStore, teamAgentSessionRunner } = ctx;

  const now = Date.now();
  const teamId = `team:planner-openai:${randomUUID()}`;
  const plannerId = `member:planner:${randomUUID()}`;
  const taskId = `task:planner-openai:${randomUUID()}`;

  teamStore.createTeam({ teamId, scopeKey: 'qq:test:planner-openai-compatible', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
  teamStore.createMember({ memberId: plannerId, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
  teamStore.createTask({ taskId, teamId, title: 'planner openai-compatible smoke', description: 'verify planner can run via openai-compatible runtime and land plan through completion endpoint', state: 'planning', priority: 10, dependencies: [], metadata: { taskMode: 'analysis', riskLevel: 'low' }, createdAt: now, updatedAt: now });

  const out = await teamAgentSessionRunner.runPlannerTask({ teamId, taskId, plannerMemberId: plannerId, timeoutMs: 20000 });
  const plan = teamStore.getLatestPlanByTask(taskId);
  const task = teamStore.getTaskById(taskId);

  const ok = !!out?.ok && !!plan && String(task?.state || '') === 'plan_review';
  if (!ok) exitCode = 2;

  result = {
    ok,
    out,
    plan: plan ? { planId: plan.planId, summary: plan.summary, stepsCount: Array.isArray(plan.steps) ? plan.steps.length : 0 } : null,
    task: task ? { taskId: task.taskId, state: task.state } : null,
    requests: {
      chatCompletions: requests.filter((x) => x.kind === 'chat.completions').length,
      plannerCompletion: requests.filter((x) => x.kind === 'planner-completion').length,
    },
    durationMs: Date.now() - startedAt,
  };
} catch (err) {
  exitCode = 1;
  result = {
    ok: false,
    error: String(err?.message || err || ''),
    durationMs: Date.now() - startedAt,
  };
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify(result, null, 2));
process.exit(exitCode);

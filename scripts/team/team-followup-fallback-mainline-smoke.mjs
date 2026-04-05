import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { tryHandleHealthStateRoute } from '../../src/routes/index-routes-health-state.mjs';

let passed = 0;
let failed = 0;
function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function makeStore() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-p8-followup-'));
  return openTeamStore(path.join(tmpDir, 'team.sqlite'));
}

function seedTask(teamStore, metadata = {}) {
  const teamId = 'team:p8';
  const taskId = 'task:p8';
  const now = Date.now();
  teamStore.createTeam({ teamId, name: 'P8 Team', mode: 'tl_runtime', status: 'active', metadata: {}, createdAt: now, updatedAt: now });
  teamStore.createTask({
    taskId,
    teamId,
    parentTaskId: '',
    title: 'P8 follow-up fallback',
    description: 'seed task',
    state: 'approved',
    ownerMemberId: '',
    priority: 10,
    dependencies: [],
    metadata: {
      sessionsByRole: {},
      sessionsByAssignment: {},
      primarySessionKey: '',
      tlSessionKey: '',
      followupRoute: 'tl',
      sessionMode: '',
      sessionPersistent: false,
      sessionFallbackReason: '',
      ...metadata,
    },
    createdAt: now,
    updatedAt: now,
  });
  return { teamId, taskId };
}

function makeRes() {
  const state = { statusCode: 0, headers: {}, body: '' };
  return {
    state,
    writeHead(code, headers = {}) { state.statusCode = code; state.headers = headers; },
    end(body = '') { state.body = String(body || ''); },
    setHeader(name, value) { state.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return state.headers[String(name).toLowerCase()]; },
  };
}

function requestJson(route, teamStore, taskId) {
  const req = {
    method: 'GET',
    url: `${route}?taskId=${encodeURIComponent(taskId)}`,
    headers: { authorization: 'Bearer test-dashboard' },
  };
  const res = makeRes();
  const sendJson = (targetRes, code, payload) => {
    targetRes.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    targetRes.end(JSON.stringify(payload));
  };
  const handled = tryHandleHealthStateRoute(req, res, {
    teamStore,
    sendJson,
    isDashboardAuthorized: (incomingReq) => String(incomingReq?.headers?.authorization || '') === 'Bearer test-dashboard',
  });
  const json = JSON.parse(res.state.body || '{}');
  return { handled, res: res.state, json };
}

// case 1: run-mode member follow-up must fall back to TL direct and persist route
{
  const teamStore = makeStore();
  const broadcasts = [];
  const { taskId } = seedTask(teamStore, {
    sessionsByRole: {
      executor: {
        role: 'executor',
        sessionKey: 'sess-run',
        assignmentId: 'w1',
        childTaskId: 'task:child:w1',
        sessionMode: 'run',
        sessionPersistent: false,
        sessionFallbackReason: 'session_mode_unavailable',
      },
    },
    sessionsByAssignment: {
      w1: {
        role: 'executor',
        sessionKey: 'sess-run',
        assignmentId: 'w1',
        childTaskId: 'task:child:w1',
        sessionMode: 'run',
        sessionPersistent: false,
        sessionFallbackReason: 'session_mode_unavailable',
      },
    },
    sessionMode: 'run',
    sessionPersistent: false,
    sessionFallbackReason: 'session_mode_unavailable',
  });

  const tlRuntime = createTLRuntime({
    teamStore,
    nativeChat: {
      async generateReply() {
        return { ok: true, reply: 'TL 已直接接管这次 follow-up。' };
      },
    },
    runtimeAdapter: {
      async sendToSession() {
        return { ok: true, reply: 'should_not_be_called' };
      },
      async listSessionsForSession() { return { sessions: [] }; },
      async getSessionHistory() { return { messages: [] }; },
    },
    broadcastFn: (event) => broadcasts.push(event),
  });

  const result = await tlRuntime.handleTaskChat({
    taskId,
    text: '继续推进',
    targetRole: 'executor',
    assignmentId: 'w1',
    childTaskId: 'task:child:w1',
  });
  const task = teamStore.getTaskById(taskId);
  assert(result.ok === true, 'run-mode follow-up handled');
  assert(result.routedTo === 'tl_direct', 'run-mode follow-up routed to tl_direct');
  assert(String(result.reply || '').includes('TL 已直接接管'), 'run-mode follow-up got natural-language TL reply');
  assert(task?.metadata?.followupRoute === 'tl_direct', 'task metadata persisted tl_direct route');
  assert(task?.metadata?.lastFollowupFallbackReason === 'session_mode_unavailable', 'task metadata persisted fallback reason');
  assert(broadcasts.some((ev) => ev.eventKind === 'task.followup.completed' && ev.role === 'tl'), 'run-mode follow-up emitted completed event');
}

// case 2: persistent member empty reply must fall back to tl_direct_fallback and persist route
{
  const teamStore = makeStore();
  const broadcasts = [];
  const { taskId } = seedTask(teamStore, {
    sessionsByRole: {
      executor: {
        role: 'executor',
        sessionKey: 'sess-persistent',
        assignmentId: 'w1',
        childTaskId: 'task:child:w1',
        sessionMode: 'session',
        sessionPersistent: true,
        sessionFallbackReason: '',
      },
    },
    sessionsByAssignment: {
      w1: {
        role: 'executor',
        sessionKey: 'sess-persistent',
        assignmentId: 'w1',
        childTaskId: 'task:child:w1',
        sessionMode: 'session',
        sessionPersistent: true,
        sessionFallbackReason: '',
      },
    },
    sessionMode: 'session',
    sessionPersistent: true,
    sessionFallbackReason: '',
  });

  let sendCalls = 0;
  const tlRuntime = createTLRuntime({
    teamStore,
    nativeChat: {
      async generateReply(args) {
        const text = String(args?.text || '');
        if (text.includes('不要输出 JSON forward / replan 协议')) {
          return { ok: true, reply: '成员续聊失败，TL 已回退直答。' };
        }
        return { ok: true, reply: '```json\n{ "action": "forward", "target": "executor", "message": "请继续处理" }\n```' };
      },
    },
    runtimeAdapter: {
      async sendToSession() {
        sendCalls += 1;
        return { ok: false, error: 'empty_member_reply', reply: '' };
      },
      async listSessionsForSession() { return { sessions: [] }; },
      async getSessionHistory() { return { messages: [] }; },
    },
    broadcastFn: (event) => broadcasts.push(event),
  });

  const result = await tlRuntime.handleTaskChat({
    taskId,
    text: '继续推进',
    targetRole: 'executor',
    assignmentId: 'w1',
    childTaskId: 'task:child:w1',
  });
  const task = teamStore.getTaskById(taskId);
  assert(result.ok === true, 'persistent empty reply handled');
  assert(sendCalls === 1, 'persistent follow-up attempted member session once');
  assert(result.routedTo === 'tl_direct_fallback', 'empty member reply routed to tl_direct_fallback');
  assert(String(result.reply || '').includes('TL 已回退直答'), 'fallback returned natural-language TL reply');
  assert(task?.metadata?.followupRoute === 'tl_direct_fallback', 'task metadata persisted tl_direct_fallback route');
  assert(task?.metadata?.lastFollowupFallbackReason === 'empty_member_reply', 'task metadata persisted empty-reply reason');
  assert(broadcasts.some((ev) => ev.eventKind === 'task.followup.completed' && String(ev.title || '').includes('回退 TL 直答')), 'fallback emitted tl-direct completed event');
}

// case 3: state/query routes expose session capability fields consistently
{
  const teamStore = makeStore();
  const { taskId } = seedTask(teamStore, {
    sessionMode: 'run',
    sessionPersistent: false,
    sessionFallbackReason: 'session_mode_unavailable',
    followupRoute: 'tl_direct_fallback',
  });

  const summary = requestJson('/state/team/summary', teamStore, taskId);
  assert(summary.handled === true, 'summary route handled');
  assert(summary.res.statusCode === 200, 'summary route ok');
  assert(summary.json.sessionMode === 'run', 'summary exposes sessionMode');
  assert(summary.json.sessionPersistent === false, 'summary exposes sessionPersistent');
  assert(summary.json.sessionFallbackReason === 'session_mode_unavailable', 'summary exposes sessionFallbackReason');
  assert(summary.json.followupRoute === 'tl_direct_fallback', 'summary exposes followupRoute');

  const workbench = requestJson('/state/team/workbench', teamStore, taskId);
  assert(workbench.handled === true, 'workbench route handled');
  assert(workbench.res.statusCode === 200, 'workbench route ok');
  assert(workbench.json.resource?.sessionMode === 'run', 'workbench resource exposes sessionMode');
  assert(workbench.json.resource?.sessionPersistent === false, 'workbench resource exposes sessionPersistent');
  assert(workbench.json.resource?.sessionFallbackReason === 'session_mode_unavailable', 'workbench resource exposes sessionFallbackReason');
  assert(workbench.json.summary?.sessionMode === 'run', 'workbench summary exposes sessionMode');
  assert(workbench.json.summary?.sessionPersistent === false, 'workbench summary exposes sessionPersistent');
  assert(workbench.json.summary?.sessionFallbackReason === 'session_mode_unavailable', 'workbench summary exposes sessionFallbackReason');

  const board = requestJson('/state/team/board', teamStore, taskId);
  assert(board.handled === true, 'board route handled');
  assert(board.res.statusCode === 200, 'board route ok');
  const boardCard = board.json.board?.columns?.approved?.find((item) => item.taskId === taskId);
  assert(boardCard?.sessionMode === 'run', 'board card exposes sessionMode');
  assert(boardCard?.sessionPersistent === false, 'board card exposes sessionPersistent');
  assert(boardCard?.sessionFallbackReason === 'session_mode_unavailable', 'board card exposes sessionFallbackReason');

  const dashboard = requestJson('/state/team/dashboard', teamStore, taskId);
  assert(dashboard.handled === true, 'dashboard route handled');
  assert(dashboard.res.statusCode === 200, 'dashboard route ok');
  const dashCard = (dashboard.json.dashboard?.cards || []).find((item) => item.taskId === taskId);
  assert(dashCard?.sessionMode === 'run', 'dashboard card exposes sessionMode');
  assert(dashCard?.sessionPersistent === false, 'dashboard card exposes sessionPersistent');
  assert(dashCard?.sessionFallbackReason === 'session_mode_unavailable', 'dashboard card exposes sessionFallbackReason');
}

console.log(`RESULT ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../../src/index-env.mjs';
import { loadLiveEnvToken } from '../../../src/index-host-config.mjs';

const config = loadIndexConfig();
const ctx = createAppContext(config);
const teamStore = ctx.teamStore;
const orchToken = loadLiveEnvToken('ORCH_KICK_TOKEN', config);
const scopeKey = 'qq:2999991007';
const messageId = `async-ingress:${randomUUID()}`;
const payload = {
  kind: 'team.async_ingress.v1',
  payload: {
    messageId,
    scopeKey,
    deliveryTarget: '2999991007',
    recipientId: '2999991007',
    recipientType: 'group',
    originNode: 'lebang',
    senderId: 'async-ingress-smoke',
    channel: 'qqbot',
    taskMode: 'analysis',
    riskLevel: 'medium',
    text: '【验收】异步 ingress smoke：验证三节点异步群消息可进入 team runtime 主链。',
  },
};

const res = await fetch('http://127.0.0.1:19090/internal/team/ingress', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(orchToken ? { 'x-orch-token': orchToken } : {}),
  },
  body: JSON.stringify(payload),
});
const body = await res.json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

const teams = teamStore.listTeamsByScope(scopeKey) || [];
let team = null;
let task = null;
for (const t of teams) {
  const tasks = teamStore.listTasksByTeam(String(t.teamId || '')) || [];
  const matched = tasks.find((x) => String(x?.metadata?.sourceEventId || '') === messageId);
  if (matched) {
    team = t;
    task = matched;
    break;
  }
}
const mailbox = team ? (teamStore.listMailboxMessages({ teamId: String(team.teamId || ''), limit: 100 }) || []) : [];
const blackboard = task ? (teamStore.listBlackboardEntries({ taskId: String(task.taskId || ''), limit: 100 }) || []) : [];
const evidence = task ? (teamStore.listEvidenceByTask({ taskId: String(task.taskId || ''), limit: 100 }) || []) : [];

console.log(JSON.stringify({
  ok: res.ok,
  response: body,
  summary: {
    teamFound: !!team,
    taskFound: !!task,
    source: String(task?.metadata?.source || ''),
    ingressKind: String(task?.metadata?.ingressKind || ''),
    originNode: String(task?.metadata?.originNode || ''),
    deliveryTarget: String(task?.metadata?.deliveryTarget || ''),
    recipientId: String(task?.metadata?.recipientId || ''),
    recipientType: String(task?.metadata?.recipientType || ''),
    asyncIngressMailboxCount: mailbox.filter((x) => String(x.kind || '') === 'async_ingress.accepted').length,
    asyncIngressEvidenceCount: evidence.filter((x) => String(x.evidenceType || '') === 'async_ingress.accepted').length,
    ingressBlackboardPresent: blackboard.some((x) => String(x.entryKey || '') === 'async_ingress'),
  },
  task: task ? {
    taskId: task.taskId,
    state: task.state,
    metadata: {
      source: task.metadata?.source,
      ingressKind: task.metadata?.ingressKind,
      originNode: task.metadata?.originNode,
      deliveryTarget: task.metadata?.deliveryTarget,
      recipientId: task.metadata?.recipientId,
      recipientType: task.metadata?.recipientType,
      taskMode: task.metadata?.taskMode,
      riskLevel: task.metadata?.riskLevel,
    },
  } : null,
  mailboxKinds: mailbox.map((x) => x.kind),
  blackboardKeys: blackboard.map((x) => x.entryKey),
  evidenceTypes: evidence.map((x) => x.evidenceType),
}, null, 2));

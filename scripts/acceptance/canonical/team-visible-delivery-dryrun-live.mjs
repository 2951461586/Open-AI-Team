import { randomUUID } from 'node:crypto';
import { createAppContext } from '../../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../../src/index-env.mjs';

const ctx = createAppContext(loadIndexConfig());
const { teamStore } = ctx;
const seen = [];

const now = Date.now();
const teamId = `team:visible-delivery-dryrun:${randomUUID()}`;
const taskId = `task:visible-delivery-dryrun:${randomUUID()}`;
const outputRequestId = `msg:${randomUUID()}`;
const commandId = `team-output:${randomUUID()}`;

teamStore.createTeam({
  teamId,
  scopeKey: 'dashboard:main',
  mode: 'analysis',
  status: 'active',
  createdAt: now,
  updatedAt: now,
});

teamStore.createTask({
  taskId,
  teamId,
  title: 'visible delivery dryrun acceptance',
  description: 'verify canonical visible output leaves mailbox + blackboard authoritative receipt side-effects without sending a real message',
  state: 'done',
  priority: 10,
  dependencies: [],
  metadata: {
    taskMode: 'analysis',
    riskLevel: 'low',
    source: 'dashboard_ws',
    channel: 'dashboard',
    deliveryMode: 'dashboard',
    deliveryTarget: 'main',
    visibilityPolicy: { userVisible: true, teamVisible: true },
  },
  createdAt: now,
  updatedAt: now,
});

const outputRequest = teamStore.appendMailboxMessage({
  messageId: outputRequestId,
  teamId,
  taskId,
  threadId: '',
  kind: 'output.request',
  fromMemberId: 'runtime',
  toMemberId: 'runtime',
  broadcast: false,
  payload: {
    decisionId: `decision:${randomUUID()}`,
    taskId,
    outputMode: 'user_visible',
    userVisible: true,
    visibilityPolicy: { userVisible: true, teamVisible: true },
    draft: {
      title: '【验收】Visible delivery dryrun',
      summary: '这是一条 dashboard visible output 的 dryrun 验收消息。',
      state: 'done',
      decisionType: 'approve',
    },
  },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

const dispatch = teamStore.appendMailboxMessage({
  messageId: `msg:${randomUUID()}`,
  teamId,
  taskId,
  threadId: '',
  kind: 'output.command.emitted',
  fromMemberId: 'runtime',
  toMemberId: 'output',
  broadcast: false,
  payload: {
    commandId,
    outputRequestId,
    userVisible: true,
    authoritative: false,
    delivery: {
      simulated: true,
      providerMessageId: 'dryrun-visible-delivery',
      externalMessageId: 'dryrun-visible-delivery',
      via: 'dashboard_dryrun',
      channel: 'dashboard',
      deliveryMode: 'dashboard',
    },
  },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

teamStore.upsertBlackboardEntry({
  entryId: `bb:${randomUUID()}`,
  taskId,
  section: 'visible_output',
  entryKey: `visible_output_payload:${outputRequestId}`,
  value: {
    commandId,
    outputRequestId,
    channel: 'dashboard',
    deliveryMode: 'dashboard',
    simulated: true,
    summary: outputRequest?.payload?.draft?.summary || '',
  },
  createdAt: now,
  updatedAt: now,
});

const receipt = teamStore.appendMailboxMessage({
  messageId: `msg:${randomUUID()}`,
  teamId,
  taskId,
  threadId: '',
  kind: 'output.delivered',
  fromMemberId: 'output',
  toMemberId: 'runtime',
  broadcast: false,
  payload: {
    commandId,
    outputRequestId,
    providerMessageId: 'dryrun-visible-delivery',
    externalMessageId: 'dryrun-visible-delivery',
    authoritative: true,
    simulated: true,
    via: 'dashboard_dryrun',
    channel: 'dashboard',
    deliveryMode: 'dashboard',
  },
  status: 'delivered',
  createdAt: now,
  deliveredAt: now,
});

teamStore.upsertBlackboardEntry({
  entryId: `bb:${randomUUID()}`,
  taskId,
  section: 'visible_output',
  entryKey: `visible_output_delivered:${outputRequestId}`,
  value: {
    commandId,
    outputRequestId,
    providerMessageId: 'dryrun-visible-delivery',
    externalMessageId: 'dryrun-visible-delivery',
    authoritative: true,
    simulated: true,
    via: 'dashboard_dryrun',
    channel: 'dashboard',
    deliveryMode: 'dashboard',
  },
  createdAt: now,
  updatedAt: now,
});

seen.push({ type: 'visible_output', commandId, outputRequestId });

const mailbox = teamStore.listMailboxMessages({ teamId, limit: 120 }) || [];
const blackboard = teamStore.listBlackboardEntries({ taskId, limit: 120 }) || [];
const emitted = mailbox.find((x) => String(x.kind || '') === 'output.command.emitted');
const delivered = mailbox.find((x) => String(x.kind || '') === 'output.delivered');
const visiblePayload = blackboard.find((x) => String(x.entryKey || '') === `visible_output_payload:${outputRequestId}`);
const visibleDelivered = blackboard.find((x) => String(x.entryKey || '') === `visible_output_delivered:${outputRequestId}`);

console.log(JSON.stringify({
  ok: true,
  teamId,
  taskId,
  dispatch,
  receipt,
  summary: {
    outputCommandEmittedCount: mailbox.filter((x) => String(x.kind || '') === 'output.command.emitted').length,
    outputDeliveredCount: mailbox.filter((x) => String(x.kind || '') === 'output.delivered').length,
    dispatched: true,
    commandId,
    authoritative: true,
    visiblePayloadPrepared: !!visiblePayload,
    visibleDeliveredRecorded: !!visibleDelivered,
    providerMessageId: 'dryrun-visible-delivery',
    externalMessageId: 'dryrun-visible-delivery',
    via: 'dashboard_dryrun',
    channel: 'dashboard',
    deliveryMode: 'dashboard',
    broadcastCount: seen.length,
    visibleOutputBroadcast: seen.some((x) => String(x?.type || '') === 'visible_output'),
    agentReplyBroadcast: seen.some((x) => String(x?.type || '') === 'agent_reply'),
  },
  emitted,
  delivered,
  visiblePayload,
  visibleDelivered,
  seen,
}, null, 2));

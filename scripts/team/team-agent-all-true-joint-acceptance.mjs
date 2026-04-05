import { loadIndexConfig } from '../../src/index-env.mjs';
import { loadHostRuntimeConfig, loadLiveEnvToken } from '../../src/index-host-config.mjs';

const config = loadIndexConfig();
const hostConfig = loadHostRuntimeConfig(config);
const token = loadLiveEnvToken('ORCH_KICK_TOKEN', config);
const base = String(hostConfig?.local?.controlBaseUrl || 'http://127.0.0.1:19090').replace(/\/$/, '');
const headers = { 'content-type': 'application/json', 'x-orch-token': token };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function getJson(path) {
  const res = await fetch(base + path, { headers: { 'x-orch-token': token } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const dispatchText = '/task 验证 all true joint dashboard mainline acceptance。要求：仅验证当前 task 自身的 dashboard mainline 主链；前置状态按 plan_review 审查阶段处理，不得写成 planning；证据仅允许使用当前 task 的 workbench/mailbox/blackboard 与 output delivered authoritative writeback，不得把 planner/task.assign 的 mailbox 当成 review.request 证据；必须输出完整检查矩阵，逐项绑定字段路径、entryKey、预期值与失败处理。判定原则：当 review.verdict=approve 且无 issues 时，judge 必须给出 approve 决策，并设置 payload.nextState=done，以触发 runtime 产出 deliverable_ready + outputDelivered + authoritative；不要在决策前要求 outputDelivered 证据（那是决策后的副作用），应在 decision.final 之后再验证 outputDelivered=true 与 authoritative=true。最终目标是 planner/critic/judge started、hasPlan/hasReview/hasDecision、taskState=done、deliveryStatus=deliverable_ready、outputDelivered=true、authoritative=true。';

const planSeed = {
  summary: '验证 dashboard mainline 场景下 all true joint acceptance 的通过条件、观测点与结论产出路径（注意：outputDelivered/authoritative 必须在 judge approve+done 之后再验证，不能作为 approve 的前置证据）。',
  steps: [
    {
      id: 'step1',
      title: '确认验收范围与前置条件',
      action: '仅验证当前 task 自身的 dashboard mainline 主链；核对 source=all_true_joint_http_acceptance、scopeKey=dashboard:main、deliveryMode=dashboard、deliveryTarget=main，并确认当前阶段按 plan_review 审查场景处理，不得误写为 planning。',
      exitCriteria: '验收范围、入口元数据与 plan_review 前置条件全部明确，且无跨 task / 跨链路混用。',
    },
    {
      id: 'step2',
      title: '建立完整检查矩阵',
      action: '列出 plannerStarted、criticStarted、judgeStarted、hasPlan、hasReview、hasDecision、taskState=done、deliveryStatus=deliverable_ready、outputDelivered=true、authoritative=true 的字段路径、来源 entryKey / mailbox kind、预期值与失败处理。',
      exitCriteria: '每个验收布尔位都绑定到明确字段路径与证据来源，无歧义项。',
    },
    {
      id: 'step3',
      title: '执行主链证据核验',
      action: '只允许使用当前 task 的 workbench / mailbox / blackboard 与 output delivered authoritative writeback 作为证据；不得把 planner/task.assign 的 mailbox 当成 review.request 或 judge 证据。',
      exitCriteria: '当前 task 主链证据全部核验完成，且不存在证据对象错配。',
    },
    {
      id: 'step4',
      title: '汇总结论并触发交付',
      action: '基于检查矩阵输出最终验收结论；当 review=approve 且无 issues 时，judge 必须 approve 并设置 nextState=done，触发 runtime 产出 deliverable_ready 与 outputDelivered/authoritative；然后再核验 outputDelivered=true 与 authoritative=true。',
      exitCriteria: '形成可交付验收结论，并使主链结果达到 all true。',
    },
  ],
  risks: [
    '若混入 planner/task.assign 等非当前 review 主链证据，会导致验收对象错位。',
    '若遗漏字段路径与 entryKey 映射，critic 会判定检查矩阵不完整。',
    '若把当前阶段误写为 planning，会导致前置条件错误。',
  ],
};

const dispatchOut = await post('/internal/team/dispatch', {
  text: dispatchText,
  scopeKey: 'dashboard:main',
  metadata: {
    source: 'all_true_joint_http_acceptance',
    channel: 'dashboard',
    deliveryMode: 'dashboard',
    deliveryTarget: 'main',
    strictTaskMode: true,
    planSeed,
  },
});
if (!dispatchOut.ok || !dispatchOut?.data?.task?.taskId) throw new Error(`dispatch_failed: ${JSON.stringify(dispatchOut?.data || {})}`);

const task = dispatchOut.data.task;
const team = dispatchOut.data.team;
const taskId = String(task.taskId || '');
const teamId = String(team.teamId || '');

console.log(JSON.stringify({
  accepted: true,
  taskId,
  teamId,
  dispatchText,
  planSeed,
}, null, 2));

let workbench = null;
let mailbox = [];
let blackboard = [];
let plannerStarted = null;
let criticStarted = null;
let judgeStarted = null;
let delivered = null;
let outputRequest = null;
let deliveredBlackboard = null;

let judgeKickAttempted = false;
const deadline = Date.now() + 240000;
while (Date.now() < deadline) {
  await sleep(1000);
  const [wb, mb, bb] = await Promise.all([
    getJson(`/state/team/workbench?taskId=${encodeURIComponent(taskId)}`),
    getJson(`/state/team/mailbox?teamId=${encodeURIComponent(teamId)}&taskId=${encodeURIComponent(taskId)}&limit=500`),
    getJson(`/state/team/blackboard?taskId=${encodeURIComponent(taskId)}&limit=500`),
  ]);
  workbench = wb?.data || null;
  mailbox = mb?.data?.items || [];
  blackboard = bb?.data?.items || [];

  plannerStarted = plannerStarted || mailbox.find((x) => String(x?.kind || '') === 'planner.session.started') || null;
  criticStarted = criticStarted || mailbox.find((x) => String(x?.kind || '') === 'critic.session.started') || null;
  judgeStarted = judgeStarted || mailbox.find((x) => String(x?.kind || '') === 'judge.session.started') || null;
  outputRequest = mailbox.find((x) => String(x?.kind || '') === 'output.request') || outputRequest;
  delivered = mailbox.find((x) => String(x?.kind || '') === 'output.delivered') || delivered;
  deliveredBlackboard = blackboard.find((x) => String(x?.entryKey || '') === `visible_output_delivered:${String(outputRequest?.messageId || '')}`) || deliveredBlackboard;

  const taskState = String(workbench?.resource?.state || '');
  const decisionRequest = mailbox.find((x) => String(x?.kind || '') === 'decision.request') || null;
  if (!judgeKickAttempted && taskState === 'approved' && decisionRequest && !judgeStarted) {
    judgeKickAttempted = true;
    const kick = await post('/internal/team/judge/run', { taskId });
    console.log(JSON.stringify({ judgeRecoveryKick: true, taskId, kick }, null, 2));
  }

  const done = taskState === 'done';
  const hasPlan = !!workbench?.summary?.hasPlan;
  const hasReview = !!workbench?.summary?.hasReview;
  const hasDecision = !!workbench?.summary?.hasDecision;
  const deliveryReady = String(workbench?.summary?.deliveryStatus || '') === 'deliverable_ready';
  if (plannerStarted && criticStarted && judgeStarted && hasPlan && hasReview && hasDecision && done && deliveryReady && delivered && deliveredBlackboard?.value?.authoritative) {
    break;
  }
}

if (!plannerStarted || !criticStarted || !judgeStarted || !workbench?.summary?.hasPlan || !workbench?.summary?.hasReview || !workbench?.summary?.hasDecision || String(workbench?.resource?.state || '') !== 'done' || !delivered || !deliveredBlackboard?.value?.authoritative) {
  throw new Error(`all_true_joint_not_green | summary=${JSON.stringify({
    plannerStarted: !!plannerStarted,
    criticStarted: !!criticStarted,
    judgeStarted: !!judgeStarted,
    hasPlan: !!workbench?.summary?.hasPlan,
    hasReview: !!workbench?.summary?.hasReview,
    hasDecision: !!workbench?.summary?.hasDecision,
    taskState: String(workbench?.resource?.state || ''),
    deliveryStatus: String(workbench?.summary?.deliveryStatus || ''),
    outputDelivered: !!delivered,
    authoritative: !!deliveredBlackboard?.value?.authoritative,
  })} | mailboxKinds=${JSON.stringify(mailbox.map((x) => x.kind))} | blackboardKeys=${JSON.stringify(blackboard.map((x) => x.entryKey))}`);
}

console.log(JSON.stringify({
  taskId,
  teamId,
  summary: {
    plannerStarted: !!plannerStarted,
    plannerPlanLanded: !!workbench?.summary?.hasPlan,
    criticStarted: !!criticStarted,
    criticReviewLanded: !!workbench?.summary?.hasReview,
    judgeStarted: !!judgeStarted,
    decisionFinal: mailbox.some((x) => String(x?.kind || '') === 'decision.final'),
    outputRequest: !!outputRequest,
    outputCommandEmitted: mailbox.some((x) => String(x?.kind || '') === 'output.command.emitted'),
    outputDelivered: !!delivered,
    authoritative: !!deliveredBlackboard?.value?.authoritative,
    taskState: String(workbench?.resource?.state || ''),
    deliveryStatus: String(workbench?.summary?.deliveryStatus || ''),
    plannerRunId: String(plannerStarted?.payload?.runId || ''),
    plannerChildSessionKey: String(plannerStarted?.payload?.childSessionKey || ''),
    criticRunId: String(criticStarted?.payload?.runId || ''),
    criticChildSessionKey: String(criticStarted?.payload?.childSessionKey || ''),
    judgeRunId: String(judgeStarted?.payload?.runId || ''),
    judgeChildSessionKey: String(judgeStarted?.payload?.childSessionKey || ''),
  },
  mailboxKinds: mailbox.map((x) => x.kind),
  outputRequest,
  delivered,
  deliveredBlackboard,
}, null, 2));

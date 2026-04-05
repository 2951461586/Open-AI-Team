import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';

const config = loadIndexConfig();
const ctx = createAppContext(config);
const teamStore = ctx.teamStore;
const outputBridge = ctx.teamOutputBridge;

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const teamIdFilter = (() => {
  const i = argv.indexOf('--teamId');
  return i >= 0 ? String(argv[i + 1] || '') : '';
})();
const taskIdFilter = (() => {
  const i = argv.indexOf('--taskId');
  return i >= 0 ? String(argv[i + 1] || '') : '';
})();

const teams = teamStore.listTeams ? teamStore.listTeams({ limit: 1000 }) : [];
const candidates = [];

for (const team of teams) {
  if (teamIdFilter && String(team?.teamId || '') !== teamIdFilter) continue;
  const mailbox = teamStore.listMailboxMessages({ teamId: String(team?.teamId || ''), limit: 1000 }) || [];
  const outputRequests = mailbox.filter((m) => String(m?.kind || '') === 'output.request');
  for (const outputRequest of outputRequests) {
    if (taskIdFilter && String(outputRequest?.taskId || '') !== taskIdFilter) continue;
    const outputRequestId = String(outputRequest?.messageId || '');
    const delivered = mailbox.find((m) => String(m?.kind || '') === 'output.delivered' && String(m?.payload?.outputRequestId || '') === outputRequestId);
    if (delivered) continue;
    const task = teamStore.getTaskById(String(outputRequest?.taskId || ''));
    if (!task) continue;
    candidates.push({ team, task, outputRequest });
  }
}

const results = [];
for (const item of candidates) {
  const summary = {
    teamId: String(item.team?.teamId || ''),
    scopeKey: String(item.team?.scopeKey || ''),
    taskId: String(item.task?.taskId || ''),
    taskState: String(item.task?.state || ''),
    outputRequestId: String(item.outputRequest?.messageId || ''),
    title: String(item.outputRequest?.payload?.draft?.title || ''),
  };

  if (!apply) {
    results.push({ ...summary, mode: 'dry-run', replayed: false });
    continue;
  }

  const dispatchOut = await outputBridge.dispatchOutputRequest({ task: item.task, outputRequest: item.outputRequest });
  results.push({
    ...summary,
    mode: 'apply',
    replayed: !!dispatchOut?.ok,
    duplicate: !!dispatchOut?.duplicate,
    alreadyDelivered: !!dispatchOut?.alreadyDelivered,
    commandId: String(dispatchOut?.delivery?.commandId || dispatchOut?.commandId || ''),
    error: String(dispatchOut?.error || ''),
  });
}

console.log(JSON.stringify({
  ok: true,
  apply,
  filters: {
    teamId: teamIdFilter,
    taskId: taskIdFilter,
  },
  count: results.length,
  results,
}, null, 2));

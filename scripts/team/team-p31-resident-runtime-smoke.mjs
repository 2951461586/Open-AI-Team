import fs from 'node:fs';
import path from 'node:path';
import { openTeamStore } from '../../src/team/team-store.mjs';
import { createTeamResidentRuntime } from '../../src/team/team-resident-runtime.mjs';

const tmpDir = '/tmp/openclaw-team-p31';
fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'team-p31.sqlite');
try { fs.unlinkSync(dbPath); } catch {}

const teamStore = openTeamStore(dbPath);
const fixedNow = Date.now();
let nowCursor = fixedNow;
const now = () => nowCursor;
const idgen = (prefix = 'id') => `${prefix}:${Math.random().toString(36).slice(2, 10)}`;

const roleDeployment = {
  resolve(role = '') {
    const map = {
      planner: { selectedNode: 'violet', preferredNode: 'violet', outwardIdentity: 'planner' },
      critic: { selectedNode: 'lebang', preferredNode: 'lebang', outwardIdentity: 'critic' },
      judge: { selectedNode: 'laoda', preferredNode: 'laoda', outwardIdentity: 'judge' },
      executor: { selectedNode: 'violet', preferredNode: 'violet', outwardIdentity: 'executor' },
      observer: { selectedNode: 'violet', preferredNode: 'violet', outwardIdentity: 'observer' },
      monitor: { selectedNode: 'violet', preferredNode: 'violet', outwardIdentity: 'monitor' },
      output: { selectedNode: 'laoda', preferredNode: 'laoda', outwardIdentity: 'output' },
    };
    return map[String(role || '').trim().toLowerCase()] || { selectedNode: 'laoda', preferredNode: 'laoda', outwardIdentity: role || 'runtime' };
  },
};

const teamNodeHealth = {
  getNodeStatusSync() {
    return { ts: now(), laoda: { ok: true }, violet: { ok: true }, lebang: { ok: true } };
  },
};

const runtime = createTeamResidentRuntime({
  teamStore,
  roleDeployment,
  teamNodeHealth,
  now,
  idgen,
  defaultLeaseMs: 1000,
});

const teamId = 'team:p31-smoke';
teamStore.createTeam({
  teamId,
  scopeKey: 'smoke:p31',
  mode: 'runtime',
  status: 'active',
  metadata: {},
  createdAt: now(),
  updatedAt: now(),
});

runtime.ensureResidentMembers({ teamId, roles: ['planner', 'critic', 'judge'] });

teamStore.appendMailboxMessage({
  messageId: idgen('msg'),
  teamId,
  taskId: 'task:1',
  kind: 'review.request',
  fromMemberId: 'runtime',
  toMemberId: 'critic.lebang',
  payload: { x: 1 },
  status: 'delivered',
  createdAt: now(),
  deliveredAt: now(),
});
teamStore.appendMailboxMessage({
  messageId: idgen('msg'),
  teamId,
  taskId: 'task:1',
  kind: 'routing.decided',
  fromMemberId: 'runtime',
  toMemberId: '',
  broadcast: true,
  payload: { role: 'critic' },
  status: 'delivered',
  createdAt: now(),
  deliveredAt: now(),
});

const criticInbox = teamStore.listMailboxMessagesForMember({ teamId, memberId: 'critic.lebang', limit: 20 });
const judgeInbox = teamStore.listMailboxMessagesForMember({ teamId, memberId: 'judge.laoda', limit: 20 });

const started = runtime.noteSessionStarted({
  teamId,
  role: 'planner',
  memberId: 'planner.violet',
  taskId: 'task:1',
  invocation: {
    effectiveNode: 'violet',
    requestedNode: 'violet',
    runId: 'run:1',
    childSessionKey: 'sess:1',
  },
});

nowCursor += 1500;
const sweep = runtime.sweepResidents({ teamId });
const overview = runtime.getResidentOverview({ teamId });
const planner = overview.residents.find((x) => String(x.role) === 'planner');

const out = {
  ok: true,
  criticInboxKinds: criticInbox.map((x) => x.kind),
  judgeInboxKinds: judgeInbox.map((x) => x.kind),
  startedStatus: started?.status || null,
  sweepCount: sweep?.count || 0,
  plannerStatusAfterSweep: planner?.status || null,
  plannerDegradedReason: planner?.degradedReason || null,
  mailboxKinds: (teamStore.listMailboxMessages({ teamId, limit: 50 }) || []).map((x) => x.kind),
};

const pass = out.criticInboxKinds.includes('review.request')
  && out.criticInboxKinds.includes('routing.decided')
  && !out.judgeInboxKinds.includes('review.request')
  && out.startedStatus === 'busy'
  && out.sweepCount >= 1
  && out.plannerStatusAfterSweep === 'idle'
  && out.plannerDegradedReason === 'lease_expired'
  && out.mailboxKinds.includes('resident.session.started')
  && out.mailboxKinds.includes('resident.lease.expired');

if (!pass) {
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(out, null, 2));

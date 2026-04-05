import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { randomUUID } from 'node:crypto';

const ctx = await createAppContext(loadIndexConfig());
const { teamStore } = ctx;
if (ctx.sessionControlPlane?.kind !== 'control_plane_client') {
  throw new Error(`unexpected control plane kind: ${String(ctx.sessionControlPlane?.kind || 'missing')}`);
}
if (ctx.sessionControlPlane?.provider !== 'control-plane-client') {
  throw new Error(`unexpected control plane provider: ${String(ctx.sessionControlPlane?.provider || 'missing')}`);
}
const now = Date.now();
const teamId = `team:ctrl:${randomUUID()}`;
const taskId = `task:ctrl:${randomUUID()}`;
const criticId = `member:critic:${randomUUID()}`;
const judgeId = `member:judge:${randomUUID()}`;
teamStore.createTeam({ teamId, scopeKey: 'test:control', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: criticId, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: judgeId, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({ taskId, teamId, title: 'control plane smoke', description: 'verify manual actions', state: 'approved', ownerMemberId: '', priority: 1, dependencies: [], metadata: {}, createdAt: now, updatedAt: now });
console.log(JSON.stringify({ ok:true, taskId }));

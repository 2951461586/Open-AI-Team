import { createAppContext } from '../../src/index-bootstrap.mjs';
import { loadIndexConfig } from '../../src/index-env.mjs';
import { randomUUID } from 'node:crypto';

const ctx = await createAppContext(loadIndexConfig());
const { teamStore } = ctx;
const now = Date.now();
const teamId = `team:wb:${randomUUID()}`;
const taskId = `task:wb:${randomUUID()}`;

teamStore.createTeam({ teamId, scopeKey: 'test:workbench', mode: 'analysis', status: 'active', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: `member:planner:${randomUUID()}`, teamId, agentRef: 'planner', role: 'planner', capabilities: ['planning'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: `member:critic:${randomUUID()}`, teamId, agentRef: 'critic', role: 'critic', capabilities: ['review'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createMember({ memberId: `member:judge:${randomUUID()}`, teamId, agentRef: 'judge', role: 'judge', capabilities: ['decision'], status: 'idle', createdAt: now, updatedAt: now });
teamStore.createTask({ taskId, teamId, title: 'workbench smoke', description: 'verify artifacts/evidence', state: 'done', ownerMemberId: '', priority: 1, dependencies: [], metadata: {}, createdAt: now, updatedAt: now });

const plan = teamStore.insertPlan({ planId: `plan:${randomUUID()}`, taskId, authorMemberId: 'planner', summary: 'demo plan', steps: [{id:'s1', title:'do'}], risks: [{id:'r1', risk:'x'}], status: 'submitted', createdAt: now, updatedAt: now });
const review = teamStore.insertReview({ reviewId: `review:${randomUUID()}`, taskId, targetType: 'plan', targetId: plan.planId, reviewerMemberId: 'critic', score: 0.7, verdict: 'approve_with_notes', issues: [{severity:'minor', title:'small issue', location:'step_1', description:'d', suggestion:'s'}], createdAt: now });
const decision = teamStore.insertDecision({ decisionId: `decision:${randomUUID()}`, taskId, judgeMemberId: 'judge', decisionType: 'approve', reason: 'ok', payload: {nextState:'done'}, createdAt: now });
teamStore.insertArtifact({ artifactId: `artifact:${randomUUID()}`, taskId, teamId, artifactType: 'plan', role: 'planner', refId: plan.planId, title: 'demo plan artifact', body: plan, status: 'ready', createdAt: now, updatedAt: now });
teamStore.insertArtifact({ artifactId: `artifact:${randomUUID()}`, taskId, teamId, artifactType: 'review', role: 'critic', refId: review.reviewId, title: 'demo review artifact', body: review, status: 'ready', createdAt: now, updatedAt: now });
teamStore.insertArtifact({ artifactId: `artifact:${randomUUID()}`, taskId, teamId, artifactType: 'decision', role: 'judge', refId: decision.decisionId, title: 'demo decision artifact', body: decision, status: 'ready', createdAt: now, updatedAt: now });
teamStore.insertEvidence({ evidenceId: `evidence:${randomUUID()}`, taskId, teamId, evidenceType: 'review_issue', sourceType: 'review', sourceId: review.reviewId, title: 'small issue', detail: review.issues[0], severity: 'minor', createdAt: now });
console.log(JSON.stringify({ ok:true, teamId, taskId, artifacts: teamStore.listArtifactsByTask({ taskId }).length, evidence: teamStore.listEvidenceByTask({ taskId }).length }));

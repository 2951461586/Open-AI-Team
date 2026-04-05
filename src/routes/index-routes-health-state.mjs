import fs from 'fs';
import path from 'path';
import { TEAM_ROLE_CONTRACTS } from '../team/team-role-contracts.mjs';
import { getRoleExecutionSurfaceContract } from '../team/team-role-capability-contracts.mjs';
import { loadTeamRolesConfig, reloadTeamRolesConfig, getTeamRolesConfigStatus } from '../team/team-roles-config.mjs';
import { DEFAULT_NODE_ID, OBSERVER_NODE_ID, canonicalNodeId } from '../team/team-node-ids.mjs';
import { buildStableEnvelope, buildStateQueryContracts } from '../team/query-api/query-contract.mjs';
import { tryHandleTeamNodesRoute } from './team-state/nodes.mjs';
import { tryHandleTeamAgentsRoute } from './team-state/agents.mjs';
import { tryHandleTeamWorkbenchRoute } from './team-state/workbench.mjs';
import { tryHandleTeamControlRoute } from './team-state/control.mjs';
import { tryHandleTeamSummaryRoute } from './team-state/summary.mjs';
import { tryHandleTeamPipelineRoute } from './team-state/pipeline.mjs';

function parseUrlParam(url = '', key = '') {
  try {
    return new URL(String(url || ''), 'http://127.0.0.1').searchParams.get(String(key || ''));
  } catch {
    return '';
  }
}

function inferNextBestAction({ task, latestReview, latestDecision, artifactCount = 0, evidenceCount = 0 } = {}) {
  const state = String(task?.state || '');
  if (state === 'planning') return 'wait_for_plan';
  if (state === 'plan_review') return 'run_critic_review';
  if (state === 'approved') return 'run_judge_decision';
  if (state === 'revision_requested') return 'revise_plan';
  if (state === 'blocked') return 'human_intervention';
  if (state === 'done' && artifactCount > 0) return 'deliver_or_archive';
  if (latestDecision && String(latestDecision.decisionType || '') === 'approve') return 'deliver_output';
  if (latestReview && String(latestReview.verdict || '') === 'approve_with_notes') return 'judge_with_notes';
  if (evidenceCount > 0) return 'inspect_evidence';
  return 'observe';
}

function inferCurrentDriver({ task, latestReview, latestDecision } = {}) {
  const state = String(task?.state || '');
  if (state === 'planning') return 'planner';
  if (state === 'plan_review') return 'critic';
  if (state === 'approved') return 'judge';
  if (state === 'revision_requested') return 'planner';
  if (state === 'done') return 'runtime';
  if (state === 'blocked') return 'human';
  if (latestDecision) return 'judge';
  if (latestReview) return 'critic';
  return 'runtime';
}

function computeDeliveryStatus({ task, latestDecision, artifactCount = 0 } = {}) {
  const state = String(task?.state || '');
  const decisionType = String(latestDecision?.decisionType || '').toLowerCase();
  if (state === 'done' && artifactCount > 0) return 'deliverable_ready';
  if (state === 'done') return 'done_but_artifact_thin';
  if (decisionType === 'approve') return 'pending_delivery';
  if (state === 'approved') return 'awaiting_judge_delivery';
  return 'not_ready';
}

function computeInterventionStatus({ task, issueCount = 0, revisionCount = 0, latestDecision } = {}) {
  const state = String(task?.state || '');
  const decisionType = String(latestDecision?.decisionType || '').toLowerCase();
  if (state === 'blocked' || decisionType === 'escalate_human') return 'human_intervention_required';
  if (revisionCount >= 3 || issueCount >= 3) return 'human_intervention_recommended';
  return 'no_intervention_needed';
}

function buildExecutiveSummary({ task, latestReview, latestDecision, deliveryStatus, interventionStatus, nextBestAction } = {}) {
  const title = String(task?.title || 'task');
  if (deliveryStatus === 'deliverable_ready') return `${title} 已具备交付条件，可直接交付或归档。`;
  if (interventionStatus === 'human_intervention_required') return `${title} 需要人工介入处理，当前不宜自动推进。`;
  if (String(task?.state || '') === 'plan_review') return `${title} 当前处于评审阶段，建议继续执行 critic review。`;
  if (String(task?.state || '') === 'approved') return `${title} 已通过评审，等待 judge 最终裁决。`;
  if (latestReview && String(latestReview.verdict || '') === 'approve_with_notes') return `${title} 基本通过，但仍有备注问题需要 judge 判断是否可直接放行。`;
  if (latestDecision && String(latestDecision.decisionType || '') === 'approve') return `${title} 已获得批准，下一步建议执行交付。`;
  return `${title} 当前下一步建议：${String(nextBestAction || 'observe')}。`;
}

function deriveThreadType({ task, latestReview, latestDecision, artifacts = [] } = {}) {
  const state = String(task?.state || '').trim();
  if (latestDecision) return 'decision';
  if (latestReview || state === 'plan_review') return 'review';
  if (artifacts.length > 0 || state === 'done' || state === 'approved') return 'execution';
  return 'task';
}

function buildThreadSummaryItem(teamStore, task) {
  const currentTask = task && task.taskId ? task : teamStore.getTaskById?.(String(task?.taskId || ''));
  if (!currentTask?.taskId) return null;

  const s = snapshotTask(teamStore, String(currentTask.taskId || ''));
  const issueCount = s.evidence.filter((e) => String(e.evidenceType || '') === 'review_issue').length;
  const revisionCount = s.reviews.filter((r) => String(r.verdict || '').toLowerCase() === 'revise').length;
  const currentDriver = inferCurrentDriver({ task: s.task || currentTask, latestReview: s.latestReview, latestDecision: s.latestDecision });
  const nextBestAction = inferNextBestAction({ task: s.task || currentTask, latestReview: s.latestReview, latestDecision: s.latestDecision, artifactCount: s.artifacts.length, evidenceCount: s.evidence.length });
  const deliveryStatus = computeDeliveryStatus({ task: s.task || currentTask, latestDecision: s.latestDecision, artifactCount: s.artifacts.length });
  const interventionStatus = computeInterventionStatus({ task: s.task || currentTask, issueCount, revisionCount, latestDecision: s.latestDecision });
  const threadType = deriveThreadType({ task: s.task || currentTask, latestReview: s.latestReview, latestDecision: s.latestDecision, artifacts: s.artifacts || [] });
  const latestDeliverable = (s.artifacts || []).find((item) => {
    const type = String(item?.artifactType || '').toLowerCase();
    return ['deliverable', 'output_request', 'executor_artifact'].includes(type);
  }) || null;

  return {
    threadId: String((s.task || currentTask).taskId || ''),
    taskId: String((s.task || currentTask).taskId || ''),
    parentThreadId: String((s.task || currentTask).parentTaskId || '') || undefined,
    threadType,
    title: String((s.task || currentTask).title || ''),
    state: String((s.task || currentTask).state || ''),
    phase: String(nextBestAction || (s.task || currentTask).state || 'observe'),
    owner: String(currentDriver || ''),
    goal: buildExecutiveSummary({ task: s.task || currentTask, latestReview: s.latestReview, latestDecision: s.latestDecision, deliveryStatus, interventionStatus, nextBestAction }),
    blockingIssues: Number(issueCount || 0),
    pendingHumanActions: interventionStatus === 'no_intervention_needed' ? 0 : 1,
    requestedNode: s.requestedNode || '',
    actualNode: s.actualNode || '',
    degradedReason: s.degradedReason || '',
    sessionKey: String((s.task || currentTask)?.metadata?.sessionKey || (s.task || currentTask)?.metadata?.primarySessionKey || ''),
    sessionsByRole: (s.task || currentTask)?.metadata?.sessionsByRole || {},
    latestDeliverableId: latestDeliverable?.artifactId ? String(latestDeliverable.artifactId) : undefined,
    updatedAt: Number((s.task || currentTask).updatedAt || Date.now()),
  };
}

function getManualActions({ task, latestReview, latestDecision, deliveryStatus, interventionStatus } = {}) {
  const state = String(task?.state || '');
  const actions = [];
  if (state === 'plan_review') actions.push('rerun_review');
  if (state === 'approved' || (latestReview && String(latestReview.verdict || '') === 'approve_with_notes')) actions.push('rerun_judge');
  if (state !== 'planning') actions.push('reset_to_planning');
  if (deliveryStatus !== 'deliverable_ready') actions.push('manual_done');
  if (interventionStatus !== 'human_intervention_required') actions.push('manual_block');
  if (state !== 'cancelled') actions.push('manual_cancel');
  return actions;
}

function buildRoleProtocol(role = '', entity = null, fallbackMemberKey = '') {
  const base = TEAM_ROLE_CONTRACTS[String(role || '').trim()] || {};
  const entityContractVersion = entity?.contractVersion && String(entity.contractVersion).trim();
  const entityOutputType = entity?.outputType && String(entity.outputType).trim();
  const entityMemberKey = entity?.memberKey && String(entity.memberKey).trim();
  return {
    memberKey: entityMemberKey || fallbackMemberKey || '',
    contractVersion: entityContractVersion || base.contractVersion || '',
    outputType: entityOutputType || base.outputType || '',
  };
}

function summarizeChildTaskExecutionSurface(task = {}, roleConfig = {}) {
  const metadata = task?.metadata && typeof task.metadata === 'object' ? task.metadata : {};
  const role = String(metadata.workItemRole || '').trim().toLowerCase();
  const allowed = getRoleExecutionSurfaceContract(role, roleConfig) || { skills: [], tools: [], mcpServers: [] };
  return {
    requiredCapabilities: Array.isArray(metadata.requiredCapabilities) ? metadata.requiredCapabilities.slice(0, 12).map((v) => String(v || '').trim()).filter(Boolean) : [],
    requiredSkills: Array.isArray(metadata.requiredSkills) ? metadata.requiredSkills.slice(0, 12).map((v) => String(v || '').trim()).filter(Boolean) : [],
    requiredTools: Array.isArray(metadata.requiredTools) ? metadata.requiredTools.slice(0, 12).map((v) => String(v || '').trim()).filter(Boolean) : [],
    requiredMcpServers: Array.isArray(metadata.requiredMcpServers) ? metadata.requiredMcpServers.slice(0, 12).map((v) => String(v || '').trim()).filter(Boolean) : [],
    allowedSkills: Array.isArray(allowed.skills) ? allowed.skills.slice(0, 20) : [],
    allowedTools: Array.isArray(allowed.tools) ? allowed.tools.slice(0, 20) : [],
    allowedMcpServers: Array.isArray(allowed.mcpServers) ? allowed.mcpServers.slice(0, 20) : [],
  };
}

function summarizeTaskMemoryLayers(snapshot = {}) {
  const planSummary = String(snapshot?.plan?.summary || snapshot?.plan?.title || '').trim();
  const latestReviewSummary = String(snapshot?.latestReview?.summary || '').trim();
  const latestDecisionSummary = String(snapshot?.latestDecision?.reason || snapshot?.latestDecision?.summary || '').trim();
  const latestBlackboard = Array.isArray(snapshot?.blackboard) ? snapshot.blackboard.slice(0, 4) : [];
  const latestArtifacts = Array.isArray(snapshot?.artifacts) ? snapshot.artifacts.slice(0, 4) : [];
  const latestEvidence = Array.isArray(snapshot?.evidence) ? snapshot.evidence.slice(0, 4) : [];
  const dependencyBoundCount = Array.isArray(snapshot?.childTasks)
    ? snapshot.childTasks.filter((child) => Array.isArray(child?.metadata?.dependencies) && child.metadata.dependencies.length > 0).length
    : 0;
  const blackboardSections = Array.from(new Set((snapshot?.blackboard || []).map((entry) => String(entry?.section || 'general')).filter(Boolean)));

  return {
    layerCount: 3,
    working: {
      key: 'working',
      label: 'L1 即时工作记忆',
      source: 'workItem.context + dependency results',
      childTaskCount: Array.isArray(snapshot?.childTasks) ? snapshot.childTasks.length : 0,
      dependencyBoundCount,
      preview: dependencyBoundCount > 0
        ? `当前已有 ${dependencyBoundCount} 个子任务绑定了上游依赖结果。`
        : '当前主要按任务目标直接推进，尚无显式依赖链。',
    },
    shared: {
      key: 'shared',
      label: 'L2 任务共享记忆',
      source: 'blackboard / member findings / signals',
      entryCount: Array.isArray(snapshot?.blackboard) ? snapshot.blackboard.length : 0,
      sectionCount: blackboardSections.length,
      sections: blackboardSections.slice(0, 8),
      latest: latestBlackboard.map((entry) => ({
        key: String(entry?.entryKey || ''),
        section: String(entry?.section || 'general'),
        summary: String(entry?.value?.summary || entry?.value?.text || entry?.value?.content || JSON.stringify(entry?.value || {})).slice(0, 160),
      })),
    },
    durable: {
      key: 'durable',
      label: 'L3 持久证据记忆',
      source: 'plans / reviews / decisions / artifacts / evidence',
      planPresent: !!snapshot?.plan,
      reviewCount: Array.isArray(snapshot?.reviews) ? snapshot.reviews.length : 0,
      decisionCount: Array.isArray(snapshot?.decisions) ? snapshot.decisions.length : 0,
      artifactCount: Array.isArray(snapshot?.artifacts) ? snapshot.artifacts.length : 0,
      evidenceCount: Array.isArray(snapshot?.evidence) ? snapshot.evidence.length : 0,
      latestPlanSummary: planSummary.slice(0, 180),
      latestReviewSummary: latestReviewSummary.slice(0, 180),
      latestDecisionSummary: latestDecisionSummary.slice(0, 180),
      latestArtifacts: latestArtifacts.map((item) => ({ type: String(item?.artifactType || 'artifact'), title: String(item?.title || '').slice(0, 120) })),
      latestEvidence: latestEvidence.map((item) => ({ type: String(item?.evidenceType || 'evidence'), title: String(item?.title || item?.detail || '').slice(0, 120) })),
    },
  };
}

function snapshotTask(teamStore, taskId = '') {
  const task = taskId ? teamStore.getTaskById(taskId) : null;
  if (!task) return { task: null };

  const roleConfig = loadTeamRolesConfig();
  const plan = teamStore.getLatestPlanByTask ? teamStore.getLatestPlanByTask(taskId) : null;
  const reviews = teamStore.listReviewsByTask ? teamStore.listReviewsByTask(taskId) : [];
  const decisions = teamStore.listDecisionsByTask ? teamStore.listDecisionsByTask(taskId) : [];
  const latestReview = reviews[0] || null;
  const latestDecision = decisions[0] || null;
  const artifacts = teamStore.listArtifactsByTask ? teamStore.listArtifactsByTask({ taskId, limit: 200 }) : [];
  const evidence = teamStore.listEvidenceByTask ? teamStore.listEvidenceByTask({ taskId, limit: 200 }) : [];
  const blackboard = teamStore.listBlackboardEntries ? teamStore.listBlackboardEntries({ taskId, limit: 200 }) : [];
  const mailboxAll = teamStore.listMailboxMessages ? teamStore.listMailboxMessages({ teamId: task.teamId, limit: 200 }) : [];
  const mailbox = mailboxAll.filter((m) => String(m.taskId || '') === String(taskId || ''));
  const childTasks = teamStore.listRecentTasks
    ? teamStore.listRecentTasks(400).filter((item) => String(item?.parentTaskId || '') === String(taskId || ''))
    : [];

  const node = canonicalNodeId(String(task?.metadata?.actualNode || DEFAULT_NODE_ID), DEFAULT_NODE_ID);
  const protocol = {
    planner: buildRoleProtocol('planner', plan, `planner.${node}`),
    critic: buildRoleProtocol('critic', latestReview, `critic.${node}`),
    judge: buildRoleProtocol('judge', latestDecision, `judge.${node}`),
  };

  const currentMemberKey = String(
    task?.metadata?.currentMemberKey
    || latestDecision?.memberKey
    || protocol.judge.memberKey
    || `judge.${DEFAULT_NODE_ID}`
  );

  return {
    task,
    plan,
    reviews,
    decisions,
    latestReview,
    latestDecision,
    artifacts,
    evidence,
    blackboard,
    mailbox,
    childTasks: childTasks.map((child) => ({
      ...child,
      executionSurface: summarizeChildTaskExecutionSurface(child, roleConfig),
    })),
    protocol,
    currentMemberKey,
    requestedNode: String(task?.metadata?.requestedNode || ''),
    actualNode: String(task?.metadata?.actualNode || ''),
    degradedReason: String(task?.metadata?.degradedReason || ''),
  };
}

function redactMailboxPayload(kind = '', payload = {}) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const safeText = (value, max = 240) => {
    const text = String(value || '').trim();
    return text ? text.slice(0, max) : '';
  };
  const safeStringArray = (value, maxItems = 6, maxLen = 120) => Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => safeText(item, maxLen)).filter(Boolean)
    : [];

  switch (String(kind || '')) {
    case 'task.create':
      return {
        title: safeText(p.title, 160),
        taskMode: safeText(p.taskMode, 40),
        priority: Number(p.priority || 0),
      };
    case 'task.assign':
    case 'routing.decided':
      return {
        role: safeText(p.role || p.requestedRole, 40),
        requestedNode: safeText(p.requestedNode, 40),
        actualNode: safeText(p.actualNode, 40),
        degradedReason: safeText(p.degradedReason, 120),
      };
    case 'plan.submit':
      return {
        planId: safeText(p.planId, 64),
        summary: safeText(p.summary, 240),
        stepCount: Array.isArray(p.steps) ? p.steps.length : Number(p.stepCount || 0),
        riskCount: Array.isArray(p.risks) ? p.risks.length : Number(p.riskCount || 0),
      };
    case 'review.request':
      return {
        targetType: safeText(p.targetType, 40),
        targetId: safeText(p.targetId, 64),
      };
    case 'review.result':
      return {
        verdict: safeText(p.verdict, 40),
        score: Number(p.score || 0),
        issueCount: Array.isArray(p.issues) ? p.issues.length : Number(p.issueCount || 0),
        issues: safeStringArray(p.issues, 5, 160),
      };
    case 'decision.request':
      return {
        targetType: safeText(p.targetType, 40),
        targetId: safeText(p.targetId, 64),
      };
    case 'decision.final':
    case 'decision.escalate_human':
      return {
        decisionType: safeText(p.decisionType, 40),
        state: safeText(p.state || p.nextState, 40),
        reason: safeText(p.reason, 240),
      };
    case 'execute.request':
      return {
        actionType: safeText(p.actionType, 40),
        summary: safeText(p.summary || p.title, 240),
      };
    case 'executor.result':
      return {
        status: safeText(p.status, 40),
        summary: safeText(p.summary || p.message, 240),
        artifactCount: Number(p.artifactCount || 0),
        evidenceCount: Number(p.evidenceCount || 0),
      };
    case 'planner.session.started':
      return {
        role: safeText(p.role || 'planner', 40),
        node: safeText(p.node, 40),
      };
    case 'reroute.requested':
    case 'reroute.consumed':
      return {
        role: safeText(p.role, 40),
        requestedNode: safeText(p.requestedNode, 40),
        actualNode: safeText(p.actualNode, 40),
        reason: safeText(p.reason, 160),
      };
    case 'agent.message':
      return {
        summary: safeText(p.summary || p.message || p.content, 240),
        category: safeText(p.category, 40),
      };
    case 'task.replan.result':
      return {
        summary: safeText(p.summary, 240),
        reason: safeText(p.reason, 200),
        workItemCount: Number(p.workItemCount || 0),
        assignmentId: safeText(p.assignmentId, 64),
        childTaskId: safeText(p.childTaskId, 64),
        titles: safeStringArray(p.titles, 5, 120),
        beforeTitle: safeText(p.beforeTitle, 160),
        beforeRole: safeText(p.beforeRole, 40),
        retainedCount: Number(p.retainedCount || 0),
        addedCount: Number(p.addedCount || 0),
        replaced: !!p.replaced,
        retainedTitles: safeStringArray(p.retainedTitles, 5, 120),
        addedTitles: safeStringArray(p.addedTitles, 5, 120),
      };
    default:
      return {
        summary: safeText(p.summary || p.message || p.title || '', 240),
      };
  }
}

function sanitizeMailboxEntry(item = {}) {
  return {
    messageId: String(item.messageId || ''),
    kind: String(item.kind || ''),
    fromMemberId: String(item.fromMemberId || ''),
    toMemberId: String(item.toMemberId || ''),
    payload: redactMailboxPayload(item.kind, item.payload || {}),
    createdAt: Number(item.createdAt || 0),
    taskId: String(item.taskId || ''),
    teamId: String(item.teamId || ''),
    status: String(item.status || ''),
    broadcast: !!item.broadcast,
  };
}

function buildLatestReplanMap(snapshot = {}) {
  const mailbox = Array.isArray(snapshot.mailbox) ? snapshot.mailbox : [];
  const blackboard = Array.isArray(snapshot.blackboard) ? snapshot.blackboard : [];
  const latestMailboxReplan = mailbox.find((item) => String(item?.kind || '') === 'task.replan.result');
  if (!latestMailboxReplan) return null;

  const assignmentId = String(latestMailboxReplan?.payload?.assignmentId || '').trim();
  const childTaskId = String(latestMailboxReplan?.payload?.childTaskId || '').trim();
  const replanBoardEntry = blackboard.find((entry) => {
    const key = String(entry?.entryKey || '');
    const metaAssignmentId = String(entry?.value?.assignmentId || entry?.metadata?.assignmentId || '').trim();
    const metaChildTaskId = String(entry?.value?.childTaskId || entry?.metadata?.childTaskId || '').trim();
    if (!key.startsWith('replan:')) return false;
    if (assignmentId && metaAssignmentId === assignmentId) return true;
    if (childTaskId && metaChildTaskId === childTaskId) return true;
    return false;
  }) || blackboard.find((entry) => String(entry?.entryKey || '').startsWith('replan:'));

  const value = replanBoardEntry?.value && typeof replanBoardEntry.value === 'object' ? replanBoardEntry.value : {};
  const beforeWorkItem = value?.beforeWorkItem && typeof value.beforeWorkItem === 'object' ? value.beforeWorkItem : null;
  const diff = value?.diff && typeof value.diff === 'object' ? value.diff : {};
  const workItems = Array.isArray(value?.workItems)
    ? value.workItems.slice(0, 12).map((item, index) => ({
        index,
        id: String(item?.id || item?.assignmentId || item?.workItemId || '').trim(),
        role: String(item?.role || '').trim(),
        title: String(item?.title || '').trim(),
        objective: String(item?.objective || item?.task || '').trim(),
        acceptance: String(item?.acceptance || '').trim(),
        deliverables: Array.isArray(item?.deliverables) ? item.deliverables.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : [],
        dependencies: Array.isArray(item?.dependencies) ? item.dependencies.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : [],
      }))
    : [];

  return {
    summary: String(latestMailboxReplan?.payload?.summary || '').trim(),
    reason: String(latestMailboxReplan?.payload?.reason || '').trim(),
    assignmentId,
    childTaskId,
    createdAt: Number(latestMailboxReplan?.createdAt || 0),
    beforeWorkItem: beforeWorkItem ? {
      id: String(beforeWorkItem?.id || '').trim(),
      role: String(beforeWorkItem?.role || '').trim(),
      title: String(beforeWorkItem?.title || '').trim(),
      objective: String(beforeWorkItem?.objective || beforeWorkItem?.task || '').trim(),
      acceptance: String(beforeWorkItem?.acceptance || '').trim(),
      deliverables: Array.isArray(beforeWorkItem?.deliverables) ? beforeWorkItem.deliverables.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : [],
      dependencies: Array.isArray(beforeWorkItem?.dependencies) ? beforeWorkItem.dependencies.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : [],
    } : null,
    diff: {
      beforeTitle: String(diff?.beforeTitle || latestMailboxReplan?.payload?.beforeTitle || '').trim(),
      beforeRole: String(diff?.beforeRole || latestMailboxReplan?.payload?.beforeRole || '').trim(),
      retainedCount: Number(diff?.retainedCount || latestMailboxReplan?.payload?.retainedCount || 0),
      addedCount: Number(diff?.addedCount || latestMailboxReplan?.payload?.addedCount || 0),
      replaced: !!(diff?.replaced ?? latestMailboxReplan?.payload?.replaced),
      retainedTitles: Array.isArray(diff?.retainedTitles) ? diff.retainedTitles.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : (Array.isArray(latestMailboxReplan?.payload?.retainedTitles) ? latestMailboxReplan.payload.retainedTitles.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : []),
      addedTitles: Array.isArray(diff?.addedTitles) ? diff.addedTitles.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : (Array.isArray(latestMailboxReplan?.payload?.addedTitles) ? latestMailboxReplan.payload.addedTitles.slice(0, 6).map((v) => String(v || '').trim()).filter(Boolean) : []),
    },
    workItems,
  };
}

function summarizeProtocol(protocol = null) {
  if (!protocol) return null;
  return {
    memberKey: String(protocol.memberKey || ''),
    contractVersion: String(protocol.contractVersion || ''),
    outputType: String(protocol.outputType || ''),
  };
}

function redactPlan(plan = null) {
  if (!plan) return null;
  return {
    planId: String(plan.planId || ''),
    taskId: String(plan.taskId || ''),
    authorMemberId: String(plan.authorMemberId || ''),
    memberKey: String(plan.memberKey || ''),
    contractVersion: String(plan.contractVersion || ''),
    outputType: String(plan.outputType || ''),
    version: Number(plan.version || 0),
    summary: String(plan.summary || ''),
    stepCount: Array.isArray(plan.steps) ? plan.steps.length : 0,
    riskCount: Array.isArray(plan.risks) ? plan.risks.length : 0,
    createdAt: Number(plan.createdAt || 0),
    updatedAt: Number(plan.updatedAt || 0),
  };
}

function redactReview(review = null) {
  if (!review) return null;
  return {
    reviewId: String(review.reviewId || ''),
    taskId: String(review.taskId || ''),
    targetType: String(review.targetType || ''),
    targetId: String(review.targetId || ''),
    reviewerMemberId: String(review.reviewerMemberId || ''),
    memberKey: String(review.memberKey || ''),
    contractVersion: String(review.contractVersion || ''),
    outputType: String(review.outputType || ''),
    score: Number(review.score || 0),
    verdict: String(review.verdict || ''),
    issueCount: Array.isArray(review.issues) ? review.issues.length : 0,
    issues: Array.isArray(review.issues)
      ? review.issues.slice(0, 5).map((issue) => typeof issue === 'string'
        ? String(issue).slice(0, 160)
        : String(issue?.title || issue?.summary || issue?.message || '').slice(0, 160)).filter(Boolean)
      : [],
    createdAt: Number(review.createdAt || 0),
  };
}

function redactDecision(decision = null) {
  if (!decision) return null;
  return {
    decisionId: String(decision.decisionId || ''),
    taskId: String(decision.taskId || ''),
    judgeMemberId: String(decision.judgeMemberId || ''),
    memberKey: String(decision.memberKey || ''),
    contractVersion: String(decision.contractVersion || ''),
    outputType: String(decision.outputType || ''),
    decisionType: String(decision.decisionType || ''),
    reason: String(decision.reason || '').slice(0, 240),
    nextState: String(decision?.payload?.nextState || ''),
    createdAt: Number(decision.createdAt || 0),
  };
}

function rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized) {
  if (isDashboardAuthorized?.(req)) return false;
  sendJson(res, 401, { ok: false, error: 'dashboard_unauthorized' });
  return true;
}

export function tryHandleHealthStateRoute(req, res, ctx = {}) {
  const {
    isOrchAuthorized,
    isDashboardAuthorized,
    sendJson,
    teamStore,
    TEAM_ROLE_DEPLOYMENT,
    teamNodeHealth,
    teamResidentRuntime,
    agentLifecycle,
    PORT,
    TEAM_JUDGE_TRUE_EXECUTION,
    JUDGE_TRUE_EXECUTION_WIRED,
  } = ctx;

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'qq-orchestrator',
      port: PORT,
      mode: 'team-runtime-v1',
      team: {
        db: {
          path: teamStore.dbPath,
          stats: teamStore.stats(),
        },
        judge: {
          trueExecutionEnabled: TEAM_JUDGE_TRUE_EXECUTION,
          wired: JUDGE_TRUE_EXECUTION_WIRED,
        },
      }
    });
    return true;
  }

  if (req.method === 'GET' && req.url === '/state/team/contracts') {
    sendJson(res, 200, buildStableEnvelope({
      route: 'contracts',
      resourceKind: 'contract_catalog',
      resource: {
        kind: 'contract_catalog',
        count: Object.keys(TEAM_ROLE_CONTRACTS || {}).length,
      },
      query: {},
      payload: {
        ok: true,
        contracts: TEAM_ROLE_CONTRACTS,
        queryContracts: buildStateQueryContracts(),
      },
    }));
    return true;
  }

  if (req.method === 'GET' && (req.url === '/state/team' || req.url?.startsWith('/state/team?'))) {
    const view = String(parseUrlParam(req.url, 'view') || 'active').toLowerCase();
    const activeOnlyParam = String(parseUrlParam(req.url, 'activeOnly') || '').toLowerCase();
    const activeOnly = activeOnlyParam === '' ? view !== 'all' : activeOnlyParam !== 'false';
    const limit = Number(parseUrlParam(req.url, 'limit') || 20);
    const tasks = teamStore.listRecentTasks ? teamStore.listRecentTasks(Math.max(limit, 20)) : [];
    const activeBatchOverview = tasks
      .filter((task) => {
        const state = String(task?.state || '').toLowerCase();
        if (!activeOnly) return true;
        return !['done', 'cancelled', 'archived'].includes(state);
      })
      .slice(0, limit)
      .map((task) => {
        const taskId = String(task.taskId || '');
        const s = snapshotTask(teamStore, taskId);
        const issueCount = s.evidence?.filter ? s.evidence.filter((e) => String(e.evidenceType || '') === 'review_issue').length : 0;
        const revisionCount = s.reviews?.filter ? s.reviews.filter((r) => String(r.verdict || '').toLowerCase() === 'revise').length : 0;
        const currentDriver = inferCurrentDriver({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision });
        const nextBestAction = inferNextBestAction({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision, artifactCount: (s.artifacts || []).length, evidenceCount: (s.evidence || []).length });
        const deliveryStatus = computeDeliveryStatus({ task: s.task || task, latestDecision: s.latestDecision, artifactCount: (s.artifacts || []).length });
        const interventionStatus = computeInterventionStatus({ task: s.task || task, issueCount, revisionCount, latestDecision: s.latestDecision });
        const executiveSummary = buildExecutiveSummary({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision, deliveryStatus, interventionStatus, nextBestAction });
        const protocolSource = s.latestDecision ? 'decision' : s.latestReview ? 'review' : s.plan ? 'plan' : 'task';
        return {
          taskId,
          teamId: String((s.task || task).teamId || ''),
          title: String((s.task || task).title || ''),
          state: String((s.task || task).state || ''),
          batchId: String((s.task || task)?.metadata?.batchId || ''),
          currentMemberKey: s.currentMemberKey,
          currentDriver,
          nextBestAction,
          deliveryStatus,
          interventionStatus,
          executiveSummary,
          protocolSource,
          protocol: {
            plan: s.protocol?.planner || null,
            review: s.protocol?.critic || null,
            decision: s.protocol?.judge || null,
          },
          counters: {
            artifactCount: (s.artifacts || []).length,
            evidenceCount: (s.evidence || []).length,
            issueCount,
            revisionCount,
          },
          updatedAt: (s.task || task).updatedAt || null,
        };
      });

    sendJson(res, 200, buildStableEnvelope({
      route: 'root',
      resourceKind: 'team_collection',
      resource: {
        kind: 'team_collection',
        count: Number(teamStore.stats?.().teams || 0),
      },
      query: { view, activeOnly, limit },
      payload: {
        ok: true,
        db: { path: teamStore.dbPath },
        stats: teamStore.stats(),
        deployment: TEAM_ROLE_DEPLOYMENT?.list ? TEAM_ROLE_DEPLOYMENT.list() : null,
        governance: {
          activeBatchOverview,
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url === '/state/team/config') {
    // NOTE: /state/* routes are registered here (health/state router), not in index-routes-team.mjs.
    // Keep this as GET-only public surface for debugging and ops.

    const config = loadTeamRolesConfig();
    const status = getTeamRolesConfigStatus();
    const resolution = status?.resolution || {};
    sendJson(res, 200, buildStableEnvelope({
      route: 'config',
      resourceKind: 'team_config',
      resource: {
        kind: 'team_config',
        count: Object.keys(config.roles || {}).length,
      },
      query: {},
      payload: {
        ok: true,
        config: {
          version: config.version,
          defaults: config.defaults,
          routing: config.routing,
          nodeMap: config.nodeMap,
          roles: config.roles,
        },
        configStatus: {
          ...status,
          resolution: {
            ...resolution,
            usedLegacy: String(resolution.usedLegacy ?? false),
          },
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/tasks')) {
    const teamId = parseUrlParam(req.url, 'teamId');
    const items = teamStore.listTasksByTeam(teamId);
    sendJson(res, 200, buildStableEnvelope({
      route: 'tasks',
      resourceKind: 'task_list',
      resource: {
        kind: 'task_list',
        count: items.length,
        teamId: String(teamId || ''),
      },
      query: { teamId: String(teamId || '') },
      payload: { ok: true, items },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/mailbox')) {
    if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
    const teamId = parseUrlParam(req.url, 'teamId');
    const taskId = parseUrlParam(req.url, 'taskId');
    const limit = Number(parseUrlParam(req.url, 'limit') || 100);
    let items = teamStore.listMailboxMessages({ teamId, limit });
    if (taskId) items = items.filter((item) => String(item.taskId || '') === String(taskId || ''));
    const sanitizedItems = items.map(sanitizeMailboxEntry);
    sendJson(res, 200, buildStableEnvelope({
      route: 'mailbox',
      resourceKind: 'mailbox_list',
      resource: {
        kind: 'mailbox_list',
        count: sanitizedItems.length,
        teamId: String(teamId || ''),
        taskId: String(taskId || ''),
      },
      query: { teamId: String(teamId || ''), taskId: String(taskId || ''), limit },
      api: { access: 'dashboard_token', sensitivity: 'high' },
      payload: {
        ok: true,
        items: sanitizedItems,
        boundary: {
          access: 'dashboard_token',
          sensitivity: 'high',
          redaction: 'timeline_sanitized',
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/inbox')) {
    const teamId = parseUrlParam(req.url, 'teamId');
    const memberId = parseUrlParam(req.url, 'memberId');
    const taskId = parseUrlParam(req.url, 'taskId');
    const limit = Number(parseUrlParam(req.url, 'limit') || 100);
    if (!teamId) {
      sendJson(res, 400, { ok: false, error: 'team_id_required' });
      return true;
    }
    if (!memberId) {
      sendJson(res, 400, { ok: false, error: 'member_id_required' });
      return true;
    }
    let items = teamStore.listMailboxMessagesForMember
      ? teamStore.listMailboxMessagesForMember({ teamId, memberId, limit })
      : [];
    if (taskId) items = items.filter((item) => String(item.taskId || '') === String(taskId || ''));
    sendJson(res, 200, buildStableEnvelope({
      route: 'inbox',
      resourceKind: 'member_inbox',
      resource: {
        kind: 'member_inbox',
        count: items.length,
        teamId: String(teamId || ''),
        memberId: String(memberId || ''),
        taskId: String(taskId || ''),
      },
      query: { teamId: String(teamId || ''), memberId: String(memberId || ''), taskId: String(taskId || ''), limit },
      payload: { ok: true, items },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/blackboard')) {
    const taskId = parseUrlParam(req.url, 'taskId');
    const limit = Number(parseUrlParam(req.url, 'limit') || 200);
    const items = teamStore.listBlackboardEntries({ taskId, limit });
    sendJson(res, 200, buildStableEnvelope({
      route: 'blackboard',
      resourceKind: 'blackboard_list',
      resource: {
        kind: 'blackboard_list',
        count: items.length,
        taskId: String(taskId || ''),
      },
      query: { taskId: String(taskId || ''), limit },
      payload: { ok: true, items },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/artifacts')) {
    const taskId = parseUrlParam(req.url, 'taskId');
    const limit = Number(parseUrlParam(req.url, 'limit') || 200);
    const items = teamStore.listArtifactsByTask ? teamStore.listArtifactsByTask({ taskId, limit }) : [];
    sendJson(res, 200, buildStableEnvelope({
      route: 'artifacts',
      resourceKind: 'artifact_list',
      resource: {
        kind: 'artifact_list',
        count: items.length,
        taskId: String(taskId || ''),
      },
      query: { taskId: String(taskId || ''), limit },
      payload: { ok: true, items },
    }));
    return true;
  }

  // P3: Artifact file content fetch - supports "打开文件" / "下载"
  if (req.method === 'GET' && req.url?.startsWith('/state/team/artifact-file')) {
    if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
    const artifactId = parseUrlParam(req.url, 'artifactId');
    if (!artifactId) {
      sendJson(res, 400, { ok: false, error: 'artifactId_required' });
      return true;
    }
    const artifact = teamStore.getArtifactById ? teamStore.getArtifactById(artifactId) : null;
    if (!artifact) {
      sendJson(res, 404, { ok: false, error: 'artifact_not_found' });
      return true;
    }
    const body = artifact.body || {};
    const workspacePath = body?.workspacePath || body?.path || body?.workspaceRelativePath || body?.refId || '';
    const inlineContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    if (!workspacePath) {
      sendJson(res, 200, buildStableEnvelope({
        route: 'artifact-file',
        resourceKind: 'artifact_file',
        resource: { kind: 'artifact_file', artifactId: String(artifactId || ''), taskId: String(artifact?.taskId || '') },
        query: { artifactId: String(artifactId || '') },
        payload: { ok: true, artifactId, type: 'inline', content: inlineContent, contentType: 'text/plain' },
      }));
      return true;
    }

    const workspaceRoot = String(process.env.TEAM_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT || process.cwd());
    const resolvedRoot = path.resolve(workspaceRoot);
    const candidate = path.isAbsolute(String(workspacePath || ''))
      ? path.resolve(String(workspacePath || ''))
      : path.resolve(resolvedRoot, String(workspacePath || ''));

    if (!(candidate === resolvedRoot || candidate.startsWith(`${resolvedRoot}${path.sep}`))) {
      sendJson(res, 403, { ok: false, error: 'path_outside_workspace' });
      return true;
    }

    let stat = null;
    try { stat = fs.statSync(candidate); } catch { stat = null; }
    if (!stat || !stat.isFile()) {
      sendJson(res, 404, { ok: false, error: 'file_not_found', path: candidate });
      return true;
    }
    if (stat.size > 1024 * 1024) {
      sendJson(res, 413, { ok: false, error: 'file_too_large', maxSize: 1024 * 1024, size: stat.size, path: candidate });
      return true;
    }

    try {
      const content = fs.readFileSync(candidate, 'utf8');
      const ext = path.extname(candidate).toLowerCase();
      const contentTypeMap = {
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.cjs': 'application/javascript',
        '.ts': 'application/typescript',
        '.tsx': 'application/typescript',
        '.json': 'application/json',
        '.md': 'text/markdown',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.py': 'text/x-python',
        '.sh': 'text/x-shellscript',
        '.yaml': 'text/yaml',
        '.yml': 'text/yaml',
      };
      sendJson(res, 200, buildStableEnvelope({
        route: 'artifact-file',
        resourceKind: 'artifact_file',
        resource: { kind: 'artifact_file', artifactId: String(artifactId || ''), taskId: String(artifact?.taskId || '') },
        query: { artifactId: String(artifactId || '') },
        payload: {
          ok: true,
          artifactId,
          type: 'file',
          path: candidate,
          workspacePath: String(workspacePath || ''),
          content,
          contentType: contentTypeMap[ext] || 'text/plain',
          size: stat.size,
        },
      }));
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err?.message || 'read_error') });
    }
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/evidence')) {
    const taskId = parseUrlParam(req.url, 'taskId');
    const limit = Number(parseUrlParam(req.url, 'limit') || 200);
    const items = teamStore.listEvidenceByTask ? teamStore.listEvidenceByTask({ taskId, limit }) : [];
    sendJson(res, 200, buildStableEnvelope({
      route: 'evidence',
      resourceKind: 'evidence_list',
      resource: {
        kind: 'evidence_list',
        count: items.length,
        taskId: String(taskId || ''),
      },
      query: { taskId: String(taskId || ''), limit },
      payload: { ok: true, items },
    }));
    return true;
  }

  // P3: Pipeline observability - aggregate view of task progression
  const taskObservabilityRouteCtx = {
    sendJson,
    buildStableEnvelope,
    parseUrlParam,
    rejectDashboardUnauthorized,
    isDashboardAuthorized,
    teamStore,
    snapshotTask,
    agentLifecycle,
    teamNodeHealth,
    TEAM_ROLE_DEPLOYMENT,
    helpers: {
      inferNextBestAction,
      inferCurrentDriver,
      computeDeliveryStatus,
      computeInterventionStatus,
      buildExecutiveSummary,
      getManualActions,
      summarizeTaskMemoryLayers,
      summarizeProtocol,
      redactPlan,
      redactReview,
      redactDecision,
      sanitizeMailboxEntry,
      buildLatestReplanMap,
    },
  };
  if (tryHandleTeamNodesRoute(req, res, taskObservabilityRouteCtx)) return true;
  if (tryHandleTeamAgentsRoute(req, res, taskObservabilityRouteCtx)) return true;
  if (tryHandleTeamWorkbenchRoute(req, res, taskObservabilityRouteCtx)) return true;
  if (tryHandleTeamControlRoute(req, res, taskObservabilityRouteCtx)) return true;
  if (tryHandleTeamSummaryRoute(req, res, taskObservabilityRouteCtx)) return true;
  if (tryHandleTeamPipelineRoute(req, res, taskObservabilityRouteCtx)) return true;

  // P1: Resident roles registry (bootstrap + heartbeat + lease)
  if (req.method === 'GET' && req.url?.startsWith('/state/team/residents')) {
    const teamId = parseUrlParam(req.url, 'teamId');
    const includeOffline = String(parseUrlParam(req.url, 'includeOffline') || 'true') !== 'false';
    const ensure = String(parseUrlParam(req.url, 'ensure') || 'true') !== 'false';
    const rolesParam = String(parseUrlParam(req.url, 'roles') || '').trim();
    const roles = rolesParam
      ? rolesParam.split(',').map((x) => String(x || '').trim()).filter(Boolean)
      : ['planner', 'critic', 'judge', 'executor', 'observer', 'monitor', 'output'];

    if (ensure && teamResidentRuntime?.ensureResidentMembers && teamId) {
      try {
        teamResidentRuntime.ensureResidentMembers({ teamId, roles });
      } catch {}
    }

    const overview = teamResidentRuntime?.getResidentOverview
      ? teamResidentRuntime.getResidentOverview({ teamId })
      : { ok: false, error: 'resident_runtime_not_wired' };

    sendJson(res, 200, buildStableEnvelope({
      route: 'residents',
      resourceKind: 'resident_registry',
      resource: {
        kind: 'resident_registry',
        count: Number(overview?.count || 0),
        teamId: String(teamId || ''),
      },
      query: { teamId: String(teamId || ''), includeOffline, ensure, roles },
      payload: {
        ok: true,
        residents: includeOffline ? (overview?.residents || []) : (overview?.residents || []).filter((x) => String(x?.status || '') !== 'offline'),
        nodes: overview?.nodes || null,
        observedAt: overview?.observedAt || Date.now(),
        counts: {
          count: Number(overview?.count || 0),
          busyCount: Number(overview?.busyCount || 0),
          activeLeaseCount: Number(overview?.activeLeaseCount || 0),
        },
        deployment: TEAM_ROLE_DEPLOYMENT?.list ? TEAM_ROLE_DEPLOYMENT.list() : null,
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/threads')) {
    if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
    const taskId = parseUrlParam(req.url, 'taskId');
    const effectiveLimit = Number(parseUrlParam(req.url, 'limit') || 200);
    const rootTask = taskId ? teamStore.getTaskById(taskId) : null;
    const candidateTasks = taskId
      ? [rootTask, ...(teamStore.listRecentTasks ? teamStore.listRecentTasks(Math.max(effectiveLimit * 4, 200)) : [])]
      : (teamStore.listRecentTasks ? teamStore.listRecentTasks(Math.max(effectiveLimit, 200)) : []);

    const seen = new Set();
    const items = [];
    for (const task of candidateTasks) {
      if (!task?.taskId) continue;
      const currentTaskId = String(task.taskId || '');
      if (seen.has(currentTaskId)) continue;
      if (taskId) {
        const parentTaskId = String(task.parentTaskId || '');
        if (currentTaskId !== String(taskId) && parentTaskId !== String(taskId)) continue;
      }
      const item = buildThreadSummaryItem(teamStore, task);
      if (!item) continue;
      seen.add(currentTaskId);
      items.push(item);
      if (items.length >= effectiveLimit) break;
    }

    sendJson(res, 200, buildStableEnvelope({
      route: 'threads',
      resourceKind: 'thread_list',
      resource: {
        kind: 'thread_list',
        count: items.length,
        taskId: String(taskId || ''),
      },
      query: { taskId: String(taskId || ''), limit: effectiveLimit },
      api: { access: 'dashboard_token', sensitivity: 'medium' },
      payload: {
        ok: true,
        items,
        boundary: {
          access: 'dashboard_token',
          sensitivity: 'medium',
          redaction: 'thread_summary_compact',
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/thread-summary')) {
    if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
    const threadId = parseUrlParam(req.url, 'threadId');
    if (!threadId) {
      sendJson(res, 400, { ok: false, error: 'threadId_required' });
      return true;
    }

    const task = teamStore.getTaskById ? teamStore.getTaskById(threadId) : null;
    if (!task) {
      sendJson(res, 404, { ok: false, error: 'thread_not_found' });
      return true;
    }

    const thread = buildThreadSummaryItem(teamStore, task);
    sendJson(res, 200, buildStableEnvelope({
      route: 'thread-summary',
      resourceKind: 'thread_summary',
      resource: {
        kind: 'thread_summary',
        threadId: String(threadId || ''),
        taskId: String(task.taskId || ''),
        teamId: String(task.teamId || ''),
      },
      query: { threadId: String(threadId || '') },
      api: { access: 'dashboard_token', sensitivity: 'medium' },
      payload: {
        ok: true,
        thread,
        links: {
          workbench: `/state/team/workbench?taskId=${encodeURIComponent(String(task.taskId || ''))}`,
          summary: `/state/team/summary?taskId=${encodeURIComponent(String(task.taskId || ''))}`,
          control: `/state/team/control?taskId=${encodeURIComponent(String(task.taskId || ''))}`,
        },
        boundary: {
          access: 'dashboard_token',
          sensitivity: 'medium',
          redaction: 'thread_summary_compact',
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && (req.url?.startsWith('/state/team/board') || req.url?.startsWith('/state/team/board/view') || req.url?.startsWith('/state/team/queue'))) {
    const rawLimit = Number(parseUrlParam(req.url, 'limit') || 50);
    // 移除 200 限制：前端传 limit>=200 时视为请求全量
    const totalCount = teamStore.countNonChatTasks ? teamStore.countNonChatTasks() : 0;
    const effectiveLimit = rawLimit >= 200 ? Math.max(rawLimit, totalCount) : rawLimit;
    const tasks = teamStore.listRecentTasks ? teamStore.listRecentTasks(effectiveLimit) : [];
    const cards = tasks.map((task) => {
      const taskId = String(task.taskId || '');
      const s = snapshotTask(teamStore, taskId);
      const issueCount = s.evidence?.filter ? s.evidence.filter((e) => String(e.evidenceType || '') === 'review_issue').length : 0;
      const revisionCount = s.reviews?.filter ? s.reviews.filter((r) => String(r.verdict || '').toLowerCase() === 'revise').length : 0;
      const currentDriver = inferCurrentDriver({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision });
      const nextBestAction = inferNextBestAction({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision, artifactCount: (s.artifacts || []).length, evidenceCount: (s.evidence || []).length });
      const deliveryStatus = computeDeliveryStatus({ task: s.task || task, latestDecision: s.latestDecision, artifactCount: (s.artifacts || []).length });
      const interventionStatus = computeInterventionStatus({ task: s.task || task, issueCount, revisionCount, latestDecision: s.latestDecision });
      const executiveSummary = buildExecutiveSummary({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision, deliveryStatus, interventionStatus, nextBestAction });
      const protocolSource = s.latestDecision ? 'decision' : s.latestReview ? 'review' : s.plan ? 'plan' : 'task';
      return {
        taskId,
        teamId: (s.task || task).teamId,
        title: (s.task || task).title || '',
        state: (s.task || task).state || '',
        priority: Number((s.task || task).priority || 0),
        updatedAt: (s.task || task).updatedAt || null,
        currentDriver,
        nextBestAction,
        latestReviewVerdict: s.latestReview?.verdict || null,
        latestDecisionType: s.latestDecision?.decisionType || null,
        latestReviewProtocol: s.protocol?.critic || null,
        latestDecisionProtocol: s.protocol?.judge || null,
        artifactCount: (s.artifacts || []).length,
        evidenceCount: (s.evidence || []).length,
        issueCount,
        revisionCount,
        deliverableReady: deliveryStatus === 'deliverable_ready',
        humanInterventionReady: interventionStatus !== 'no_intervention_needed',
        deliveryStatus,
        interventionStatus,
        requestedNode: s.requestedNode,
        actualNode: s.actualNode,
        degradedReason: s.degradedReason,
        sessionMode: String((s.task || task)?.metadata?.sessionMode || ''),
        sessionPersistent: !!(s.task || task)?.metadata?.sessionPersistent,
        sessionFallbackReason: String((s.task || task)?.metadata?.sessionFallbackReason || ''),
        sessionKey: String((s.task || task)?.metadata?.sessionKey || (s.task || task)?.metadata?.primarySessionKey || ''),
        sessionsByRole: (s.task || task)?.metadata?.sessionsByRole || {},
        planSummary: s.plan?.summary || '',
        executiveSummary,
        protocolSource,
      };
    });

    const columns = {
      planning: cards.filter(c => c.state === 'planning'),
      review: cards.filter(c => c.state === 'plan_review'),
      approved: cards.filter(c => c.state === 'approved'),
      revision: cards.filter(c => c.state === 'revision_requested'),
      blocked: cards.filter(c => c.state === 'blocked'),
      done: cards.filter(c => c.state === 'done'),
      other: cards.filter(c => !['planning','plan_review','approved','revision_requested','blocked','done'].includes(c.state)),
    };
    Object.keys(columns).forEach(k => columns[k].sort((a,b) => (b.priority-a.priority) || (b.updatedAt-a.updatedAt)));

    const queue = [...cards].sort((a,b) => {
      const scoreA = (a.humanInterventionReady ? 1000 : 0) + (a.deliverableReady ? 500 : 0) + (a.issueCount * 20) + a.priority;
      const scoreB = (b.humanInterventionReady ? 1000 : 0) + (b.deliverableReady ? 500 : 0) + (b.issueCount * 20) + b.priority;
      return scoreB - scoreA || (b.updatedAt - a.updatedAt);
    });

    if (req.url?.startsWith('/state/team/board/view')) {
      const orderedCols = ['planning','review','approved','revision','blocked','done','other'];
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>AI Team Board</title><meta http-equiv="refresh" content="30"><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0b1020;color:#e8eefc;margin:0;padding:20px}h1{margin:0 0 10px;font-size:24px}.wrap{display:grid;grid-template-columns:repeat(7,minmax(260px,1fr));gap:14px;align-items:start;overflow:auto}.col{background:#10182d;border:1px solid #243055;border-radius:14px;padding:12px;min-height:220px}.col h2{font-size:14px;margin:0 0 10px;color:#dbe6ff}.card{background:#16203d;border:1px solid #2a3b68;border-radius:12px;padding:10px;margin:10px 0}.muted{color:#98abd8;font-size:12px}.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#22325f;font-size:12px}.prio{color:#ffd166}.ok{color:#88e39a}.warn{color:#ffcc66}.bad{color:#ff8fa3}.refresh-bar{position:fixed;top:0;right:0;padding:6px 14px;background:rgba(16,24,45,0.9);color:#68779e;font-size:11px;border-radius:0 0 0 8px}</style></head><body><div class="refresh-bar" id="rfb">⏱ auto-refresh 30s</div><h1>AI Team Board</h1><div class="muted">source=/state/team/board · queue=/state/team/queue · auto-refresh=30s</div><div class="wrap">${orderedCols.map(col=>`<div class="col"><h2>${col} (${columns[col].length})</h2>${columns[col].map(c=>`<div class="card"><div><strong>${String(c.title||'')}</strong></div><div class="muted">${String(c.taskId||'')}</div><div class="muted">driver=${c.currentDriver} · next=${c.nextBestAction}</div><div class="muted prio">priority=${c.priority}</div><div class="muted">artifacts=${c.artifactCount} evidence=${c.evidenceCount} issues=${c.issueCount}</div><div class="muted ${c.deliverableReady?'ok':'warn'}">deliverable=${c.deliveryStatus}</div><div class="muted ${c.humanInterventionReady?'bad':'ok'}">intervention=${c.interventionStatus}</div><div class="muted">${String(c.executiveSummary||'')}</div></div>`).join('')}</div>`).join('')}</div><script>let s=30;setInterval(()=>{s--;document.getElementById('rfb').textContent='⏱ refresh in '+s+'s';if(s<=0)location.reload()},1000)</script></body></html>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return true;
    }

    if (req.url?.startsWith('/state/team/queue')) {
      sendJson(res, 200, buildStableEnvelope({
        route: 'queue',
        resourceKind: 'task_queue',
        resource: { kind: 'task_queue', count: queue.length },
        query: { limit: rawLimit },
        payload: {
          ok: true,
          queue: {
            count: queue.length,
            items: queue,
            address: 'http://127.0.0.1:19090/state/team/queue',
          },
        },
      }));
      return true;
    }

    sendJson(res, 200, buildStableEnvelope({
      route: 'board',
      resourceKind: 'task_board',
      resource: { kind: 'task_board', count: cards.length },
      query: { limit: rawLimit },
      payload: {
        ok: true,
        board: {
          count: cards.length,
          columns,
          queueAddress: 'http://127.0.0.1:19090/state/team/queue',
          viewAddress: 'http://127.0.0.1:19090/state/team/board/view',
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && (req.url?.startsWith('/state/team/dashboard') || req.url?.startsWith('/state/team/dashboard/view'))) {
    if (rejectDashboardUnauthorized(req, res, sendJson, isDashboardAuthorized)) return true;
    const rawLimit = Number(parseUrlParam(req.url, 'limit') || 20);
    // 移除 200 限制：前端传 limit>=200 时视为请求全量
    const totalCount = teamStore.countNonChatTasks ? teamStore.countNonChatTasks() : 0;
    const effectiveLimit = rawLimit >= 200 ? Math.max(rawLimit, totalCount) : rawLimit;
    const cursor = Number(parseUrlParam(req.url, 'cursor') || 0) || 0;
    const rawTasks = cursor > 0
      ? (teamStore.listRecentTasksBefore ? teamStore.listRecentTasksBefore(cursor, effectiveLimit * 3) : [])
      : (teamStore.listRecentTasks ? teamStore.listRecentTasks(effectiveLimit * 3) : []);
    const tasks = rawTasks
      .filter((task) => {
        const teamId = String(task?.teamId || '');
        const taskId = String(task?.taskId || '');
        if (teamId.startsWith('team:chat:')) return false;
        if (taskId.startsWith('task:chat:')) return false;
        return true;
      })
      .slice(0, effectiveLimit);
    const cards = tasks.map((task) => {
      const taskId = String(task.taskId || '');
      const s = snapshotTask(teamStore, taskId);
      const issueCount = s.evidence?.filter ? s.evidence.filter((e) => String(e.evidenceType || '') === 'review_issue').length : 0;
      const revisionCount = s.reviews?.filter ? s.reviews.filter((r) => String(r.verdict || '').toLowerCase() === 'revise').length : 0;
      const currentDriver = inferCurrentDriver({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision });
      const nextBestAction = inferNextBestAction({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision, artifactCount: (s.artifacts || []).length, evidenceCount: (s.evidence || []).length });
      const deliveryStatus = computeDeliveryStatus({ task: s.task || task, latestDecision: s.latestDecision, artifactCount: (s.artifacts || []).length });
      const interventionStatus = computeInterventionStatus({ task: s.task || task, issueCount, revisionCount, latestDecision: s.latestDecision });
      const executiveSummary = buildExecutiveSummary({ task: s.task || task, latestReview: s.latestReview, latestDecision: s.latestDecision, deliveryStatus, interventionStatus, nextBestAction });
      const protocolSource = s.latestDecision ? 'decision' : s.latestReview ? 'review' : s.plan ? 'plan' : 'task';
      return {
        taskId,
        teamId: (s.task || task).teamId,
        title: (s.task || task).title || '',
        state: (s.task || task).state || '',
        updatedAt: (s.task || task).updatedAt || null,
        currentMemberKey: s.currentMemberKey,
        currentDriver,
        nextBestAction,
        latestReviewVerdict: s.latestReview?.verdict || null,
        latestDecisionType: s.latestDecision?.decisionType || null,
        artifactCount: (s.artifacts || []).length,
        evidenceCount: (s.evidence || []).length,
        issueCount,
        deliverableReady: deliveryStatus === 'deliverable_ready',
        humanInterventionReady: interventionStatus !== 'no_intervention_needed',
        deliveryStatus,
        interventionStatus,
        requestedNode: s.requestedNode,
        actualNode: s.actualNode,
        degradedReason: s.degradedReason,
        sessionMode: String((s.task || task)?.metadata?.sessionMode || ''),
        sessionPersistent: !!(s.task || task)?.metadata?.sessionPersistent,
        sessionFallbackReason: String((s.task || task)?.metadata?.sessionFallbackReason || ''),
        planSummary: s.plan?.summary || '',
        executiveSummary,
        protocolSource,
      };
    });
    if (req.url?.startsWith('/state/team/dashboard/view')) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>AI Team Dashboard</title><meta http-equiv="refresh" content="30"><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0b1020;color:#e8eefc;margin:0;padding:24px}h1{margin:0 0 16px;font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}.card{background:#121a33;border:1px solid #243055;border-radius:14px;padding:16px}.muted{color:#9fb0d8;font-size:12px}.row{display:flex;justify-content:space-between;gap:12px;margin:6px 0}.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#22325f;color:#d9e4ff;font-size:12px}.ok{background:#1f5f3a}.warn{background:#6a4d10}.bad{background:#6a1f2b}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}.refresh-bar{position:fixed;top:0;right:0;padding:6px 14px;background:rgba(16,24,45,0.9);color:#68779e;font-size:11px;border-radius:0 0 0 8px}</style></head><body><div class="refresh-bar" id="rfb">⏱ auto-refresh 30s</div><h1>AI Team Dashboard</h1><div class="muted">cards=${cards.length} · source=/state/team/dashboard · auto-refresh=30s</div><div class="grid">${cards.map(c=>`<div class="card"><div class="row"><strong>${String(c.title||'')}</strong><span class="pill">${String(c.state||'')}</span></div><div class="muted mono">${String(c.taskId||'')}</div><div class="row"><span>driver</span><strong>${String(c.currentDriver||'')}</strong></div><div class="row"><span>next</span><strong>${String(c.nextBestAction||'')}</strong></div><div class="row"><span>review</span><strong>${String(c.latestReviewVerdict||'-')}</strong></div><div class="row"><span>decision</span><strong>${String(c.latestDecisionType||'-')}</strong></div><div class="row"><span>artifacts / evidence / issues</span><strong>${c.artifactCount} / ${c.evidenceCount} / ${c.issueCount}</strong></div><div class="row"><span>deliverableReady</span><strong class="${c.deliverableReady?'ok':'warn'}">${String(c.deliverableReady)}</strong></div><div class="row"><span>humanInterventionReady</span><strong class="${c.humanInterventionReady?'bad':'ok'}">${String(c.humanInterventionReady)}</strong></div><div class="muted">${String(c.planSummary||'')}</div></div>`).join('')}</div><script>let s=30;setInterval(()=>{s--;document.getElementById('rfb').textContent='⏱ refresh in '+s+'s';if(s<=0)location.reload()},1000)</script></body></html>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return true;
    }
    const lastCard = cards.length > 0 ? cards[cards.length - 1] : null;
    const nextCursor = lastCard?.updatedAt || 0;
    sendJson(res, 200, buildStableEnvelope({
      route: 'dashboard',
      resourceKind: 'task_dashboard',
      resource: { kind: 'task_dashboard', count: cards.length },
      query: { limit: rawLimit, cursor },
      api: { access: 'dashboard_token', sensitivity: 'medium' },
      payload: {
        ok: true,
        dashboard: {
          count: cards.length,
          totalCount,
          cards,
          cursor: nextCursor,
          hasMore: rawLimit < 200 && cards.length >= effectiveLimit,
          address: 'http://127.0.0.1:19090/state/team/dashboard',
          viewAddress: 'http://127.0.0.1:19090/state/team/dashboard/view',
        },
        boundary: {
          access: 'dashboard_token',
          sensitivity: 'medium',
          redaction: 'dashboard_card_compact',
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/governance')) {
    const taskId = parseUrlParam(req.url, 'taskId');
    const limit = Number(parseUrlParam(req.url, 'limit') || 20);
    const s = snapshotTask(teamStore, taskId);
    if (!s.task) {
      sendJson(res, 404, { ok: false, error: 'task_not_found' });
      return true;
    }
    sendJson(res, 200, buildStableEnvelope({
      route: 'governance',
      resourceKind: 'task_governance',
      resource: {
        kind: 'task_governance',
        taskId,
        teamId: s.task.teamId,
        batchId: String(s.task.metadata?.batchId || ''),
        state: s.task.state || '',
      },
      query: { taskId, limit },
      payload: {
        ok: true,
        currentMemberKey: s.currentMemberKey,
        protocolSource: s.latestDecision ? 'decision' : s.latestReview ? 'review' : s.plan ? 'plan' : 'task',
        protocol: {
          plan: s.protocol.planner,
          review: s.protocol.critic,
          decision: s.protocol.judge,
        },
        timeline: [
          { type: 'task.created', at: s.task.createdAt || null, taskId: s.task.taskId || '' },
          s.latestReview ? { type: 'review.latest', at: s.latestReview.createdAt || null, reviewId: s.latestReview.reviewId || '' } : null,
          s.latestDecision ? { type: 'decision.latest', at: s.latestDecision.createdAt || null, decisionId: s.latestDecision.decisionId || '' } : null,
        ].filter(Boolean).slice(0, limit),
        counts: {
          mailbox: s.mailbox.length,
          blackboard: s.blackboard.length,
          artifacts: s.artifacts.length,
          evidence: s.evidence.length,
          reviews: s.reviews.length,
          decisions: s.decisions.length,
        },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/ingress')) {
    const limit = Number(parseUrlParam(req.url, 'limit') || 50);
    const originNode = String(parseUrlParam(req.url, 'originNode') || '').trim();
    const deliveryTarget = String(parseUrlParam(req.url, 'deliveryTarget') || '').trim();
    const recipientId = String(parseUrlParam(req.url, 'recipientId') || '').trim();
    const recipientType = String(parseUrlParam(req.url, 'recipientType') || '').trim();
    const ingressKinds = new Set(['team.async_ingress.v1', 'team.visible_ingress.v1']);
    const items = (teamStore.listRecentTasks ? teamStore.listRecentTasks(limit * 8) : [])
      .filter((task) => ingressKinds.has(String(task?.metadata?.ingressKind || '')))
      .filter((task) => !originNode || String(task?.metadata?.originNode || '') === originNode)
      .filter((task) => !deliveryTarget || String(task?.metadata?.deliveryTarget || '') === deliveryTarget)
      .filter((task) => !recipientId || String(task?.metadata?.recipientId || task?.metadata?.deliveryTarget || '') === recipientId)
      .filter((task) => !recipientType || String(task?.metadata?.recipientType || '') === recipientType)
      .slice(0, limit)
      .map((task) => ({
        taskId: String(task?.taskId || ''),
        teamId: String(task?.teamId || ''),
        state: String(task?.state || ''),
        updatedAt: Number(task?.updatedAt || 0),
        createdAt: Number(task?.createdAt || 0),
        taskMode: String(task?.metadata?.taskMode || ''),
        riskLevel: String(task?.metadata?.riskLevel || ''),
        sourceEventId: String(task?.metadata?.sourceEventId || ''),
        ingressKind: String(task?.metadata?.ingressKind || ''),
        originNode: String(task?.metadata?.originNode || ''),
        deliveryTarget: String(task?.metadata?.deliveryTarget || ''),
        recipientId: String(task?.metadata?.recipientId || task?.metadata?.deliveryTarget || ''),
        recipientType: String(task?.metadata?.recipientType || ''),
        deliveryMode: String(task?.metadata?.deliveryMode || ''),
        senderId: String(task?.metadata?.senderId || ''),
        channel: String(task?.metadata?.channel || ''),
        source: String(task?.metadata?.source || ''),
      }));
    sendJson(res, 200, buildStableEnvelope({
      route: 'ingress',
      resourceKind: 'ingress_list',
      resource: { kind: 'ingress_list', count: items.length },
      query: { limit, originNode, deliveryTarget, recipientId, recipientType },
      payload: { ok: true, items },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/archive')) {
    const limit = Number(parseUrlParam(req.url, 'limit') || 50);
    const items = (teamStore.listRecentTasks ? teamStore.listRecentTasks(limit * 3) : [])
      .filter((task) => ['done', 'cancelled', 'blocked'].includes(String(task.state || '')))
      .slice(0, limit);
    sendJson(res, 200, buildStableEnvelope({
      route: 'archive',
      resourceKind: 'task_archive',
      resource: { kind: 'task_archive', count: items.length },
      query: { limit },
      payload: {
        ok: true,
        archive: { count: items.length, items },
      },
    }));
    return true;
  }

  if (req.method === 'GET' && req.url?.startsWith('/state/team/observer')) {
    const node = canonicalNodeId(String(parseUrlParam(req.url, 'node') || OBSERVER_NODE_ID), OBSERVER_NODE_ID);
    const status = teamNodeHealth?.getNodeStatusSync ? teamNodeHealth.getNodeStatusSync() : { ts: Date.now(), [DEFAULT_NODE_ID]: null, [OBSERVER_NODE_ID]: null };
    sendJson(res, 200, buildStableEnvelope({
      route: 'observer',
      resourceKind: 'observer_state',
      resource: { kind: 'observer_state', count: 1, node },
      query: { node },
      payload: {
        ok: true,
        observer: {
          node,
          nodeStatus: status?.[node] || null,
          observedAt: status?.ts || Date.now(),
          deployment: TEAM_ROLE_DEPLOYMENT?.list ? TEAM_ROLE_DEPLOYMENT.list() : null,
        },
      },
    }));
    return true;
  }

  // === 声明式角色配置 API ===

  if (req.method === 'GET' && req.url === '/api/config/roles') {
    const config = loadTeamRolesConfig();
    sendJson(res, 200, {
      ok: true,
      config,
      configStatus: getTeamRolesConfigStatus(),
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/api/config/roles/reload') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    const config = reloadTeamRolesConfig();
    sendJson(res, 200, {
      ok: true,
      reloaded: true,
      roleCount: Object.keys(config.roles).length,
      version: config.version,
      configStatus: getTeamRolesConfigStatus(),
    });
    return true;
  }

  return false;
}

import { createDeliveryContract, deriveDeliveryContractFromPlan, evaluateDeliveryAgainstContract } from './delivery-contracts.mjs';

export const WORKBENCH_STATES = ['draft', 'submitted', 'reviewing', 'approved', 'delivered'];

function nowMs() { return Date.now(); }
function asString(value, fallback = '') { return typeof value === 'string' ? value : (value == null ? fallback : String(value)); }
function toArray(value) { return Array.isArray(value) ? value : []; }

function normalizeArtifactPreview(artifact = {}) {
  const body = artifact?.body && typeof artifact.body === 'object' ? artifact.body : {};
  const metadata = artifact?.metadata && typeof artifact.metadata === 'object' ? artifact.metadata : {};
  return {
    artifactId: asString(artifact?.artifactId),
    artifactType: asString(artifact?.artifactType || metadata?.artifactType || 'document'),
    title: asString(artifact?.title || metadata?.name || 'Untitled artifact'),
    role: asString(artifact?.role),
    status: asString(artifact?.status || 'ready'),
    updatedAt: Number(artifact?.updatedAt || artifact?.createdAt || 0),
    path: asString(body?.path || metadata?.path || metadata?.filePath || ''),
    previewText: asString(body?.text || body?.summary || body?.content || ''),
    language: asString(metadata?.language || body?.language || ''),
    mimeType: asString(metadata?.mimeType || body?.mimeType || ''),
    size: Number(metadata?.size || body?.size || 0),
  };
}

export function createWorkbenchManager({ teamStore, randomUUID = (() => Math.random().toString(36).slice(2)), now = nowMs } = {}) {
  if (!teamStore) throw new Error('teamStore_required');

  function getTaskBundle(taskId) {
    const task = teamStore.getTaskById?.(taskId);
    if (!task) return null;
    return {
      task,
      plan: teamStore.getLatestPlanByTask?.(taskId) || null,
      reviews: toArray(teamStore.listReviewsByTask?.(taskId)),
      decisions: toArray(teamStore.listDecisionsByTask?.(taskId)),
      artifacts: toArray(teamStore.listArtifactsByTask?.({ taskId, limit: 200 })),
      evidence: toArray(teamStore.listEvidenceByTask?.({ taskId, limit: 200 })),
      blackboard: toArray(teamStore.listBlackboardEntries?.({ taskId, limit: 200 })),
      mailbox: toArray(teamStore.listMailboxMessages?.({ teamId: task.teamId, limit: 200 })).filter((entry) => String(entry?.taskId || '') === String(taskId || '')),
    };
  }

  function persistWorkbench(taskId, patch = {}) {
    const task = teamStore.getTaskById?.(taskId);
    if (!task) return null;
    const currentWorkbench = task.metadata?.workbench || {};
    const metadata = {
      ...(task.metadata || {}),
      workbench: {
        ...currentWorkbench,
        ...patch,
        updatedAt: now(),
      },
    };
    return teamStore.updateTaskMetadata?.({ taskId, metadata, updatedAt: now() });
  }

  function updateHistory(taskId, updater) {
    const task = teamStore.getTaskById?.(taskId);
    if (!task) return null;
    const currentWorkbench = task.metadata?.workbench || {};
    const currentSubmission = currentWorkbench.currentSubmission || null;
    const history = toArray(currentWorkbench.history);
    const nextSubmission = typeof updater === 'function' ? updater(currentSubmission, history) : currentSubmission;
    const nextHistory = history.filter((item) => String(item?.submissionId || '') !== String(nextSubmission?.submissionId || ''));
    if (nextSubmission) nextHistory.unshift(nextSubmission);
    persistWorkbench(taskId, {
      ...currentWorkbench,
      currentSubmission: nextSubmission,
      history: nextHistory.slice(0, 20),
    });
    return nextSubmission;
  }

  function ensureContract(taskId, opts = {}) {
    const bundle = getTaskBundle(taskId);
    if (!bundle) return null;
    const existing = bundle.task?.metadata?.workbench?.deliveryContract || null;
    if (existing && !opts.force) return existing;
    const contract = bundle.plan
      ? deriveDeliveryContractFromPlan(bundle.plan, bundle.task)
      : createDeliveryContract({
          taskId,
          title: bundle.task.title,
          summary: bundle.task.description || bundle.task.title,
          expectedDeliverables: bundle.artifacts.slice(0, 3).map((artifact, index) => ({
            id: `artifact:${index + 1}`,
            title: artifact.title,
            artifactType: artifact.artifactType,
            required: true,
            qualityCriteria: [],
            acceptanceCriteria: [],
          })),
        });
    persistWorkbench(taskId, {
      ...(bundle.task.metadata?.workbench || {}),
      deliveryContract: contract,
    });
    return contract;
  }

  function collectArtifacts(taskId, opts = {}) {
    const bundle = getTaskBundle(taskId);
    if (!bundle) return null;
    const executorArtifacts = bundle.artifacts.filter((artifact) => {
      if (String(artifact?.role || '') === 'executor') return true;
      const sourceRole = asString(artifact?.metadata?.sourceRole || artifact?.body?.sourceRole || '');
      return sourceRole === 'executor';
    });
    const task = bundle.task;
    const version = Number(task?.metadata?.workbench?.versionCounter || 0) + 1;
    const submission = {
      submissionId: `delivery:${randomUUID()}`,
      version,
      taskId,
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
      source: asString(opts.source || 'executor_auto_collect'),
      notes: asString(opts.notes || ''),
      artifacts: executorArtifacts.map(normalizeArtifactPreview),
      evidence: bundle.evidence.map((entry) => ({
        evidenceId: asString(entry?.evidenceId),
        evidenceType: asString(entry?.evidenceType),
        title: asString(entry?.title),
        severity: asString(entry?.severity),
        createdAt: Number(entry?.createdAt || 0),
      })),
      review: null,
      approval: null,
      stateTimeline: [{ state: 'draft', at: now(), reason: 'auto_collected' }],
    };
    persistWorkbench(taskId, {
      ...(task.metadata?.workbench || {}),
      state: 'draft',
      versionCounter: version,
      currentSubmission: submission,
      history: [submission, ...toArray(task.metadata?.workbench?.history)].slice(0, 20),
    });
    return submission;
  }

  function submit(taskId, reason = '') {
    return updateHistory(taskId, (currentSubmission) => {
      const submission = currentSubmission || collectArtifacts(taskId);
      if (!submission) return null;
      return {
        ...submission,
        status: 'submitted',
        updatedAt: now(),
        submitReason: asString(reason),
        stateTimeline: [...toArray(submission.stateTimeline), { state: 'submitted', at: now(), reason: asString(reason || 'manual_submit') }],
      };
    });
  }

  function runReviewPipeline(taskId, opts = {}) {
    const bundle = getTaskBundle(taskId);
    if (!bundle) return null;
    const contract = ensureContract(taskId);
    const submission = submit(taskId, opts.reason || 'review_pipeline');
    const evidenceCheck = {
      ok: bundle.evidence.length > 0,
      total: bundle.evidence.length,
      blocking: bundle.evidence.filter((entry) => ['error', 'critical', 'high'].includes(String(entry?.severity || '').toLowerCase())).length,
      missing: bundle.evidence.length === 0 ? ['no_evidence'] : [],
    };
    const artifactCheck = {
      ok: toArray(submission?.artifacts).length > 0,
      total: toArray(submission?.artifacts).length,
      missing: toArray(submission?.artifacts).length === 0 ? ['no_artifacts'] : [],
      invalid: toArray(submission?.artifacts).filter((artifact) => !artifact?.title || !artifact?.artifactId).map((artifact) => asString(artifact?.artifactId || artifact?.title || 'unknown')),
    };
    const contractCheck = evaluateDeliveryAgainstContract(contract, {
      artifacts: bundle.artifacts,
      evidence: bundle.evidence,
      reviews: bundle.reviews,
      decisions: bundle.decisions,
    });
    const review = {
      reviewedAt: now(),
      evidenceCheck,
      artifactCheck,
      contractCheck,
      status: evidenceCheck.ok && artifactCheck.ok && contractCheck.ok ? 'pass' : 'needs_revision',
    };
    const nextState = review.status === 'pass' ? 'reviewing' : 'draft';
    const updated = updateHistory(taskId, (currentSubmission) => ({
      ...(currentSubmission || submission),
      status: nextState,
      updatedAt: now(),
      review,
      stateTimeline: [...toArray((currentSubmission || submission)?.stateTimeline), { state: 'reviewing', at: now(), reason: review.status }],
    }));
    persistWorkbench(taskId, {
      ...(bundle.task.metadata?.workbench || {}),
      state: nextState,
      lastReview: review,
      deliveryContract: contract,
    });
    return review;
  }

  function approve(taskId, input = {}) {
    const review = runReviewPipeline(taskId, { reason: input.reason || 'approval_gate' });
    const approval = {
      action: input.action || 'approve',
      reason: asString(input.reason || ''),
      actor: asString(input.actor || 'human'),
      approvedAt: now(),
      reviewStatus: asString(review?.status || 'unknown'),
    };
    const nextStatus = approval.action === 'approve' && review?.status === 'pass' ? 'approved' : 'draft';
    const updated = updateHistory(taskId, (currentSubmission) => ({
      ...currentSubmission,
      status: nextStatus,
      updatedAt: now(),
      approval,
      stateTimeline: [...toArray(currentSubmission?.stateTimeline), { state: nextStatus, at: now(), reason: asString(input.reason || approval.action) }],
    }));
    persistWorkbench(taskId, {
      ...(teamStore.getTaskById?.(taskId)?.metadata?.workbench || {}),
      state: nextStatus,
      currentSubmission: updated,
      lastApproval: approval,
    });
    return updated;
  }

  function deliver(taskId, reason = '') {
    const approved = approve(taskId, { action: 'approve', reason: reason || 'deliver' });
    if (!approved || approved.status !== 'approved') return approved;
    const delivered = updateHistory(taskId, (currentSubmission) => ({
      ...currentSubmission,
      status: 'delivered',
      deliveredAt: now(),
      updatedAt: now(),
      stateTimeline: [...toArray(currentSubmission?.stateTimeline), { state: 'delivered', at: now(), reason: asString(reason || 'delivered') }],
    }));
    persistWorkbench(taskId, {
      ...(teamStore.getTaskById?.(taskId)?.metadata?.workbench || {}),
      state: 'delivered',
      currentSubmission: delivered,
    });
    return delivered;
  }

  function requestRevision(taskId, reason = '') {
    const updated = updateHistory(taskId, (currentSubmission) => ({
      ...currentSubmission,
      status: 'draft',
      updatedAt: now(),
      approval: {
        action: 'request_revision',
        actor: 'human',
        reason: asString(reason),
        approvedAt: now(),
      },
      stateTimeline: [...toArray(currentSubmission?.stateTimeline), { state: 'draft', at: now(), reason: asString(reason || 'request_revision') }],
    }));
    persistWorkbench(taskId, {
      ...(teamStore.getTaskById?.(taskId)?.metadata?.workbench || {}),
      state: 'draft',
      currentSubmission: updated,
    });
    return updated;
  }

  function getWorkbench(taskId) {
    const bundle = getTaskBundle(taskId);
    if (!bundle) return null;
    const workbench = bundle.task?.metadata?.workbench || {};
    return {
      taskId,
      state: asString(workbench.state || 'draft'),
      deliveryContract: workbench.deliveryContract || ensureContract(taskId),
      currentSubmission: workbench.currentSubmission || null,
      history: toArray(workbench.history),
      lastReview: workbench.lastReview || null,
      lastApproval: workbench.lastApproval || null,
      sourceCounts: {
        artifacts: bundle.artifacts.length,
        evidence: bundle.evidence.length,
        reviews: bundle.reviews.length,
        decisions: bundle.decisions.length,
        mailbox: bundle.mailbox.length,
        blackboard: bundle.blackboard.length,
      },
    };
  }

  return {
    ensureContract,
    collectArtifacts,
    submit,
    runReviewPipeline,
    approve,
    deliver,
    requestRevision,
    getWorkbench,
  };
}

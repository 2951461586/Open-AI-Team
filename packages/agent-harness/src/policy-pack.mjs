import { createPolicyPack } from './core-api.mjs';

export function createOssMinimalPolicyPack({ defaultLeaseMs = 1200, defaultMaxAttempts = 2, normalizeWorkItem } = {}) {
  function addTransportMeta(item = {}, meta = {}) {
    const existingMeta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    return {
      ...item,
      metadata: {
        leaseMs: defaultLeaseMs,
        maxAttempts: defaultMaxAttempts,
        ...existingMeta,
        ...meta,
      },
    };
  }

  return createPolicyPack({
    id: 'policy.oss-minimal.v1',
    version: '1.0.0',
    label: 'review-loop replan + broker seeding policy',
    seedWorkQueue(workQueue = []) {
      return Array.isArray(workQueue) ? workQueue.map((item) => addTransportMeta(item)) : [];
    },
    afterResult({ item, structured = {}, state, eventBus } = {}) {
      if (item?.role !== 'critic' || structured?.needsReplan !== true || state?.replan?.triggered === true) return { injected: false };
      state.replan.triggered = true;
      state.replan.sourceWorkItemId = item.id;
      state.replan.reason = String(structured.replanReason || 'critic requested replan');

      const replanExecutor = addTransportMeta(normalizeWorkItem({
        id: `${item.id}-replan-executor`,
        role: 'executor',
        title: '补 retrieval 证据',
        objective: state.userText,
        task: '基于 blackboard / durable memory 做 retrieval，并补齐样板中的 retrieval-backed evidence。',
        acceptance: '产出 retrieval addendum，并把 retrieval 结果补进 deliverable。',
        deliverables: ['RETRIEVAL-ADDENDUM.md'],
        dependencies: [item.id],
        context: state.replan.reason,
        metadata: {
          replanKind: 'memory_retrieval',
          retrievalQuery: 'provider registry runtime adapter workspace sandbox memory retrieval replan',
        },
      }));
      const replanCritic = addTransportMeta(normalizeWorkItem({
        id: `${item.id}-replan-critic`,
        role: 'critic',
        title: '复审 retrieval 补充结果',
        objective: '确认 retrieval-backed evidence 已补齐。',
        task: '检查 retrieval addendum 与 deliverable 的 Memory Retrieval 章节，并给出最终 review。',
        acceptance: '返回 approve_with_notes。',
        deliverables: ['REVIEW-REPLAN.md'],
        dependencies: [replanExecutor.id],
        metadata: {
          replanKind: 'memory_retrieval',
        },
      }));
      state.replan.addedWorkItemIds.push(replanExecutor.id, replanCritic.id);
      eventBus?.emit?.({
        type: 'replan.injected',
        sourceWorkItemId: item.id,
        addedWorkItemIds: [...state.replan.addedWorkItemIds],
      });

      const judgeIndex = state.workQueue.findIndex((queued) => queued.role === 'judge');
      if (judgeIndex >= 0) {
        const judge = state.workQueue[judgeIndex];
        state.workQueue[judgeIndex] = {
          ...judge,
          dependencies: [replanCritic.id],
        };
        state.workQueue.splice(judgeIndex, 0, replanExecutor, replanCritic);
      } else {
        state.workQueue.push(replanExecutor, replanCritic);
      }
      return { injected: true, addedWorkItemIds: [...state.replan.addedWorkItemIds] };
    },
  });
}

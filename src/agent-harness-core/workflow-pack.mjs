import { createWorkflowPack } from './index.mjs';

export function createOssMinimalWorkflowPack({ defaultLeaseMs = 1200, defaultMaxAttempts = 2, normalizeWorkItem, ensureArray } = {}) {
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

  return createWorkflowPack({
    id: 'workflow.oss-minimal.v1',
    version: '1.0.0',
    label: 'planner-executor-critic-judge with retrieval replan',
    buildPlan({ userText = '' } = {}) {
      const decision = {
        type: 'delegate',
        summary: '这是一个需要完整产出的任务，按 planner → executor → critic → judge 编排，并允许 critic 触发一次 retrieval/replan。',
        taskMode: 'analysis',
        riskLevel: 'medium',
        workItems: [
          {
            id: 'w1',
            role: 'planner',
            title: '生成执行计划',
            objective: userText,
            task: '给出最小开源 harness 样板的规划。',
            acceptance: '明确角色、registry、memory、artifact、report。',
            deliverables: ['PLAN.md'],
            dependencies: [],
          },
          {
            id: 'w2',
            role: 'executor',
            title: '生成最小样板交付',
            objective: userText,
            task: '先输出最小可运行样板的核心交付，但先不要主动补 retrieval 证据。',
            acceptance: '给出 workspace / artifact / report 级结果。',
            deliverables: ['DELIVERABLE.md'],
            dependencies: ['w1'],
          },
          {
            id: 'w3',
            role: 'critic',
            title: '审查最小样板结果',
            objective: '审查 executor 结果是否达到独立最小 harness 标准。',
            task: '基于 planner 与 executor 结果给出 review verdict；如果缺少 retrieval 证据，要明确要求 replan。',
            acceptance: '返回 approve / revise 级别结论。',
            deliverables: ['REVIEW.md'],
            dependencies: ['w2'],
          },
          {
            id: 'w4',
            role: 'judge',
            title: '裁决是否可作为开源样板',
            objective: '给出最终是否可交付的裁决。',
            task: '综合 planner / executor / critic 输出做 final decision。',
            acceptance: '返回 approve / reject。',
            deliverables: ['DECISION.md'],
            dependencies: ['w3'],
          }
        ]
      };

      const workItems = ensureArray(decision.workItems).map((item) => normalizeWorkItem ? normalizeWorkItem(item) : item);
      const seededWorkQueue = workItems.map((item, index) => addTransportMeta(item, index === 0 ? {
        preferredBrokerId: 'broker-1',
        forceBrokerShutdownOnce: true,
      } : index === 1 ? {
        forceRetryOnce: true,
        forceRetrySleepMs: defaultLeaseMs + 100,
      } : {}));

      return { decision, seededWorkQueue };
    },
  });
}

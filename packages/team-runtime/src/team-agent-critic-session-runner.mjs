// P2 thin facade: criticSessionRunner
// Delegates manual critic execution to tlRuntime instead of old pipeline adapters
export function createCriticSessionRunner({ teamStore, tlRuntime, broadcastFn } = {}) {
  let runtimeBroadcastFn = typeof broadcastFn === 'function' ? broadcastFn : null;

  return {
    runCriticTask: async ({ teamId, taskId, criticMemberId, planId } = {}) => {
      if (!tlRuntime?.handleTaskChat) {
        return { ok: false, error: 'tl_runtime_not_available' };
      }
      const task = teamStore?.getTaskById?.(String(taskId || ''));
      const scopeKey = String(task?.metadata?.scopeKey || task?.scopeKey || '');
      const result = await tlRuntime.handleTaskChat({
        taskId: String(taskId || ''),
        text: `请审查任务 ${taskId} 的最新计划 (planId=${planId || 'latest'})。`,
        intent: 'review',
        targetRole: 'critic',
        scopeKey,
        metadata: { criticMemberId, planId, teamId, source: 'manual_critic_run' },
      });
      return {
        ok: true,
        mode: 'tl_delegated',
        taskId: String(taskId || ''),
        reply: result?.reply || '',
        action: result?.action || 'direct',
      };
    },
    setBroadcastFn: (fn) => { runtimeBroadcastFn = typeof fn === 'function' ? fn : null; },
  };
}

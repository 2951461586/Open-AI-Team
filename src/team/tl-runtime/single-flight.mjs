import { findSingleFlightCandidate, getSingleFlightConfig } from '../team-single-flight-guard.mjs';

export function createTLSingleFlightHelpers({
  teamStore,
  governanceRuntime,
  sendToTaskSession,
  appendMailbox,
  broadcast,
  nowFn,
} = {}) {
  function buildSingleFlightSnapshot(task = {}) {
    const meta = task?.metadata && typeof task.metadata === 'object' ? task.metadata : {};
    const sf = meta.singleFlight && typeof meta.singleFlight === 'object' ? meta.singleFlight : {};
    return {
      hitCount: Math.max(0, Number(sf.hitCount || 0)),
      lastHitAt: Number(sf.lastHitAt || 0),
      lastFollowUpText: String(sf.lastFollowUpText || ''),
      lastDecisionSummary: String(sf.lastDecisionSummary || ''),
      lastDecisionType: String(sf.lastDecisionType || ''),
    };
  }

  function resolveSingleFlightReuse({ scopeKey = '', decision } = {}) {
    const config = getSingleFlightConfig(governanceRuntime);
    if (!config.enabled) return null;
    if (!scopeKey) return null;
    if (!decision || decision.type === 'direct') return null;
    return findSingleFlightCandidate({
      teamStore,
      scopeKey,
      nowMs: nowFn(),
      config,
    });
  }

  async function handleSingleFlightReuse({ candidate, decision, text, scopeKey, history = [] } = {}) {
    const existingTask = candidate?.task;
    if (!existingTask?.taskId) return null;

    const config = getSingleFlightConfig(governanceRuntime);
    const eventKinds = Array.isArray(config.followUpEventKinds) ? config.followUpEventKinds : [];
    const hitEventKind = String(eventKinds[0] || 'single_flight.hit');
    const followUpEventKind = String(eventKinds[1] || 'single_flight.follow_up');
    const snapshot = buildSingleFlightSnapshot(existingTask);
    const hitCount = snapshot.hitCount + 1;
    const nowTs = nowFn();
    const detail = `复用任务 ${String(existingTask.title || existingTask.taskId || '').slice(0, 80)}（${String(existingTask.taskId || '').slice(0, 12)}）`;

    broadcast({
      type: 'orchestration_event',
      eventKind: hitEventKind,
      role: 'system',
      lane: 'tl',
      title: 'single-flight 命中',
      content: detail,
      taskId: existingTask.taskId,
      scopeKey,
      timestamp: nowTs,
      status: 'running',
    });

    appendMailbox({
      teamId: existingTask.teamId,
      taskId: existingTask.taskId,
      kind: hitEventKind,
      fromMemberId: 'member:tl',
      payload: {
        scopeKey,
        hitCount,
        reusedTaskId: existingTask.taskId,
        decisionType: String(decision?.type || ''),
        decisionSummary: String(decision?.summary || ''),
        text: String(text || '').slice(0, 1000),
      },
      metadata: {
        source: 'single_flight',
        historyCount: Array.isArray(history) ? history.length : 0,
      },
    });

    const updatedTask = teamStore?.updateTaskMetadata?.({
      taskId: existingTask.taskId,
      metadata: {
        singleFlight: {
          hitCount,
          lastHitAt: nowTs,
          lastFollowUpText: String(text || '').slice(0, 1000),
          lastDecisionSummary: String(decision?.summary || '').slice(0, 300),
          lastDecisionType: String(decision?.type || ''),
        },
      },
      updatedAt: nowTs,
    }) || existingTask;

    const followupResult = await sendToTaskSession({
      taskId: existingTask.taskId,
      text,
      intent: 'followup',
      timeoutSeconds: 90,
    });

    if (!followupResult?.ok) {
      broadcast({
        type: 'orchestration_event',
        eventKind: 'single_flight.miss_recovered',
        role: 'system',
        lane: 'tl',
        title: 'single-flight 复用失败，回退新任务',
        content: String(followupResult?.error || 'followup_failed'),
        taskId: existingTask.taskId,
        scopeKey,
        timestamp: nowFn(),
        status: 'failed',
      });
      return null;
    }

    appendMailbox({
      teamId: existingTask.teamId,
      taskId: existingTask.taskId,
      kind: followUpEventKind,
      fromMemberId: 'member:tl',
      payload: {
        scopeKey,
        hitCount,
        routedTo: String(followupResult?.routedTo || 'tl_direct'),
        targetRole: String(followupResult?.targetRole || ''),
        assignmentId: String(followupResult?.assignmentId || ''),
        childTaskId: String(followupResult?.childTaskId || ''),
        replyPreview: String(followupResult?.reply || '').slice(0, 500),
      },
      metadata: {
        source: 'single_flight',
      },
    });

    return {
      ok: true,
      action: 'tl_single_flight_reuse',
      reply: String(followupResult?.reply || '').trim() || `已复用进行中的任务：${existingTask.title || existingTask.taskId}`,
      task: teamStore?.getTaskById?.(existingTask.taskId) || updatedTask,
      team: teamStore?.getTeamById?.(existingTask.teamId) || candidate?.team || {},
      decision,
      taskId: existingTask.taskId,
      teamId: existingTask.teamId,
      childTasks: [],
      memberResults: [],
      singleFlight: {
        hit: true,
        hitCount,
        reusedTaskId: existingTask.taskId,
        teamId: existingTask.teamId,
      },
    };
  }

  return {
    buildSingleFlightSnapshot,
    resolveSingleFlightReuse,
    handleSingleFlightReuse,
  };
}

export function tryHandleTeamControlRoute(req, res, ctx = {}) {
  const {
    isOrchAuthorized,
    isDashboardAuthorized,
    sendJson,
    handleJsonBody,
    now,
    randomUUID,
    teamStore,
    criticSessionRunner,
  } = ctx;

  // PUBLIC (allowlisted) control endpoint for Dashboard.
  // Boundary: NO x-orch-token; only allow a small action allowlist.
  // This endpoint is safe to call from the static dashboard.
  if (req.method === 'POST' && req.url === '/api/dashboard/control') {
    if (!isDashboardAuthorized?.(req)) {
      sendJson(res, 401, { ok: false, error: 'dashboard_unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      const action = String(body?.action || '').trim();
      const taskId = String(body?.taskId || '').trim();

      // Action allowlist: map Dashboard verbs -> internal control actions.
      // Also keep backward-compat with the UI action names.
      const mapped = action === 'mark_done' ? 'manual_done'
        : action === 'request_replan' ? 'reset_to_planning'
          : action === 'request_re_review' ? 'rerun_review'
            : action === 'request_re_judge' ? 'rerun_judge'
              : action === 'block' ? 'manual_block'
                : action === 'cancel' ? 'manual_cancel'
                  : action;

      const allowed = new Set([
        'manual_done',
        'manual_block',
        'manual_cancel',
        'reset_to_planning',
        'rerun_review',
        'rerun_judge',
      ]);

      if (!allowed.has(mapped)) {
        return { ok: false, error: 'unsupported_action', action };
      }

      const task = teamStore.getTaskById(taskId);
      if (!task) return { ok: false, error: 'task_not_found' };
      const members = teamStore.listMembersByTeam(String(task.teamId || '')) || [];
      let taskOut = task;
      let mailbox = null;
      let manualDecision = null;

      const effectiveAction = mapped;

      if (effectiveAction === 'rerun_review') {
        taskOut = teamStore.updateTaskState({ taskId, state: 'plan_review', updatedAt: now() });
        const critic = members.find((m) => String(m.role || '') === 'critic');
        mailbox = teamStore.appendMailboxMessage({
          messageId: `msg:${randomUUID()}`,
          teamId: String(task.teamId || ''),
          taskId,
          kind: 'review.request',
          fromMemberId: 'human-control',
          toMemberId: String(critic?.memberId || ''),
          broadcast: !critic,
          payload: { reason: 'manual_rerun_review' },
          status: 'delivered',
          createdAt: now(),
          deliveredAt: now(),
        });
        // 触发 critic session runner
        if (criticSessionRunner?.runCriticTask && critic) {
          const latestPlan = teamStore.getLatestPlanByTask ? teamStore.getLatestPlanByTask(taskId) : null;
          void criticSessionRunner.runCriticTask({
            teamId: String(task.teamId || ''),
            taskId,
            criticMemberId: String(critic.memberId || ''),
            planId: String(latestPlan?.planId || ''),
          }).catch(() => {});
        }
      } else if (effectiveAction === 'rerun_judge') {
        taskOut = teamStore.updateTaskState({ taskId, state: 'approved', updatedAt: now() });
        const judge = members.find((m) => String(m.role || '') === 'judge');
        mailbox = teamStore.appendMailboxMessage({
          messageId: `msg:${randomUUID()}`,
          teamId: String(task.teamId || ''),
          taskId,
          kind: 'decision.request',
          fromMemberId: 'human-control',
          toMemberId: String(judge?.memberId || ''),
          broadcast: !judge,
          payload: { reason: 'manual_rerun_judge' },
          status: 'delivered',
          createdAt: now(),
          deliveredAt: now(),
        });
      } else if (effectiveAction === 'reset_to_planning') {
        taskOut = teamStore.updateTaskState({ taskId, state: 'planning', updatedAt: now() });
      } else if (effectiveAction === 'manual_done' || effectiveAction === 'manual_block' || effectiveAction === 'manual_cancel') {
        const nextState = effectiveAction === 'manual_done' ? 'done' : effectiveAction === 'manual_block' ? 'blocked' : 'cancelled';
        const decisionType = effectiveAction === 'manual_done' ? 'approve' : effectiveAction === 'manual_block' ? 'escalate_human' : 'cancel';
        taskOut = teamStore.updateTaskState({ taskId, state: nextState, updatedAt: now() });
        manualDecision = teamStore.insertDecision({
          decisionId: `decision:${randomUUID()}`,
          taskId,
          judgeMemberId: 'human',
          decisionType,
          reason: String(body?.reason || effectiveAction),
          payload: { nextState },
          createdAt: now(),
        });
        try {
          teamStore.insertArtifact?.({
            artifactId: `artifact:${randomUUID()}`,
            taskId,
            teamId: String(task.teamId || ''),
            artifactType: 'manual_control',
            role: 'human',
            refId: String(manualDecision.decisionId || ''),
            title: `manual:${effectiveAction}`,
            body: { action: effectiveAction, reason: String(body?.reason || effectiveAction) },
            status: 'ready',
            createdAt: now(),
            updatedAt: now(),
          });
        } catch {}
      } else {
        return { ok: false, error: 'unsupported_action', action: effectiveAction };
      }

      return { ok: true, action: effectiveAction, task: taskOut, mailbox, manualDecision };
    });
    return true;
  }

  // Internal control plane - keeps full power (including rerun_judge).
  // Protected by x-orch-token auth.
  if (req.method === 'POST' && req.url === '/internal/team/control') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      const action = String(body?.action || '').trim();
      const taskId = String(body?.taskId || '').trim();
      const task = teamStore.getTaskById(taskId);
      if (!task) return { ok: false, error: 'task_not_found' };
      const members = teamStore.listMembersByTeam(String(task.teamId || '')) || [];

      // Internal control supports all actions including rerun_judge.
      const allowed = new Set([
        'manual_done', 'manual_block', 'manual_cancel',
        'reset_to_planning', 'rerun_review', 'rerun_judge',
      ]);

      if (!allowed.has(action)) {
        return { ok: false, error: 'unsupported_action', action };
      }

      let taskOut = task;
      let mailbox = null;
      let manualDecision = null;

      if (action === 'rerun_review') {
        taskOut = teamStore.updateTaskState({ taskId, state: 'plan_review', updatedAt: now() });
        const critic = members.find((m) => String(m.role || '') === 'critic');
        mailbox = teamStore.appendMailboxMessage({
          messageId: `msg:${randomUUID()}`,
          teamId: String(task.teamId || ''),
          taskId,
          kind: 'review.request',
          fromMemberId: 'human-control',
          toMemberId: String(critic?.memberId || ''),
          broadcast: !critic,
          payload: { reason: 'manual_rerun_review' },
          status: 'delivered',
          createdAt: now(),
          deliveredAt: now(),
        });
      } else if (action === 'rerun_judge') {
        taskOut = teamStore.updateTaskState({ taskId, state: 'approved', updatedAt: now() });
      } else if (action === 'reset_to_planning') {
        taskOut = teamStore.updateTaskState({ taskId, state: 'planning', updatedAt: now() });
      } else if (action === 'manual_done' || action === 'manual_block' || action === 'manual_cancel') {
        const nextState = action === 'manual_done' ? 'done' : action === 'manual_block' ? 'blocked' : 'cancelled';
        const decisionType = action === 'manual_done' ? 'approve' : action === 'manual_block' ? 'escalate_human' : 'cancel';
        taskOut = teamStore.updateTaskState({ taskId, state: nextState, updatedAt: now() });
        manualDecision = teamStore.insertDecision({
          decisionId: `decision:${randomUUID()}`,
          taskId,
          judgeMemberId: 'human',
          decisionType,
          reason: String(body?.reason || action),
          payload: { nextState },
          createdAt: now(),
        });
      }

      return { ok: true, action, task: taskOut, mailbox, manualDecision };
    });
    return true;
  }

  return false;
}

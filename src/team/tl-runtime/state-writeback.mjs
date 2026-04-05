export function createTLStateWritebackHelpers({ teamStore, nowFn, id, ensureArray } = {}) {
  function appendMailbox({ teamId, taskId, childTaskId = '', kind, fromMemberId = 'member:tl', payload = {}, metadata = {} } = {}) {
    return teamStore?.appendMailboxMessage?.({
      messageId: id('msg'),
      teamId,
      taskId,
      threadId: childTaskId || taskId,
      kind,
      fromMemberId,
      toMemberId: '',
      payload,
      metadata,
      createdAt: nowFn(),
    });
  }

  function appendBlackboard({ teamId, taskId, section = 'tl_runtime', entryKey, value, metadata = {} } = {}) {
    return teamStore?.upsertBlackboardEntry?.({
      entryId: id('bb'),
      teamId,
      taskId,
      section,
      entryKey,
      value,
      metadata,
      createdAt: nowFn(),
      updatedAt: nowFn(),
      version: 1,
    });
  }

  function readTaskSessions(task) {
    const meta = task?.metadata || {};
    return {
      sessionsByRole: meta.sessionsByRole || {},
      sessionsByAssignment: meta.sessionsByAssignment || {},
      primarySessionKey: meta.primarySessionKey || '',
      tlSessionKey: meta.tlSessionKey || '',
      followupRoute: meta.followupRoute || 'tl',
      childTaskIds: ensureArray(meta.childTaskIds),
      workItemToChildTask: meta.workItemToChildTask || {},
    };
  }

  function updateTaskFollowupState({ taskId, routedTo = '', targetRole = '', assignmentId = '', childTaskId = '', fallbackReason = '', intent = '' } = {}) {
    const task = teamStore?.getTaskById?.(String(taskId || ''));
    if (!task) return null;
    return teamStore.updateTaskMetadata?.({
      taskId,
      metadata: {
        followupRoute: String(routedTo || task?.metadata?.followupRoute || 'tl'),
        lastFollowupAt: nowFn(),
        lastFollowupIntent: String(intent || ''),
        lastFollowupTargetRole: String(targetRole || ''),
        lastFollowupAssignmentId: String(assignmentId || ''),
        lastFollowupChildTaskId: String(childTaskId || ''),
        lastFollowupFallbackReason: String(fallbackReason || ''),
      },
    });
  }

  function writeSessionToTask({ taskId, role, assignmentId, sessionKey, runId, spawnedAt, childTaskId, requestedNode = '', actualNode = '', degradedReason = '', sessionMode = 'run', sessionPersistent = false, sessionFallbackReason = '' } = {}) {
    const task = teamStore?.getTaskById?.(String(taskId || ''));
    if (!task) return null;

    const sessions = readTaskSessions(task);

    sessions.sessionsByRole[role] = {
      role,
      sessionKey,
      runId: runId || '',
      assignmentId: assignmentId || '',
      childTaskId: childTaskId || '',
      requestedNode: requestedNode || '',
      actualNode: actualNode || '',
      sessionMode: sessionMode || 'run',
      sessionPersistent: !!sessionPersistent,
      sessionFallbackReason: sessionFallbackReason || '',
      spawnedAt: spawnedAt || nowFn(),
    };

    if (assignmentId) {
      sessions.sessionsByAssignment[assignmentId] = {
        sessionKey,
        runId: runId || '',
        role,
        childTaskId: childTaskId || '',
        requestedNode: requestedNode || '',
        actualNode: actualNode || '',
        sessionMode: sessionMode || 'run',
        sessionPersistent: !!sessionPersistent,
        sessionFallbackReason: sessionFallbackReason || '',
        spawnedAt: spawnedAt || nowFn(),
      };
    }

    if (!sessions.primarySessionKey) sessions.primarySessionKey = sessionKey;

    return teamStore.updateTaskMetadata?.({
      taskId,
      metadata: {
        sessionsByRole: sessions.sessionsByRole,
        sessionsByAssignment: sessions.sessionsByAssignment,
        primarySessionKey: sessions.primarySessionKey,
        tlSessionKey: sessions.tlSessionKey,
        followupRoute: sessions.followupRoute,
        sessionKey: sessions.primarySessionKey,
        requestedNode: requestedNode || task?.metadata?.requestedNode || '',
        actualNode: actualNode || task?.metadata?.actualNode || '',
        degradedReason: degradedReason || task?.metadata?.degradedReason || '',
        sessionMode: sessionMode || task?.metadata?.sessionMode || 'run',
        sessionPersistent: sessionPersistent || task?.metadata?.sessionPersistent || false,
        sessionFallbackReason: sessionFallbackReason || task?.metadata?.sessionFallbackReason || '',
      },
    });
  }

  return {
    appendMailbox,
    appendBlackboard,
    readTaskSessions,
    updateTaskFollowupState,
    writeSessionToTask,
  };
}

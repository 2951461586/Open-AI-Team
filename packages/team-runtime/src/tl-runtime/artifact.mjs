export function createTLArtifactHelpers({ teamStore, nowFn, id } = {}) {
  function appendArtifactForMemberResult({ teamId, taskId, childTaskId, role, assignmentId, title, body, metadata = {}, artifactType = 'member_result' } = {}) {
    return teamStore?.insertArtifact?.({
      artifactId: id('artifact'),
      taskId,
      teamId,
      artifactType,
      role,
      refId: assignmentId || childTaskId || id('ref'),
      title,
      body,
      status: 'done',
      metadata: { assignmentId, childTaskId, ...metadata },
      createdAt: nowFn(),
      updatedAt: nowFn(),
    });
  }

  function appendEvidence({ teamId, taskId, childTaskId = '', assignmentId = '', evidenceType = '', sourceType = '', sourceId = '', title = '', detail = {}, severity = 'info' } = {}) {
    return teamStore?.insertEvidence?.({
      evidenceId: id('evidence'),
      taskId,
      teamId,
      evidenceType,
      sourceType,
      sourceId: sourceId || assignmentId || childTaskId || taskId || id('source'),
      title,
      detail: {
        assignmentId,
        childTaskId,
        ...detail,
      },
      severity,
      createdAt: nowFn(),
    });
  }

  return { appendArtifactForMemberResult, appendEvidence };
}

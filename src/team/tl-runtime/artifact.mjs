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

  return { appendArtifactForMemberResult };
}

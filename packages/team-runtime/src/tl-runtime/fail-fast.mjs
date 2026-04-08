export function createTLFailFastHelpers({
  teamStore,
  appendMailbox,
  appendArtifactForMemberResult,
  broadcast,
  nowFn,
  ensureArray,
  ensureString,
} = {}) {
  function formatDagValidationErrors(validation = {}, { title = 'DAG 依赖异常' } = {}) {
    const errors = ensureArray(validation?.errors);
    const lines = [`## ${title}`];
    if (errors.length === 0) {
      lines.push('- invalid_dag');
      return lines.join('\n');
    }
    for (const err of errors.slice(0, 12)) {
      const code = ensureString(err.code || 'invalid_dag');
      const stepId = ensureString(err.stepId || `#${Number(err.index ?? -1) + 1}` || '-');
      const dep = ensureString(err.dependency || '');
      const unresolved = ensureArray(err.unresolvedDependencies).join('，');
      const detail = dep || unresolved || ensureString(err.message || '');
      lines.push(`- **${code}** ｜ step=${stepId}${detail ? ` ｜ ${detail}` : ''}`);
    }
    if (errors.length > 12) lines.push(`- （其余 ${errors.length - 12} 条已省略）`);
    return lines.join('\n');
  }

  function formatCapabilityContractErrors(validation = {}, { title = '角色能力合同异常（fail fast）' } = {}) {
    const errors = ensureArray(validation?.errors);
    const lines = [`## ${title}`];
    if (errors.length === 0) {
      lines.push('- role_capability_contract_invalid');
      return lines.join('\n');
    }
    for (const err of errors.slice(0, 12)) {
      const code = ensureString(err.code || 'role_capability_contract_invalid');
      const role = ensureString(err.role || '-');
      const detail = ensureString(err.message || '');
      const titleText = ensureString(err.title || '');
      lines.push(`- **${code}** ｜ role=${role}${titleText ? ` ｜ ${titleText}` : ''}${detail ? ` ｜ ${detail}` : ''}`);
    }
    if (errors.length > 12) lines.push(`- （其余 ${errors.length - 12} 条已省略）`);
    return lines.join('\n');
  }

  function formatExecutionSurfaceContractErrors(validation = {}, { title = 'Skill / Tool / MCP 执行面合同异常（fail fast）' } = {}) {
    const errors = ensureArray(validation?.errors);
    const lines = [`## ${title}`];
    if (errors.length === 0) {
      lines.push('- role_execution_surface_contract_invalid');
      return lines.join('\n');
    }
    for (const err of errors.slice(0, 12)) {
      const code = ensureString(err.code || 'role_execution_surface_contract_invalid');
      const role = ensureString(err.role || '-');
      const detail = ensureString(err.message || '');
      const titleText = ensureString(err.title || '');
      lines.push(`- **${code}** ｜ role=${role}${titleText ? ` ｜ ${titleText}` : ''}${detail ? ` ｜ ${detail}` : ''}`);
    }
    if (errors.length > 12) lines.push(`- （其余 ${errors.length - 12} 条已省略）`);
    return lines.join('\n');
  }

  function failFastTaskOnExecutionSurfaceContract({ teamId, taskId, parentTask, decision, scopeKey, validation, phase = 'plan' } = {}) {
    const title = phase === 'dynamic_replan' ? '动态追加 Skill / Tool / MCP 执行面合同异常（fail fast）' : '规划 Skill / Tool / MCP 执行面合同异常（fail fast）';
    const summary = formatExecutionSurfaceContractErrors(validation, { title });
    const errorCode = phase === 'dynamic_replan' ? 'dynamic_role_execution_surface_contract_invalid' : 'role_execution_surface_contract_invalid';
    const nowTs = nowFn();

    teamStore?.updateTaskState?.({ taskId, state: 'blocked', updatedAt: nowTs });
    teamStore?.updateTeamStatus?.({ teamId, status: 'needs_attention', updatedAt: nowTs });

    appendMailbox({
      teamId,
      taskId,
      kind: 'tl.execution_surface_invalid',
      fromMemberId: 'member:tl',
      payload: {
        phase,
        error: errorCode,
        errors: ensureArray(validation?.errors).slice(0, 20),
      },
    });

    appendArtifactForMemberResult({
      teamId,
      taskId,
      childTaskId: '',
      role: 'tl',
      assignmentId: '',
      title,
      body: { markdown: summary, errors: ensureArray(validation?.errors) },
      metadata: { phase, error: errorCode, errorCount: ensureArray(validation?.errors).length },
      artifactType: 'tl_summary',
    });

    broadcast({
      type: 'orchestration_event',
      eventKind: 'execution.execution_surface_invalid',
      role: 'system',
      lane: 'tl',
      title,
      content: ensureArray(validation?.errors).slice(0, 3).map((err) => err.message || err.code || 'role_execution_surface_contract_invalid').join('；'),
      taskId,
      scopeKey,
      timestamp: nowTs,
      status: 'failed',
    });

    return {
      ok: true,
      action: 'tl_delegate',
      reply: `TL_FINAL_SUMMARY\n\n${summary}`,
      task: teamStore?.getTaskById?.(taskId) || parentTask || null,
      decision,
      taskId,
      teamId,
      childTasks: [],
      memberResults: [],
      escalation: { escalate: false },
      partialSuccess: false,
      successCount: 0,
      failCount: 0,
      error: errorCode,
      executionSurfaceValidation: validation,
    };
  }

  function failFastTaskOnCapabilityContract({ teamId, taskId, parentTask, decision, scopeKey, validation, phase = 'plan' } = {}) {
    const title = phase === 'dynamic_replan' ? '动态追加角色能力合同异常（fail fast）' : '规划角色能力合同异常（fail fast）';
    const summary = formatCapabilityContractErrors(validation, { title });
    const errorCode = phase === 'dynamic_replan' ? 'dynamic_role_capability_contract_invalid' : 'role_capability_contract_invalid';
    const nowTs = nowFn();

    teamStore?.updateTaskState?.({ taskId, state: 'blocked', updatedAt: nowTs });
    teamStore?.updateTeamStatus?.({ teamId, status: 'needs_attention', updatedAt: nowTs });

    appendMailbox({
      teamId,
      taskId,
      kind: 'tl.capability_contract_invalid',
      fromMemberId: 'member:tl',
      payload: {
        phase,
        error: errorCode,
        errors: ensureArray(validation?.errors).slice(0, 20),
      },
    });

    appendArtifactForMemberResult({
      teamId,
      taskId,
      childTaskId: '',
      role: 'tl',
      assignmentId: '',
      title,
      body: { markdown: summary, errors: ensureArray(validation?.errors) },
      metadata: { phase, error: errorCode, errorCount: ensureArray(validation?.errors).length },
      artifactType: 'tl_summary',
    });

    broadcast({
      type: 'orchestration_event',
      eventKind: 'execution.capability_contract_invalid',
      role: 'system',
      lane: 'tl',
      title,
      content: ensureArray(validation?.errors).slice(0, 3).map((err) => err.message || err.code || 'role_capability_contract_invalid').join('；'),
      taskId,
      scopeKey,
      timestamp: nowTs,
      status: 'failed',
    });

    return {
      ok: true,
      action: 'tl_delegate',
      reply: `TL_FINAL_SUMMARY\n\n${summary}`,
      task: teamStore?.getTaskById?.(taskId) || parentTask || null,
      decision,
      taskId,
      teamId,
      childTasks: [],
      memberResults: [],
      escalation: { escalate: false },
      partialSuccess: false,
      successCount: 0,
      failCount: 0,
      error: errorCode,
      capabilityValidation: validation,
    };
  }

  function failFastTaskOnInvalidDag({ teamId, taskId, parentTask, decision, scopeKey, validation, phase = 'plan' } = {}) {
    const title = phase === 'dynamic_replan' ? '动态追加 DAG 依赖异常（fail fast）' : '规划 DAG 依赖异常（fail fast）';
    const summary = formatDagValidationErrors(validation, { title });
    const errorCode = phase === 'dynamic_replan' ? 'dynamic_invalid_dag' : 'invalid_dag';
    const nowTs = nowFn();

    teamStore?.updateTaskState?.({ taskId, state: 'blocked', updatedAt: nowTs });
    teamStore?.updateTeamStatus?.({ teamId, status: 'needs_attention', updatedAt: nowTs });

    appendMailbox({
      teamId,
      taskId,
      kind: 'tl.dag_invalid',
      fromMemberId: 'member:tl',
      payload: {
        phase,
        error: errorCode,
        errors: ensureArray(validation?.errors).slice(0, 20),
      },
    });

    appendArtifactForMemberResult({
      teamId,
      taskId,
      childTaskId: '',
      role: 'tl',
      assignmentId: '',
      title,
      body: { markdown: summary, errors: ensureArray(validation?.errors) },
      metadata: { phase, error: errorCode, errorCount: ensureArray(validation?.errors).length },
      artifactType: 'tl_summary',
    });

    broadcast({
      type: 'orchestration_event',
      eventKind: 'execution.dag_invalid',
      role: 'system',
      lane: 'tl',
      title,
      content: ensureArray(validation?.errors).slice(0, 3).map((err) => err.message || err.code || 'invalid_dag').join('；'),
      taskId,
      scopeKey,
      timestamp: nowTs,
      status: 'failed',
    });

    return {
      ok: true,
      action: 'tl_delegate',
      reply: `TL_FINAL_SUMMARY\n\n${summary}`,
      task: teamStore?.getTaskById?.(taskId) || parentTask || null,
      decision,
      taskId,
      teamId,
      childTasks: [],
      memberResults: [],
      escalation: { escalate: false },
      partialSuccess: false,
      successCount: 0,
      failCount: 0,
      error: errorCode,
      dagValidation: validation,
    };
  }

  return {
    formatDagValidationErrors,
    formatCapabilityContractErrors,
    formatExecutionSurfaceContractErrors,
    failFastTaskOnExecutionSurfaceContract,
    failFastTaskOnCapabilityContract,
    failFastTaskOnInvalidDag,
  };
}

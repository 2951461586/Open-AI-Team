export function createTLFollowupHelpers({
  teamStore,
  nativeChat,
  runtimeExecutionHarness,
  readTaskSessions,
  updateTaskFollowupState,
  appendMailbox,
  appendBlackboard,
  appendArtifactForMemberResult,
  broadcast,
  nowFn,
  id,
  ensureArray,
  ensureString,
  parseJsonLoose,
  normalizeWorkItem,
  isPersistentSessionBinding,
  shouldFallbackMemberFollowup,
} = {}) {
  async function unifiedSendToSession(args = {}) {
    try {
      return await runtimeExecutionHarness.sendToSession(args);
    } catch (err) {
      console.warn('[tl-runtime] runtimeExecutionHarness send error:', err?.message || err);
      return { ok: false, error: String(err?.message || err || 'send_not_available') };
    }
  }

  async function handleTLFollowup({ task, text, intent = 'followup', targetRole = '', assignmentId = '', childTaskId = '', timeoutSeconds = 60, fallbackReason = '' } = {}) {
    const sessions = readTaskSessions(task);
    const childArtifacts = teamStore?.listArtifactsByTask?.({ taskId: task.taskId, limit: 30 }) || [];
    const memberList = Object.entries(sessions.sessionsByRole)
      .map(([role, info]) => `- ${role}: session=${String(info.sessionKey || '').slice(0, 12)}… assignmentId=${String(info.assignmentId || '-')} childTaskId=${String(info.childTaskId || '-')}`)
      .join('\n');

    let childTask = null;
    if (childTaskId) childTask = teamStore?.getTaskById?.(childTaskId) || null;
    if (!childTask && assignmentId) {
      const mappedChildTaskId = String(sessions.workItemToChildTask?.[assignmentId] || '').trim();
      if (mappedChildTaskId) childTask = teamStore?.getTaskById?.(mappedChildTaskId) || null;
    }

    const relatedArtifacts = childTaskId
      ? childArtifacts.filter((a) => String(a?.metadata?.childTaskId || '') === String(childTaskId || ''))
      : assignmentId
        ? childArtifacts.filter((a) => String(a?.metadata?.assignmentId || '') === String(assignmentId || ''))
        : [];

    const taskContext = `## 当前任务上下文
- 任务ID: ${task.taskId}
- 标题: ${task.title}
- 状态: ${task.state}
- 描述: ${String(task.description || '').slice(0, 300)}

## 显式跟进合同
- intent: ${intent || 'followup'}
- targetRole: ${targetRole || '-'}
- assignmentId: ${assignmentId || '-'}
- childTaskId: ${childTaskId || '-'}
- fallbackReason: ${fallbackReason || '-'}

## 目标 child task
- 标题: ${childTask?.title || '-'}
- 状态: ${childTask?.state || '-'}
- 描述: ${String(childTask?.description || '').slice(0, 300) || '-'}

## 已绑定成员会话
${memberList || '（无）'}

## 相关产物摘要
${relatedArtifacts.slice(0, 8).map((a) => `- ${a.role}: ${a.title}`).join('\n') || childArtifacts.slice(0, 8).map((a) => `- ${a.role}: ${a.title}`).join('\n') || '（无）'}`;

    const intentGuide = intent === 'retry'
      ? '用户要求 selective retry。优先只重开该 child task / assignment，对其他已完成 workItems 保持不变。若需要成员继续执行，可 forward 给对应成员；若需要 TL 重新判断，也可直接回复。'
      : intent === 'replan'
        ? `用户要求局部 replan。优先围绕该 child task 给出新的局部计划，尽量不要重做其他已完成 workItems。
如果你决定给出局部 replan，请优先输出 JSON：
\`\`\`json
{
  "action": "replan",
  "summary": "一句话说明这次局部 replan 的核心变化",
  "reason": "为什么要这样调整",
  "workItems": [
    {
      "id": "w1",
      "role": "executor",
      "title": "新的局部任务",
      "objective": "目标",
      "task": "执行指令",
      "acceptance": "验收标准",
      "deliverables": ["产物"],
      "dependencies": []
    }
  ]
}
\`\`\``
        : '用户是在做 follow-up。若能直接回答就直接回答；若需要继续执行，可转发给合适成员。';

    const followupPrompt = `你是 TL，用户在一个已有任务上追问。根据上下文决定：

1. 如果你能直接回答 → 直接回答
2. 如果需要某个成员执行 → 输出 JSON：
\`\`\`json
{ "action": "forward", "target": "executor", "message": "转发给成员的指令" }
\`\`\`

${intentGuide}

${taskContext}

用户追问：${text}`;

    const reply = await nativeChat?.generateReply?.({ text: followupPrompt, mode: 'chat', history: [] });
    const replyText = reply?.reply || '';

    const renderTLDirectFallbackReply = async (blockedReason = '') => {
      const directPrompt = `你是 TL。原本计划转发给成员处理，但成员会话当前不可直接续聊（${blockedReason || 'member_unavailable'}）。
请直接基于已有任务上下文回答用户这次追问。
不要输出 JSON forward / replan 协议；直接输出给用户的自然语言答复。
如果必须继续执行才能得出结论，也要明确说出当前结论、缺口与下一步建议。

${taskContext}

用户追问：${text}`;
      const directReply = await nativeChat?.generateReply?.({ text: directPrompt, mode: 'chat', history: [] });
      return String(directReply?.reply || '').trim() || '当前成员会话不可直接续聊，TL 已接管这次 follow-up。';
    };

    try {
      const parsed = parseJsonLoose(replyText);
      if (intent === 'replan' && (parsed?.action === 'replan' || (Array.isArray(parsed?.workItems) && parsed.workItems.length > 0))) {
        const plannedItems = ensureArray(parsed?.workItems).map((item, index) => normalizeWorkItem(item, index));
        const replanSummary = ensureString(parsed?.summary || replyText || '已生成局部 replan').trim();
        const replanReason = ensureString(parsed?.reason || parsed?.rationale || '').trim();
        const replanTitles = plannedItems.map((item) => item.title).filter(Boolean);
        const beforeRawWorkItem = childTask?.metadata?.rawWorkItem || {
          id: childTask?.metadata?.workItemId || assignmentId || '',
          role: childTask?.metadata?.workItemRole || targetRole || '',
          title: childTask?.title || '',
          objective: childTask?.title || '',
          task: childTask?.description || '',
          acceptance: childTask?.metadata?.acceptance || '',
          deliverables: childTask?.metadata?.deliverables || [],
          dependencies: childTask?.metadata?.dependencies || [],
        };
        const beforeWorkItem = normalizeWorkItem(beforeRawWorkItem, 0);
        const retainedItems = plannedItems.filter((item) => {
          if (beforeWorkItem?.id && item.id === beforeWorkItem.id) return true;
          if (beforeWorkItem?.title && item.title === beforeWorkItem.title) return true;
          return false;
        });
        const retainedIds = new Set(retainedItems.map((item) => `${item.id}::${item.title}`));
        const addedItems = plannedItems.filter((item) => !retainedIds.has(`${item.id}::${item.title}`));
        const replanDiff = {
          beforeTitle: beforeWorkItem?.title || '',
          beforeRole: beforeWorkItem?.role || '',
          retainedCount: retainedItems.length,
          addedCount: addedItems.length,
          replaced: !!(beforeWorkItem?.title || beforeWorkItem?.id) && retainedItems.length === 0 && plannedItems.length > 0,
          retainedTitles: retainedItems.map((item) => item.title).filter(Boolean),
          addedTitles: addedItems.map((item) => item.title).filter(Boolean),
        };
        const replanPayload = {
          summary: replanSummary,
          reason: replanReason,
          assignmentId: assignmentId || '',
          childTaskId: childTaskId || '',
          targetRole: targetRole || '',
          workItemCount: plannedItems.length,
          titles: replanTitles,
          roles: plannedItems.map((item) => item.role).filter(Boolean),
          beforeTitle: replanDiff.beforeTitle,
          beforeRole: replanDiff.beforeRole,
          retainedCount: replanDiff.retainedCount,
          addedCount: replanDiff.addedCount,
          replaced: replanDiff.replaced,
          retainedTitles: replanDiff.retainedTitles,
          addedTitles: replanDiff.addedTitles,
        };
        const replanMarkdown = [
          '## 局部 replan 结果',
          `- **目标 child task**：${childTaskId || '-'}`,
          `- **assignmentId**：${assignmentId || '-'}`,
          `- **目标角色**：${targetRole || '-'}`,
          `- **摘要**：${replanSummary}`,
          replanReason ? `- **原因**：${replanReason}` : '',
          '',
          '### 变化概览',
          beforeWorkItem?.title ? `- **原始 workItem**：${beforeWorkItem.title}（${beforeWorkItem.role || '-'}｜${beforeWorkItem.id || '-'}）` : '- **原始 workItem**：-',
          `- **保留项**：${replanDiff.retainedCount}`,
          `- **新增项**：${replanDiff.addedCount}`,
          `- **是否替换原执行单元**：${replanDiff.replaced ? '是' : '否'}`,
          '',
          '### 新的局部 workItems',
          ...(plannedItems.length > 0
            ? plannedItems.map((item, index) => `- **${index + 1}. ${item.title}**（${item.role}｜${item.id}）\n  - objective：${item.objective || '-'}\n  - acceptance：${item.acceptance || '-'}\n  - deliverables：${ensureArray(item.deliverables).join('，') || '-'}\n  - dependencies：${ensureArray(item.dependencies).join('，') || '-'}`)
            : ['- TL 已给出方向，但未结构化列出新的 workItems。']),
        ].filter(Boolean).join('\n');

        appendMailbox({
          teamId: task.teamId,
          taskId: task.taskId,
          childTaskId: childTaskId || '',
          kind: 'task.replan.result',
          fromMemberId: 'member:tl',
          payload: replanPayload,
        });
        appendBlackboard({
          teamId: task.teamId,
          taskId: task.taskId,
          section: 'tl_runtime',
          entryKey: `replan:${assignmentId || childTaskId || id('replan')}`,
          value: {
            ...replanPayload,
            beforeWorkItem,
            diff: replanDiff,
            workItems: plannedItems,
            raw: parsed,
          },
          metadata: {
            assignmentId: assignmentId || '',
            childTaskId: childTaskId || '',
            intent: 'replan',
          },
        });
        appendArtifactForMemberResult({
          teamId: task.teamId,
          taskId: task.taskId,
          childTaskId: childTaskId || '',
          role: 'tl',
          assignmentId: assignmentId || '',
          title: `局部 replan：${childTask?.title || assignmentId || childTaskId || task.title}`,
          body: {
            markdown: replanMarkdown,
            summary: replanSummary,
            reason: replanReason,
            beforeWorkItem,
            diff: replanDiff,
            workItems: plannedItems,
          },
          metadata: {
            intent: 'replan',
            structured: true,
          },
          artifactType: 'replan',
        });
        broadcast({
          type: 'orchestration_event',
          eventKind: 'task.replan.proposed',
          role: 'tl',
          lane: 'tl',
          title: 'TL 已产出局部 replan',
          content: replanSummary,
          taskId: task.taskId,
          childTaskId: childTaskId || '',
          assignmentId: assignmentId || '',
          intent: 'replan',
          timestamp: nowFn(),
          status: 'done',
        });
        broadcast({
          type: 'orchestration_event',
          eventKind: 'task.followup.completed',
          role: 'tl',
          lane: 'tl',
          title: 'TL 已完成局部 replan',
          content: replanSummary,
          taskId: task.taskId,
          childTaskId: childTaskId || '',
          assignmentId: assignmentId || '',
          intent: 'replan',
          timestamp: nowFn(),
          status: 'done',
        });
        updateTaskFollowupState({
          taskId: task.taskId,
          routedTo: 'tl_replan',
          targetRole: targetRole || '',
          assignmentId: assignmentId || '',
          childTaskId: childTaskId || '',
          intent,
        });
        return {
          ok: true,
          reply: replanMarkdown,
          routedTo: 'tl_replan',
          targetRole: targetRole || '',
          assignmentId: assignmentId || '',
          childTaskId: childTaskId || '',
          intent,
          replan: {
            summary: replanSummary,
            reason: replanReason,
            workItems: plannedItems,
          },
        };
      }

      if (parsed?.action === 'forward' && parsed.target) {
        const forwardedTarget = String(parsed.target).toLowerCase();
        const targetSession = sessions.sessionsByRole[forwardedTarget]
          || (assignmentId && sessions.sessionsByAssignment?.[String(assignmentId).toLowerCase()])
          || Object.values(sessions.sessionsByAssignment || {}).find((info) => String(info?.childTaskId || '') === String(childTaskId || ''));
        const normalizedFallbackReason = String(fallbackReason || '').trim();
        const fallbackLockedToCurrentMember = !!normalizedFallbackReason
          && !!targetSession?.sessionKey
          && String(targetSession?.role || forwardedTarget || '').trim().toLowerCase() === String(targetRole || forwardedTarget || '').trim().toLowerCase();
        if (!fallbackLockedToCurrentMember && targetSession?.sessionKey && isPersistentSessionBinding(targetSession)) {
          broadcast({
            type: 'orchestration_event',
            eventKind: 'task.followup.routed',
            role: targetSession.role || forwardedTarget || targetRole || 'executor',
            lane: targetSession.role || forwardedTarget || targetRole || 'executor',
            title: `TL 已转交 ${targetSession.role || forwardedTarget || 'member'}`,
            content: String(parsed.message || text),
            taskId: task.taskId,
            childTaskId: childTaskId || targetSession.childTaskId || '',
            assignmentId: assignmentId || targetSession.assignmentId || '',
            intent: intent || 'followup',
            timestamp: nowFn(),
            status: 'running',
            sessionKey: targetSession.sessionKey,
          });
          const forwardResult = await unifiedSendToSession({
            sessionKey: targetSession.sessionKey,
            message: String(parsed.message || text),
            timeoutSeconds,
          });
          if (!shouldFallbackMemberFollowup(forwardResult)) {
            broadcast({
              type: 'orchestration_event',
              eventKind: 'task.followup.completed',
              role: targetSession.role || forwardedTarget || targetRole || 'executor',
              lane: targetSession.role || forwardedTarget || targetRole || 'executor',
              title: 'follow-up 已完成',
              content: String(forwardResult?.reply || '').slice(0, 500),
              taskId: task.taskId,
              childTaskId: childTaskId || targetSession.childTaskId || '',
              assignmentId: assignmentId || targetSession.assignmentId || '',
              intent: intent || 'followup',
              timestamp: nowFn(),
              status: 'done',
              sessionKey: targetSession.sessionKey,
            });
            updateTaskFollowupState({
              taskId: task.taskId,
              routedTo: 'member_via_tl',
              targetRole: targetSession.role || forwardedTarget || targetRole || '',
              assignmentId: assignmentId || targetSession.assignmentId || '',
              childTaskId: childTaskId || targetSession.childTaskId || '',
              intent,
            });
            return {
              ok: true,
              reply: forwardResult?.reply || '',
              sessionKey: targetSession.sessionKey,
              targetRole: targetSession.role || forwardedTarget || targetRole || '',
              assignmentId: assignmentId || targetSession.assignmentId || '',
              childTaskId: childTaskId || targetSession.childTaskId || '',
              routedTo: 'member_via_tl',
              intent,
            };
          }
        }

        const directFallbackReason = String(targetSession?.sessionFallbackReason || fallbackReason || 'member_followup_unavailable');
        const directReply = await renderTLDirectFallbackReply(directFallbackReason);
        broadcast({
          type: 'orchestration_event',
          eventKind: 'task.followup.completed',
          role: 'tl',
          lane: 'tl',
          title: '成员 follow-up 已回退 TL 直答',
          content: directReply,
          taskId: task.taskId,
          childTaskId: childTaskId || targetSession?.childTaskId || '',
          assignmentId: assignmentId || targetSession?.assignmentId || '',
          intent: intent || 'followup',
          timestamp: nowFn(),
          status: 'done',
        });
        updateTaskFollowupState({
          taskId: task.taskId,
          routedTo: 'tl_direct_fallback',
          targetRole: targetSession?.role || forwardedTarget || targetRole || '',
          assignmentId: assignmentId || targetSession?.assignmentId || '',
          childTaskId: childTaskId || targetSession?.childTaskId || '',
          fallbackReason: directFallbackReason,
          intent,
        });
        return {
          ok: true,
          reply: directReply,
          routedTo: 'tl_direct_fallback',
          targetRole: targetSession?.role || forwardedTarget || targetRole || '',
          assignmentId: assignmentId || targetSession?.assignmentId || '',
          childTaskId: childTaskId || targetSession?.childTaskId || '',
          intent,
        };
      }
    } catch (err) {
      broadcast({
        type: 'orchestration_event',
        eventKind: 'task.followup.failed',
        role: 'tl',
        lane: 'tl',
        title: 'TL follow-up 处理失败',
        content: String(err?.message || err),
        taskId: task.taskId,
        childTaskId: childTaskId || '',
        assignmentId: assignmentId || '',
        intent: intent || 'followup',
        timestamp: nowFn(),
        status: 'failed',
      });
    }

    broadcast({
      type: 'orchestration_event',
      eventKind: 'task.followup.completed',
      role: 'tl',
      lane: 'tl',
      title: 'TL 已直接完成 follow-up',
      content: replyText,
      taskId: task.taskId,
      childTaskId: childTaskId || '',
      assignmentId: assignmentId || '',
      intent: intent || 'followup',
      timestamp: nowFn(),
      status: 'done',
    });
    updateTaskFollowupState({
      taskId: task.taskId,
      routedTo: 'tl_direct',
      targetRole: targetRole || '',
      assignmentId: assignmentId || '',
      childTaskId: childTaskId || '',
      fallbackReason: fallbackReason || '',
      intent,
    });
    return {
      ok: true,
      reply: replyText,
      routedTo: 'tl_direct',
      targetRole: targetRole || '',
      assignmentId: assignmentId || '',
      childTaskId: childTaskId || '',
      intent,
    };
  }

  async function sendToTaskSession({ taskId, text, target, intent, targetRole, assignmentId, childTaskId, timeoutSeconds = 60 } = {}) {
    const task = teamStore?.getTaskById?.(String(taskId || ''));
    if (!task) return { ok: false, error: 'task_not_found', taskId };

    broadcast({
      type: 'orchestration_event',
      eventKind: 'task.followup.requested',
      role: 'tl',
      lane: 'tl',
      title: intent === 'retry' ? '请求 selective retry' : intent === 'replan' ? '请求局部 replan' : '请求 child task 跟进',
      content: text,
      taskId,
      childTaskId: childTaskId || '',
      assignmentId: assignmentId || '',
      intent: intent || 'followup',
      timestamp: nowFn(),
      status: 'running',
    });

    const sessions = readTaskSessions(task);
    const targetLower = String(target || targetRole || '').trim().toLowerCase();
    const assignmentLower = String(assignmentId || '').trim().toLowerCase();
    const childTaskLower = String(childTaskId || '').trim().toLowerCase();
    let targetSessionKey = '';
    let targetSessionInfo = null;
    let resolvedTargetRole = '';
    let resolvedAssignmentId = assignmentId || '';
    let resolvedChildTaskId = childTaskId || '';

    if (targetLower && targetLower !== 'tl') {
      if (sessions.sessionsByRole[targetLower]?.sessionKey) {
        targetSessionInfo = { role: targetLower, ...sessions.sessionsByRole[targetLower] };
        targetSessionKey = targetSessionInfo.sessionKey;
        resolvedTargetRole = targetLower;
        resolvedAssignmentId = resolvedAssignmentId || String(targetSessionInfo.assignmentId || '');
        resolvedChildTaskId = resolvedChildTaskId || String(targetSessionInfo.childTaskId || '');
      } else if (sessions.sessionsByAssignment[targetLower]?.sessionKey) {
        targetSessionInfo = sessions.sessionsByAssignment[targetLower];
        targetSessionKey = targetSessionInfo.sessionKey;
        resolvedTargetRole = targetSessionInfo.role || '';
        resolvedAssignmentId = resolvedAssignmentId || targetLower;
        resolvedChildTaskId = resolvedChildTaskId || String(targetSessionInfo.childTaskId || '');
      }
    }

    if (!targetSessionKey && assignmentLower && sessions.sessionsByAssignment[assignmentLower]?.sessionKey) {
      const info = sessions.sessionsByAssignment[assignmentLower];
      targetSessionInfo = info;
      targetSessionKey = info.sessionKey;
      resolvedTargetRole = info.role || resolvedTargetRole;
      resolvedAssignmentId = resolvedAssignmentId || assignmentLower;
      resolvedChildTaskId = resolvedChildTaskId || String(info.childTaskId || '');
    }

    if (!targetSessionKey && childTaskLower) {
      for (const [assignmentKey, info] of Object.entries(sessions.sessionsByAssignment || {})) {
        if (String(info?.childTaskId || '').trim().toLowerCase() === childTaskLower && info?.sessionKey) {
          targetSessionInfo = info;
          targetSessionKey = info.sessionKey;
          resolvedTargetRole = info.role || resolvedTargetRole;
          resolvedAssignmentId = resolvedAssignmentId || assignmentKey;
          resolvedChildTaskId = resolvedChildTaskId || String(info.childTaskId || '');
          break;
        }
      }
    }

    if (!targetSessionKey) {
      broadcast({
        type: 'orchestration_event',
        eventKind: 'task.followup.accepted',
        role: 'tl',
        lane: 'tl',
        title: 'TL 已接住请求',
        content: '当前 follow-up 将先由 TL 判断',
        taskId,
        childTaskId: resolvedChildTaskId || '',
        assignmentId: resolvedAssignmentId || '',
        intent: intent || 'followup',
        timestamp: nowFn(),
        status: 'running',
      });
      return handleTLFollowup({
        task,
        text,
        intent,
        targetRole: resolvedTargetRole || targetRole || '',
        assignmentId: resolvedAssignmentId || '',
        childTaskId: resolvedChildTaskId || '',
        timeoutSeconds,
      });
    }
    if (targetSessionInfo && !isPersistentSessionBinding(targetSessionInfo)) {
      broadcast({
        type: 'orchestration_event',
        eventKind: 'task.followup.accepted',
        role: 'tl',
        lane: 'tl',
        title: '成员续聊不可用，TL 接管',
        content: String(targetSessionInfo.sessionFallbackReason || '当前成员会话是一次性 run-mode，会自动回退到 TL follow-up'),
        taskId,
        childTaskId: resolvedChildTaskId || '',
        assignmentId: resolvedAssignmentId || '',
        intent: intent || 'followup',
        timestamp: nowFn(),
        status: 'running',
      });
      return handleTLFollowup({
        task,
        text,
        intent,
        targetRole: resolvedTargetRole || targetRole || '',
        assignmentId: resolvedAssignmentId || '',
        childTaskId: resolvedChildTaskId || '',
        timeoutSeconds,
        fallbackReason: String(targetSessionInfo.sessionFallbackReason || 'member_session_not_persistent'),
      });
    }
    if (!runtimeExecutionHarness.hasSend?.()) return { ok: false, error: 'send_not_available' };

    try {
      broadcast({
        type: 'orchestration_event',
        eventKind: 'task.followup.routed',
        role: resolvedTargetRole || targetRole || 'executor',
        lane: resolvedTargetRole || targetRole || 'executor',
        title: `follow-up 已转交 ${resolvedTargetRole || targetRole || 'member'}`,
        content: text,
        taskId,
        childTaskId: resolvedChildTaskId || '',
        assignmentId: resolvedAssignmentId || '',
        intent: intent || 'followup',
        timestamp: nowFn(),
        status: 'running',
        sessionKey: targetSessionKey,
      });
      const result = await unifiedSendToSession({ sessionKey: targetSessionKey, message: text, timeoutSeconds });
      if (!result || result?.error === 'send_not_available') return { ok: false, error: 'send_not_available', sessionKey: targetSessionKey };
      if (shouldFallbackMemberFollowup(result)) {
        broadcast({
          type: 'orchestration_event',
          eventKind: 'task.followup.accepted',
          role: 'tl',
          lane: 'tl',
          title: '成员 follow-up 不可直连，TL 接管',
          content: String(result?.error || result?.status || 'empty_member_reply'),
          taskId,
          childTaskId: resolvedChildTaskId || '',
          assignmentId: resolvedAssignmentId || '',
          intent: intent || 'followup',
          timestamp: nowFn(),
          status: 'running',
        });
        return handleTLFollowup({
          task,
          text,
          intent,
          targetRole: resolvedTargetRole || targetRole || '',
          assignmentId: resolvedAssignmentId || '',
          childTaskId: resolvedChildTaskId || '',
          timeoutSeconds,
          fallbackReason: String(result?.error || result?.status || 'empty_member_reply'),
        });
      }
      broadcast({
        type: 'orchestration_event',
        eventKind: 'task.followup.completed',
        role: resolvedTargetRole || targetRole || 'executor',
        lane: resolvedTargetRole || targetRole || 'executor',
        title: 'follow-up 已完成',
        content: String(result?.reply || '').slice(0, 500),
        taskId,
        childTaskId: resolvedChildTaskId || '',
        assignmentId: resolvedAssignmentId || '',
        intent: intent || 'followup',
        timestamp: nowFn(),
        status: 'done',
        sessionKey: targetSessionKey,
      });
      updateTaskFollowupState({
        taskId,
        routedTo: 'member',
        targetRole: resolvedTargetRole || targetRole || '',
        assignmentId: resolvedAssignmentId || '',
        childTaskId: resolvedChildTaskId || '',
        intent: intent || '',
      });
      return {
        ok: true,
        reply: result?.reply || '',
        sessionKey: targetSessionKey,
        targetRole: resolvedTargetRole || targetRole || '',
        assignmentId: resolvedAssignmentId || '',
        childTaskId: resolvedChildTaskId || '',
        routedTo: 'member',
        intent: intent || '',
      };
    } catch (err) {
      broadcast({
        type: 'orchestration_event',
        eventKind: 'task.followup.failed',
        role: resolvedTargetRole || targetRole || 'executor',
        lane: resolvedTargetRole || targetRole || 'executor',
        title: 'follow-up 处理失败',
        content: String(err?.message || err),
        taskId,
        childTaskId: resolvedChildTaskId || '',
        assignmentId: resolvedAssignmentId || '',
        intent: intent || 'followup',
        timestamp: nowFn(),
        status: 'failed',
        sessionKey: targetSessionKey,
      });
      return { ok: false, error: String(err?.message || err), sessionKey: targetSessionKey };
    }
  }

  return {
    handleTLFollowup,
    sendToTaskSession,
  };
}

export async function consumeWebhookEvent(evt = {}, ctx = {}) {
  const {
    TEAM_POLICY,
    tlRuntime,
  } = ctx;

  const workMode = TEAM_POLICY.classifyWorkMode(evt);

  if (workMode === 'team_task') {
    if (!tlRuntime?.createTeamRunFromEvent) {
      return { ok: false, accepted: false, error: 'tl_runtime_unavailable' };
    }
    const out = await tlRuntime.createTeamRunFromEvent(evt);
    return {
      ok: true,
      accepted: true,
      mode: workMode,
      entry: {
        authority: 'orchestrator',
        source: out?.entry?.source || String(evt.source || ''),
        ingressKind: out?.entry?.ingressKind || String(evt.ingressKind || evt.kind || ''),
        scopeKey: out?.entry?.scopeKey || String(evt.scope_key || evt.scopeKey || evt.scope || ''),
        sourceEventId: out?.entry?.sourceEventId || String(evt.sourceEventId || evt.id || evt.msg_id || evt.message_id || evt.messageId || ''),
        originNode: out?.entry?.originNode || String(evt.originNode || evt.origin_node || evt.relayNode || evt.bridgeNode || ''),
        deliveryTarget: out?.entry?.deliveryTarget || String(evt.deliveryTarget || evt.delivery_target || evt.room || evt.chat_id || evt.target_id || ''),
        recipientId: out?.entry?.recipientId || String(evt.recipientId || evt.recipient_id || evt.deliveryTarget || evt.delivery_target || evt.room || evt.chat_id || evt.target_id || ''),
        recipientType: out?.entry?.recipientType || String(evt.recipientType || evt.recipient_type || ''),
        deliveryMode: out?.entry?.deliveryMode || String(evt.deliveryMode || evt.delivery_mode || ''),
        channel: out?.entry?.channel || String(evt.channel || evt.surface || ''),
      },
      team: {
        teamId: out?.team?.teamId || null,
        taskId: out?.task?.taskId || null,
        state: out?.task?.state || 'pending',
        taskMode: out?.task?.metadata?.taskMode || null,
        riskLevel: out?.task?.metadata?.riskLevel || null,
      },
      extraHeaders: {},
    };
  }

  return {
    ok: true,
    accepted: true,
    decision: {
      mode: 'simple_reply',
      reason: 'team_runtime_simple_reply',
    },
    traceId: `simple:${String(evt.message_id || evt.messageId || evt.msg_id || evt.id || '') || 'none'}`,
    extraHeaders: {},
  };
}

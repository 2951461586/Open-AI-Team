export function parseLegacyQqGroupIdFromScope(scope = '') {
  const m = String(scope || '').match(/^qq:(\d+)$/);
  return m ? m[1] : null;
}

export function parseGroupScope(scope = '') {
  const m = String(scope || '').match(/^group:(.+)$/);
  return m ? String(m[1] || '').trim() || null : null;
}

export function parseDashboardScope(scope = '') {
  const m = String(scope || '').match(/^dashboard:(.*)$/);
  return m ? m[1] : null;
}

export function resolveDeliveryTarget(input = {}) {
  const scopeKey = String(input?.scopeKey || input?.scope || '').trim();
  const deliveryTarget = String(input?.deliveryTarget || input?.delivery_target || '').trim();
  const deliveryMode = String(input?.deliveryMode || input?.delivery_mode || '').trim().toLowerCase();
  const channel = String(input?.channel || input?.surface || '').trim().toLowerCase();
  const recipientId = String(input?.recipientId || input?.recipient_id || deliveryTarget || '').trim();
  const recipientType = String(input?.recipientType || input?.recipient_type || '').trim().toLowerCase();

  const dashboardWorkspace = parseDashboardScope(scopeKey);
  if (deliveryMode === 'dashboard' || channel === 'dashboard' || dashboardWorkspace || recipientType === 'workspace') {
    const workspaceId = recipientId || dashboardWorkspace || 'main';
    return {
      kind: 'dashboard',
      scopeKey,
      deliveryTarget: workspaceId,
      deliveryMode: deliveryMode || 'dashboard',
      channel: channel || 'dashboard',
      recipientId: workspaceId,
      recipientType: 'workspace',
      dashboardWorkspace: workspaceId,
      groupId: null,
      legacyScopeKind: dashboardWorkspace ? 'dashboard' : '',
    };
  }

  const groupScopeId = parseGroupScope(scopeKey);
  const legacyQqGroupId = parseLegacyQqGroupIdFromScope(scopeKey);
  const groupId = recipientId || groupScopeId || legacyQqGroupId;
  if (groupId) {
    return {
      kind: 'group',
      scopeKey,
      deliveryTarget: String(groupId),
      deliveryMode: deliveryMode || 'group',
      channel: channel || 'external',
      recipientId: String(groupId),
      recipientType: recipientType || 'group',
      dashboardWorkspace: null,
      groupId: String(groupId),
      legacyScopeKind: legacyQqGroupId ? 'qq' : (groupScopeId ? 'group' : ''),
    };
  }

  return {
    kind: 'unknown',
    scopeKey,
    deliveryTarget,
    deliveryMode,
    channel,
    recipientId: recipientId || '',
    recipientType: recipientType || '',
    dashboardWorkspace: null,
    groupId: null,
    legacyScopeKind: '',
  };
}

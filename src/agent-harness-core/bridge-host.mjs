import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

export function createLocalBridgeHost({ bridgeStatePath = '', channels = [], defaultChannel = '', routes = [], routeContracts = [], eventBus = null } = {}) {
  const ingress = [];
  const egress = [];
  const normalizedRoutes = [...new Set((Array.isArray(routes) ? routes : channels).map((item) => String(item || '').trim()).filter(Boolean))];
  const normalizedRouteContracts = (Array.isArray(routeContracts) ? routeContracts : []).map((item) => ({
    routeKey: String(item?.routeKey || '').trim(),
    enabled: item?.enabled !== false,
    allowedRoles: Array.isArray(item?.allowedRoles) ? item.allowedRoles.map((x) => String(x || '').trim()).filter(Boolean) : [],
    allowedKinds: Array.isArray(item?.allowedKinds) ? item.allowedKinds.map((x) => String(x || '').trim()).filter(Boolean) : [],
  })).filter((item) => item.routeKey);

  function resolveRouteContract(routeKey = '') {
    const key = String(routeKey || '').trim();
    return normalizedRouteContracts.find((item) => item.routeKey === key) || null;
  }

  function checkRouteAccess({ routeKey = '', role = '', kind = '' } = {}) {
    const contract = resolveRouteContract(routeKey);
    if (!contract) return { ok: true, routeKey, reason: 'no_contract' };
    if (contract.enabled === false) return { ok: false, routeKey, reason: 'route_disabled', contract };
    if (Array.isArray(contract.allowedRoles) && contract.allowedRoles.length > 0 && !contract.allowedRoles.includes(String(role || '').trim())) {
      return { ok: false, routeKey, reason: 'role_not_allowed', contract };
    }
    if (Array.isArray(contract.allowedKinds) && contract.allowedKinds.length > 0 && !contract.allowedKinds.includes(String(kind || '').trim())) {
      return { ok: false, routeKey, reason: 'kind_not_allowed', contract };
    }
    return { ok: true, routeKey, reason: 'allowed', contract };
  }

  async function persist() {
    await ensureDir(path.dirname(bridgeStatePath));
    await fs.writeFile(bridgeStatePath, JSON.stringify({
      contractVersion: 'agent-harness-bridge.v1',
      updatedAt: nowIso(),
      channels,
      defaultChannel,
      routes: normalizedRoutes,
      routeContracts: normalizedRouteContracts,
      counts: {
        ingress: ingress.length,
        egress: egress.length,
      },
      ingress,
      egress,
    }, null, 2));
  }

  async function appendIngress(message = {}) {
    const entry = {
      messageId: String(message?.messageId || `bridge-in:${Date.now()}`),
      channel: String(message?.channel || defaultChannel || channels[0] || 'local-thread'),
      routeKey: String(message?.routeKey || message?.channel || defaultChannel || channels[0] || 'local-thread'),
      text: String(message?.text || ''),
      kind: String(message?.kind || 'ingress'),
      createdAt: nowIso(),
    };
    ingress.push(entry);
    eventBus?.emit?.({ type: 'bridge.ingress.appended', channel: entry.channel, routeKey: entry.routeKey, messageId: entry.messageId, kind: entry.kind });
    await persist();
    return entry;
  }

  async function appendEgress(message = {}) {
    const entry = {
      messageId: String(message?.messageId || `bridge-out:${Date.now()}`),
      channel: String(message?.channel || defaultChannel || channels[0] || 'local-thread'),
      routeKey: String(message?.routeKey || message?.channel || defaultChannel || channels[0] || 'local-thread'),
      text: String(message?.text || ''),
      kind: String(message?.kind || 'egress'),
      createdAt: nowIso(),
    };
    egress.push(entry);
    eventBus?.emit?.({ type: 'bridge.egress.appended', channel: entry.channel, routeKey: entry.routeKey, messageId: entry.messageId, kind: entry.kind });
    await persist();
    return entry;
  }

  async function routeMessage(message = {}) {
    const requestedRoute = String(message?.routeKey || message?.channel || '').trim();
    const resolvedRoute = normalizedRoutes.includes(requestedRoute)
      ? requestedRoute
      : String(defaultChannel || normalizedRoutes[0] || channels[0] || 'local-thread');
    const role = String(message?.role || '').trim();
    const kind = String(message?.kind || 'route');
    const access = checkRouteAccess({ routeKey: resolvedRoute, role, kind });
    if (!access.ok) {
      const denied = {
        messageId: String(message?.messageId || `bridge-denied:${Date.now()}`),
        channel: resolvedRoute,
        routeKey: resolvedRoute,
        text: String(message?.text || ''),
        kind: 'route_denied',
        role,
        denyReason: access.reason,
        createdAt: nowIso(),
      };
      egress.push(denied);
      eventBus?.emit?.({ type: 'bridge.route.denied', routeKey: resolvedRoute, role, kind, reason: access.reason, messageId: denied.messageId });
      await persist();
      return { ok: false, denied, access };
    }
    const routed = await appendEgress({ ...message, channel: resolvedRoute, routeKey: resolvedRoute, kind, role });
    eventBus?.emit?.({ type: 'bridge.route.allowed', routeKey: resolvedRoute, role, kind, messageId: routed.messageId });
    return { ok: true, routed, access };
  }

  async function init() {
    await appendIngress({ messageId: 'bridge-bootstrap', text: 'bootstrap ingress', kind: 'bootstrap' });
    await appendEgress({ messageId: 'bridge-status', text: 'runtime ready', kind: 'bootstrap' });
    eventBus?.emit?.({ type: 'bridge.initialized', channelCount: channels.length, routeCount: normalizedRoutes.length });
    await persist();
    return { bridgeStatePath, channels, defaultChannel, routes: normalizedRoutes, routeContracts: normalizedRouteContracts };
  }

  return {
    kind: 'bridge_host',
    contractVersion: 'agent-harness-bridge.v1',
    init,
    appendIngress,
    appendEgress,
    routeMessage,
    paths: { bridgeStatePath },
    getState() {
      return { channels: [...channels], defaultChannel, routes: [...normalizedRoutes], routeContracts: [...normalizedRouteContracts], ingress: [...ingress], egress: [...egress] };
    },
  };
}

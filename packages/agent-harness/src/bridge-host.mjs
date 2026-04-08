import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildCapabilitiesSnapshot,
  matchAgentCapabilities,
  normalizeAgentCapabilities,
  selectBestAgent,
  validateAgentCapabilities,
} from './agent-capabilities.mjs';

async function ensureDir(dir = '') {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function normalizeString(value = '') {
  return String(value || '').trim();
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => normalizeString(item)).filter(Boolean))];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function safeMessageId(prefix = 'bridge') {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRouteContracts(routeContracts = []) {
  return (Array.isArray(routeContracts) ? routeContracts : []).map((item) => ({
    routeKey: normalizeString(item?.routeKey),
    enabled: item?.enabled !== false,
    allowedRoles: uniqueStrings(item?.allowedRoles || []),
    allowedKinds: uniqueStrings(item?.allowedKinds || []),
  })).filter((item) => item.routeKey);
}

function createTokenSet(tokens = []) {
  const set = new Set();
  for (const token of Array.isArray(tokens) ? tokens : []) {
    const normalized = normalizeString(token);
    if (normalized) set.add(normalized);
  }
  return set;
}

export function createLocalBridgeHost({
  bridgeStatePath = '',
  channels = [],
  defaultChannel = '',
  routes = [],
  routeContracts = [],
  eventBus = null,
  auth = null,
  heartbeatIntervalMs = 30_000,
  heartbeatGraceMs = 90_000,
  maxRecentMessages = 500,
} = {}) {
  const ingress = [];
  const egress = [];
  const relayLog = [];
  const authFailures = [];
  const agentDeliveries = [];
  const normalizedChannels = uniqueStrings(channels);
  const normalizedRoutes = uniqueStrings([...(Array.isArray(routes) ? routes : []), ...normalizedChannels]);
  const normalizedRouteContracts = normalizeRouteContracts(routeContracts);
  const agents = new Map();
  const tokenToAgentId = new Map();
  const apiKeys = createTokenSet(auth?.apiKeys || []);
  const bearerTokens = createTokenSet(auth?.tokens || auth?.bearerTokens || []);
  const knownTools = uniqueStrings(auth?.availableTools || []);
  const knownMemoryScopes = uniqueStrings(auth?.availableMemoryScopes || []);
  const knownChannels = uniqueStrings([...(auth?.availableChannels || []), ...normalizedRoutes, ...normalizedChannels]);
  const stateDir = path.dirname(String(bridgeStatePath || '.'));
  let persistChain = Promise.resolve();

  function emit(event = {}) {
    eventBus?.emit?.({ ...event, ts: event.ts || nowMs() });
  }

  function trimLog(list = []) {
    while (list.length > Math.max(10, Number(maxRecentMessages || 500))) list.shift();
  }

  function resolveDefaultRoute() {
    return normalizeString(defaultChannel || normalizedRoutes[0] || normalizedChannels[0] || 'local-thread');
  }

  function resolveRouteContract(routeKey = '') {
    const key = normalizeString(routeKey);
    return normalizedRouteContracts.find((item) => item.routeKey === key) || null;
  }

  function checkRouteAccess({ routeKey = '', role = '', kind = '' } = {}) {
    const resolved = normalizeString(routeKey || resolveDefaultRoute());
    const contract = resolveRouteContract(resolved);
    if (!contract) return { ok: true, routeKey: resolved, reason: 'no_contract' };
    if (contract.enabled === false) return { ok: false, routeKey: resolved, reason: 'route_disabled', contract };
    if (contract.allowedRoles.length > 0 && !contract.allowedRoles.includes(normalizeString(role))) {
      return { ok: false, routeKey: resolved, reason: 'role_not_allowed', contract };
    }
    if (contract.allowedKinds.length > 0 && !contract.allowedKinds.includes(normalizeString(kind))) {
      return { ok: false, routeKey: resolved, reason: 'kind_not_allowed', contract };
    }
    return { ok: true, routeKey: resolved, reason: 'allowed', contract };
  }

  function redactToken(token = '') {
    const normalized = normalizeString(token);
    if (!normalized) return '';
    if (normalized.length <= 8) return `${normalized.slice(0, 2)}***`;
    return `${normalized.slice(0, 4)}…${normalized.slice(-2)}`;
  }

  function agentSnapshot(agent = {}) {
    return {
      agentId: normalizeString(agent.agentId),
      sessionId: normalizeString(agent.sessionId),
      role: normalizeString(agent.role),
      status: normalizeString(agent.status || 'active'),
      registeredAt: normalizeString(agent.registeredAt),
      lastHeartbeatAt: normalizeString(agent.lastHeartbeatAt),
      heartbeatExpiresAt: normalizeString(agent.heartbeatExpiresAt),
      currentTaskCount: Number(agent.currentTaskCount || 0),
      channelBindings: uniqueStrings(agent.channelBindings || []),
      capabilities: clone(agent.capabilities || {}),
      auth: {
        mode: normalizeString(agent?.auth?.mode),
        tokenHint: redactToken(agent?.auth?.token),
      },
      metadata: clone(agent.metadata || {}),
      counters: clone(agent.counters || { ingress: 0, egress: 0, relayed: 0 }),
    };
  }

  async function persist() {
    const state = {
      contractVersion: 'agent-harness-bridge.v2',
      updatedAt: nowIso(),
      channels: [...normalizedChannels],
      defaultChannel: resolveDefaultRoute(),
      routes: [...normalizedRoutes],
      routeContracts: clone(normalizedRouteContracts),
      heartbeat: {
        intervalMs: Number(heartbeatIntervalMs || 0),
        graceMs: Number(heartbeatGraceMs || 0),
      },
      counts: {
        ingress: ingress.length,
        egress: egress.length,
        relayed: relayLog.length,
        activeAgents: Array.from(agents.values()).filter((agent) => agent.status === 'active').length,
        totalAgents: agents.size,
        authFailures: authFailures.length,
      },
      agentRegistry: Array.from(agents.values()).map((agent) => agentSnapshot(agent)),
      capabilities: buildCapabilitiesSnapshot(Array.from(agents.values()).map((agent) => agentSnapshot(agent))),
      ingress: clone(ingress),
      egress: clone(egress),
      relayLog: clone(relayLog),
      authFailures: clone(authFailures),
      deliveries: clone(agentDeliveries),
    };
    await ensureDir(stateDir);
    await fs.writeFile(bridgeStatePath, JSON.stringify(state, null, 2));
    return state;
  }

  function queuePersist() {
    persistChain = persistChain.then(() => persist()).catch(() => {});
    return persistChain;
  }

  function appendEntry(target = [], message = {}, fallbackKind = 'message') {
    const entry = {
      messageId: normalizeString(message?.messageId || safeMessageId(fallbackKind)),
      channel: normalizeString(message?.channel || message?.routeKey || resolveDefaultRoute()),
      routeKey: normalizeString(message?.routeKey || message?.channel || resolveDefaultRoute()),
      text: String(message?.text || ''),
      kind: normalizeString(message?.kind || fallbackKind),
      direction: normalizeString(message?.direction || ''),
      agentId: normalizeString(message?.agentId || ''),
      fromAgentId: normalizeString(message?.fromAgentId || ''),
      toAgentId: normalizeString(message?.toAgentId || ''),
      role: normalizeString(message?.role || ''),
      createdAt: normalizeString(message?.createdAt || nowIso()),
      metadata: clone(toObject(message?.metadata, {})),
    };
    target.push(entry);
    trimLog(target);
    return entry;
  }

  function resolveAuth({ apiKey = '', token = '', authorization = '', agentId = '' } = {}) {
    const authHeader = normalizeString(authorization);
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const normalizedApiKey = normalizeString(apiKey);
    const normalizedToken = normalizeString(token || bearer);
    const claimedAgentId = normalizeString(agentId);

    if (normalizedApiKey) {
      if (apiKeys.size > 0 && !apiKeys.has(normalizedApiKey)) {
        return { ok: false, mode: 'apiKey', error: 'invalid_api_key' };
      }
      return { ok: true, mode: 'apiKey', token: normalizedApiKey, agentId: claimedAgentId };
    }

    if (normalizedToken) {
      if (bearerTokens.size > 0 && !bearerTokens.has(normalizedToken) && !tokenToAgentId.has(normalizedToken)) {
        return { ok: false, mode: 'token', error: 'invalid_token' };
      }
      const boundAgentId = tokenToAgentId.get(normalizedToken) || claimedAgentId;
      if (claimedAgentId && boundAgentId && claimedAgentId !== boundAgentId) {
        return { ok: false, mode: 'token', error: 'token_agent_mismatch', agentId: boundAgentId };
      }
      return { ok: true, mode: 'token', token: normalizedToken, agentId: boundAgentId || claimedAgentId };
    }

    if (apiKeys.size === 0 && bearerTokens.size === 0) {
      return { ok: true, mode: 'anonymous', token: '', agentId: claimedAgentId };
    }

    return { ok: false, mode: 'none', error: 'missing_credentials' };
  }

  function recordAuthFailure(details = {}) {
    const entry = {
      at: nowIso(),
      mode: normalizeString(details?.mode),
      agentId: normalizeString(details?.agentId),
      error: normalizeString(details?.error || 'auth_failed'),
      tokenHint: redactToken(details?.token),
    };
    authFailures.push(entry);
    trimLog(authFailures);
    emit({ type: 'bridge.auth.failed', ...entry });
    queuePersist();
    return entry;
  }

  function getAgentRecord(agentId = '') {
    const id = normalizeString(agentId);
    return id ? agents.get(id) || null : null;
  }

  function setAgentRecord(record = {}) {
    const id = normalizeString(record?.agentId);
    if (!id) return null;
    agents.set(id, record);
    return record;
  }

  function removeAgentToken(record = {}) {
    const token = normalizeString(record?.auth?.token);
    if (token && tokenToAgentId.get(token) === record.agentId) tokenToAgentId.delete(token);
  }

  function bindAgentToken(record = {}) {
    const token = normalizeString(record?.auth?.token);
    if (token) tokenToAgentId.set(token, record.agentId);
  }

  function refreshAgentLease(agent = {}, leaseMs) {
    const ts = nowMs();
    const ttl = Math.max(Number(heartbeatIntervalMs || 30_000), Number(leaseMs || heartbeatIntervalMs || 30_000)) + Math.max(0, Number(heartbeatGraceMs || 0));
    agent.lastHeartbeatAt = nowIso();
    agent.lastHeartbeatAtMs = ts;
    agent.heartbeatExpiresAt = new Date(ts + ttl).toISOString();
    agent.heartbeatExpiresAtMs = ts + ttl;
    return agent;
  }

  function registerAgent({ agentId = '', sessionId = '', role = '', apiKey = '', token = '', authorization = '', capabilities = {}, metadata = {}, channelBindings = [], leaseMs = 0, currentTaskCount = 0 } = {}) {
    const claimedAgentId = normalizeString(agentId || sessionId);
    const authResult = resolveAuth({ apiKey, token, authorization, agentId: claimedAgentId });
    if (!authResult.ok) {
      return { ok: false, error: authResult.error, authFailure: recordAuthFailure({ ...authResult, agentId: claimedAgentId, token: authResult.token || token || apiKey }) };
    }

    const id = normalizeString(authResult.agentId || claimedAgentId);
    if (!id) return { ok: false, error: 'missing_agent_id' };

    const normalizedCapabilities = normalizeAgentCapabilities(capabilities);
    const capabilityValidation = validateAgentCapabilities(normalizedCapabilities, {
      availableTools: knownTools,
      availableMemoryScopes: knownMemoryScopes,
      availableChannels: knownChannels,
      requireEvidence: false,
    });
    if (!capabilityValidation.ok) {
      return { ok: false, error: 'invalid_capabilities', validation: capabilityValidation };
    }

    const existing = getAgentRecord(id);
    if (existing) removeAgentToken(existing);
    const record = refreshAgentLease({
      agentId: id,
      sessionId: normalizeString(sessionId || existing?.sessionId || id),
      role: normalizeString(role || existing?.role || ''),
      status: 'active',
      registeredAt: normalizeString(existing?.registeredAt || nowIso()),
      currentTaskCount: Number(currentTaskCount || existing?.currentTaskCount || 0),
      channelBindings: uniqueStrings(channelBindings.length > 0 ? channelBindings : (existing?.channelBindings || normalizedCapabilities.channels.map((item) => item.routeKey) || [resolveDefaultRoute()])),
      capabilities: normalizedCapabilities,
      metadata: { ...toObject(existing?.metadata, {}), ...toObject(metadata, {}) },
      auth: { mode: authResult.mode, token: normalizeString(authResult.token) },
      counters: existing?.counters || { ingress: 0, egress: 0, relayed: 0 },
    }, leaseMs);
    setAgentRecord(record);
    bindAgentToken(record);
    emit({ type: 'bridge.agent.registered', agentId: id, role: record.role, sessionId: record.sessionId });
    queuePersist();
    return { ok: true, agent: agentSnapshot(record), validation: capabilityValidation };
  }

  function heartbeatAgent({ agentId = '', token = '', authorization = '', currentTaskCount, status = 'active', leaseMs = 0, metadata = {} } = {}) {
    const claimedAgentId = normalizeString(agentId);
    const authResult = resolveAuth({ token, authorization, agentId: claimedAgentId });
    if (!authResult.ok) {
      return { ok: false, error: authResult.error, authFailure: recordAuthFailure({ ...authResult, agentId: claimedAgentId, token }) };
    }
    const record = getAgentRecord(authResult.agentId || claimedAgentId);
    if (!record) return { ok: false, error: 'agent_not_found' };

    refreshAgentLease(record, leaseMs);
    if (typeof currentTaskCount === 'number' && Number.isFinite(Number(currentTaskCount))) record.currentTaskCount = Number(currentTaskCount);
    if (normalizeString(status)) record.status = normalizeString(status);
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) record.metadata = { ...record.metadata, ...metadata };
    emit({ type: 'bridge.agent.heartbeat', agentId: record.agentId, status: record.status, currentTaskCount: record.currentTaskCount });
    queuePersist();
    return { ok: true, agent: agentSnapshot(record) };
  }

  function deregisterAgent({ agentId = '', token = '', authorization = '', reason = 'agent_requested' } = {}) {
    const claimedAgentId = normalizeString(agentId);
    const authResult = resolveAuth({ token, authorization, agentId: claimedAgentId });
    if (!authResult.ok) {
      return { ok: false, error: authResult.error, authFailure: recordAuthFailure({ ...authResult, agentId: claimedAgentId, token }) };
    }
    const record = getAgentRecord(authResult.agentId || claimedAgentId);
    if (!record) return { ok: false, error: 'agent_not_found' };

    removeAgentToken(record);
    agents.delete(record.agentId);
    emit({ type: 'bridge.agent.deregistered', agentId: record.agentId, reason: normalizeString(reason) });
    queuePersist();
    return { ok: true, agent: agentSnapshot(record), reason: normalizeString(reason) };
  }

  function sweepAgents() {
    const ts = nowMs();
    const expired = [];
    for (const record of agents.values()) {
      if (record.heartbeatExpiresAtMs > 0 && ts > record.heartbeatExpiresAtMs) {
        expired.push(agentSnapshot(record));
        removeAgentToken(record);
        agents.delete(record.agentId);
        emit({ type: 'bridge.agent.expired', agentId: record.agentId, role: record.role });
      }
    }
    if (expired.length > 0) queuePersist();
    return expired;
  }

  async function appendIngress(message = {}) {
    const entry = appendEntry(ingress, { ...message, direction: 'ingress' }, 'ingress');
    if (entry.agentId) {
      const record = getAgentRecord(entry.agentId);
      if (record) record.counters.ingress += 1;
    }
    emit({ type: 'bridge.ingress.appended', channel: entry.channel, routeKey: entry.routeKey, messageId: entry.messageId, kind: entry.kind, agentId: entry.agentId || undefined });
    await queuePersist();
    return entry;
  }

  async function appendEgress(message = {}) {
    const entry = appendEntry(egress, { ...message, direction: 'egress' }, 'egress');
    if (entry.agentId) {
      const record = getAgentRecord(entry.agentId);
      if (record) record.counters.egress += 1;
    }
    emit({ type: 'bridge.egress.appended', channel: entry.channel, routeKey: entry.routeKey, messageId: entry.messageId, kind: entry.kind, agentId: entry.agentId || undefined });
    await queuePersist();
    return entry;
  }

  async function routeMessage(message = {}) {
    const requestedRoute = normalizeString(message?.routeKey || message?.channel || resolveDefaultRoute());
    const resolvedRoute = normalizedRoutes.includes(requestedRoute) ? requestedRoute : resolveDefaultRoute();
    const role = normalizeString(message?.role || '');
    const kind = normalizeString(message?.kind || 'route');
    const access = checkRouteAccess({ routeKey: resolvedRoute, role, kind });
    if (!access.ok) {
      const denied = appendEntry(egress, {
        ...message,
        channel: resolvedRoute,
        routeKey: resolvedRoute,
        kind: 'route_denied',
        metadata: { ...toObject(message?.metadata, {}), denyReason: access.reason },
      }, 'route_denied');
      emit({ type: 'bridge.route.denied', routeKey: resolvedRoute, role, kind, reason: access.reason, messageId: denied.messageId });
      await queuePersist();
      return { ok: false, denied, access };
    }

    const routed = await appendEgress({ ...message, channel: resolvedRoute, routeKey: resolvedRoute, kind, role });
    emit({ type: 'bridge.route.allowed', routeKey: resolvedRoute, role, kind, messageId: routed.messageId });
    return { ok: true, routed, access };
  }

  function listAgents({ includeExpiredSweep = true, status } = {}) {
    if (includeExpiredSweep) sweepAgents();
    return Array.from(agents.values())
      .map((agent) => agentSnapshot(agent))
      .filter((agent) => !status || agent.status === normalizeString(status));
  }

  function assignAgent({ requirements = {}, preferredAgentId = '' } = {}) {
    sweepAgents();
    const activeAgents = listAgents({ includeExpiredSweep: false }).filter((agent) => agent.status === 'active');
    if (preferredAgentId) {
      const preferred = activeAgents.find((agent) => agent.agentId === normalizeString(preferredAgentId));
      if (preferred) {
        return { ok: true, selected: preferred, ranked: matchAgentCapabilities(requirements, activeAgents) };
      }
    }
    const selection = selectBestAgent(requirements, activeAgents);
    return selection.ok ? selection : { ok: false, error: 'no_matching_agent', ranked: selection.ranked };
  }

  async function relayToAgent({ agentId = '', token = '', authorization = '', message = {}, requirements = null } = {}) {
    sweepAgents();
    const selected = agentId ? { ok: true, selected: listAgents({ includeExpiredSweep: false }).find((agent) => agent.agentId === normalizeString(agentId)) || null, ranked: [] } : assignAgent({ requirements: requirements || { channels: [message?.routeKey || message?.channel].filter(Boolean), tools: message?.requiredTools || [] } });
    if (!selected?.selected) return { ok: false, error: 'agent_not_available', ranked: selected?.ranked || [] };

    const authResult = resolveAuth({ token, authorization, agentId: selected.selected.agentId });
    if (!authResult.ok && (token || authorization)) {
      return { ok: false, error: authResult.error, authFailure: recordAuthFailure({ ...authResult, agentId: selected.selected.agentId, token }) };
    }

    const entry = {
      deliveryId: safeMessageId('bridge-delivery'),
      fromAgentId: normalizeString(message?.fromAgentId || ''),
      toAgentId: selected.selected.agentId,
      routeKey: normalizeString(message?.routeKey || message?.channel || resolveDefaultRoute()),
      channel: normalizeString(message?.channel || message?.routeKey || resolveDefaultRoute()),
      kind: normalizeString(message?.kind || 'relay'),
      text: String(message?.text || ''),
      createdAt: nowIso(),
      metadata: clone(toObject(message?.metadata, {})),
    };
    relayLog.push(entry);
    trimLog(relayLog);
    agentDeliveries.push(entry);
    trimLog(agentDeliveries);
    const record = getAgentRecord(selected.selected.agentId);
    if (record) record.counters.relayed += 1;
    emit({ type: 'bridge.agent.relayed', deliveryId: entry.deliveryId, toAgentId: entry.toAgentId, routeKey: entry.routeKey, kind: entry.kind });
    await queuePersist();
    return { ok: true, delivery: entry, selected: selected.selected, ranked: selected.ranked || [] };
  }

  function negotiateCapabilities({ agentId = '', requirements = {}, includeRanked = true } = {}) {
    sweepAgents();
    const candidates = listAgents({ includeExpiredSweep: false }).filter((agent) => !agentId || agent.agentId === normalizeString(agentId));
    const ranked = matchAgentCapabilities(requirements, candidates);
    const selected = ranked.find((item) => item.eligible && item.status === 'active') || null;
    return {
      ok: !!selected,
      selected,
      ranked: includeRanked ? ranked : undefined,
      requirements: clone(requirements),
    };
  }

  function verifyAgentCapabilities({ agentId = '', probe = {} } = {}) {
    sweepAgents();
    const record = getAgentRecord(agentId);
    if (!record) return { ok: false, error: 'agent_not_found' };
    return validateAgentCapabilities(record.capabilities, {
      availableTools: uniqueStrings([...(probe.availableTools || []), ...knownTools]),
      availableMemoryScopes: uniqueStrings([...(probe.availableMemoryScopes || []), ...knownMemoryScopes]),
      availableChannels: uniqueStrings([...(probe.availableChannels || []), ...knownChannels]),
      requireEvidence: probe.requireEvidence === true,
    });
  }

  async function init() {
    await ensureDir(stateDir);
    await appendIngress({ messageId: 'bridge-bootstrap', text: 'bootstrap ingress', kind: 'bootstrap' });
    await appendEgress({ messageId: 'bridge-status', text: 'runtime ready', kind: 'bootstrap' });
    emit({ type: 'bridge.initialized', channelCount: normalizedChannels.length, routeCount: normalizedRoutes.length });
    await queuePersist();
    return {
      bridgeStatePath,
      channels: [...normalizedChannels],
      defaultChannel: resolveDefaultRoute(),
      routes: [...normalizedRoutes],
      routeContracts: clone(normalizedRouteContracts),
    };
  }

  return {
    kind: 'bridge_host',
    contractVersion: 'agent-harness-bridge.v2',
    init,
    appendIngress,
    appendEgress,
    routeMessage,
    registerAgent,
    heartbeatAgent,
    deregisterAgent,
    sweepAgents,
    listAgents,
    assignAgent,
    relayToAgent,
    negotiateCapabilities,
    verifyAgentCapabilities,
    paths: { bridgeStatePath },
    getState() {
      sweepAgents();
      return {
        channels: [...normalizedChannels],
        defaultChannel: resolveDefaultRoute(),
        routes: [...normalizedRoutes],
        routeContracts: clone(normalizedRouteContracts),
        ingress: clone(ingress),
        egress: clone(egress),
        relayLog: clone(relayLog),
        agents: listAgents({ includeExpiredSweep: false }),
        capabilities: buildCapabilitiesSnapshot(Array.from(agents.values()).map((agent) => agentSnapshot(agent))),
      };
    },
  };
}

import { DEFAULT_NODE_ID, canonicalNodeId } from './team-node-ids.mjs';

function safeNode(value = '', fallback = DEFAULT_NODE_ID) {
  return canonicalNodeId(value, fallback);
}

function safeRole(value = '', fallback = 'runtime') {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return fallback;
  return s.replace(/[^a-z0-9_-]+/g, '-') || fallback;
}

function safeStatus(value = '', fallback = 'idle') {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return fallback;
  return s;
}

function inferNodeFromMember({ member = null, metadata = {}, preferredNode = DEFAULT_NODE_ID } = {}) {
  const mk = String(metadata?.memberKey || '').trim();
  const memberId = String(member?.memberId || '').trim();
  return safeNode(
    metadata?.actualNode
    || metadata?.node
    || (mk.includes('.') ? mk.split('.').slice(-1)[0] : '')
    || (memberId.includes('.') ? memberId.split('.').slice(-1)[0] : '')
    || preferredNode,
    preferredNode,
  );
}

export function createTeamResidentRuntime({ teamStore, roleDeployment, teamNodeHealth, now, idgen, defaultLeaseMs = 15 * 60 * 1000 } = {}) {
  const nowFn = typeof now === 'function' ? now : () => Date.now();
  const makeId = typeof idgen === 'function' ? idgen : ((prefix = 'id') => `${prefix}:${Date.now()}`);

  function buildResidentFromMember(member = null, opts = {}) {
    if (!member) return null;
    const metadata = member?.metadata || {};
    const role = safeRole(member?.role || opts.role || 'runtime');
    const preferredNode = safeNode(opts.preferredNode || metadata?.preferredNode || metadata?.node || DEFAULT_NODE_ID);
    const actualNode = safeNode(
      opts.actualNode
      || member?.actualNode
      || metadata?.actualNode
      || metadata?.node
      || preferredNode
      || DEFAULT_NODE_ID
    );
    const leaseUntil = Number(opts.leaseUntil ?? member?.leaseUntil ?? metadata?.leaseUntil ?? 0);
    const lastHeartbeatAt = Number(opts.lastHeartbeatAt ?? member?.lastHeartbeatAt ?? metadata?.lastHeartbeatAt ?? member?.updatedAt ?? 0);
    const expiresInMs = leaseUntil > 0 ? Math.max(0, leaseUntil - nowFn()) : 0;
    return {
      memberId: String(member?.memberId || ''),
      teamId: String(member?.teamId || ''),
      role,
      agentRef: String(member?.agentRef || ''),
      capabilities: Array.isArray(member?.capabilities) ? member.capabilities : [],
      status: safeStatus(opts.status || member?.status || metadata?.status || 'idle'),
      node: actualNode,
      preferredNode,
      requestedNode: safeNode(opts.requestedNode || metadata?.requestedNode || preferredNode || DEFAULT_NODE_ID),
      memberKey: String(opts.memberKey || metadata?.memberKey || `${role}.${actualNode}`),
      childSessionKey: String(opts.childSessionKey || metadata?.childSessionKey || ''),
      runId: String(opts.runId || metadata?.runId || ''),
      leaseUntil,
      leaseActive: leaseUntil > nowFn(),
      expiresInMs,
      lastHeartbeatAt,
      lastStartedAt: Number(opts.lastStartedAt ?? metadata?.lastStartedAt ?? 0),
      lastCompletedAt: Number(opts.lastCompletedAt ?? metadata?.lastCompletedAt ?? 0),
      lastTaskId: String(opts.lastTaskId || metadata?.lastTaskId || ''),
      degraded: Boolean(opts.degraded ?? metadata?.degraded ?? false),
      degradedReason: String(opts.degradedReason || metadata?.degradedReason || ''),
      metadata,
      createdAt: Number(member?.createdAt || 0),
      updatedAt: Number(member?.updatedAt || 0),
    };
  }

  function listResidents({ teamId = '', includeOffline = true } = {}) {
    const members = teamStore?.listMembersByTeam ? teamStore.listMembersByTeam(String(teamId || '')) : [];
    const deduped = new Map();
    for (const member of members) {
      const resident = buildResidentFromMember(member);
      if (!resident) continue;
      const key = String(resident.role || resident.memberId || '');
      const prev = deduped.get(key);
      if (!prev) {
        deduped.set(key, resident);
        continue;
      }
      const prevScore = Number(prev.lastHeartbeatAt || prev.updatedAt || 0) + (prev.status === 'busy' ? 1e15 : 0);
      const nextScore = Number(resident.lastHeartbeatAt || resident.updatedAt || 0) + (resident.status === 'busy' ? 1e15 : 0);
      if (nextScore >= prevScore) deduped.set(key, resident);
    }
    return Array.from(deduped.values()).filter((resident) => includeOffline ? true : resident.status !== 'offline');
  }

  function getResident({ teamId = '', role = '', memberId = '' } = {}) {
    const members = teamStore?.listMembersByTeam ? teamStore.listMembersByTeam(String(teamId || '')) : [];
    const byMemberId = String(memberId || '').trim();
    const byRole = safeRole(role || '');
    const hit = members.find((member) => {
      if (byMemberId && String(member?.memberId || '') === byMemberId) return true;
      if (byRole && String(member?.role || '').toLowerCase() === byRole) return true;
      return false;
    }) || null;
    return buildResidentFromMember(hit);
  }

  function ensureResidentMembers({ teamId = '', roles = [] } = {}) {
    const safeTeamId = String(teamId || '').trim();
    if (!safeTeamId || !teamStore?.listMembersByTeam || !teamStore?.createMember) return [];
    const existing = teamStore.listMembersByTeam(safeTeamId) || [];
    const out = [];

    for (const rawRole of roles) {
      const role = safeRole(rawRole || '');
      if (!role) continue;

      const deployment = roleDeployment?.get?.(role) || roleDeployment?.resolve?.(role) || null;
      const preferredNode = safeNode(deployment?.preferredNode || deployment?.selectedNode || DEFAULT_NODE_ID);
      const present = existing.find((m) => String(m?.role || '').toLowerCase() === role);

      if (present) {
        const meta = present?.metadata || {};
        const actualNode = inferNodeFromMember({ member: present, metadata: meta, preferredNode });
        const normalizedMetadata = {
          ...meta,
          resident: true,
          role,
          preferredNode,
          requestedNode: safeNode(meta?.requestedNode || preferredNode, preferredNode),
          actualNode,
          node: actualNode,
          memberKey: String(meta?.memberKey || `${role}.${actualNode}`),
          lastHeartbeatAt: Number(meta?.lastHeartbeatAt || present?.updatedAt || 0),
          leaseUntil: Number(meta?.leaseUntil || 0),
        };
        const needsBackfill = !meta?.resident
          || !String(meta?.preferredNode || '')
          || !String(meta?.actualNode || meta?.node || '')
          || !String(meta?.memberKey || '');

        const normalized = needsBackfill && teamStore?.updateMemberState
          ? teamStore.updateMemberState({
              memberId: String(present.memberId || ''),
              status: String(present.status || 'idle'),
              metadata: normalizedMetadata,
              updatedAt: nowFn(),
            })
          : { ...present, metadata: normalizedMetadata };

        out.push(buildResidentFromMember(normalized, {
          preferredNode,
          actualNode,
          memberKey: normalizedMetadata.memberKey,
          lastHeartbeatAt: normalizedMetadata.lastHeartbeatAt,
          leaseUntil: normalizedMetadata.leaseUntil,
        }));
        continue;
      }

      const memberId = `${role}.${preferredNode}`;
      const created = teamStore.createMember({
        memberId,
        teamId: safeTeamId,
        agentRef: String(deployment?.outwardIdentity || role),
        role,
        capabilities: Array.isArray(deployment?.capabilities) ? deployment.capabilities : [],
        status: 'idle',
        metadata: {
          resident: true,
          role,
          preferredNode,
          node: preferredNode,
          requestedNode: preferredNode,
          actualNode: preferredNode,
          memberKey: `${role}.${preferredNode}`,
          lastHeartbeatAt: 0,
          leaseUntil: 0,
        },
        createdAt: nowFn(),
        updatedAt: nowFn(),
      });
      out.push(buildResidentFromMember(created, {
        preferredNode,
        actualNode: preferredNode,
        memberKey: `${role}.${preferredNode}`,
        lastHeartbeatAt: 0,
        leaseUntil: 0,
      }));
    }

    return out;
  }

  function upsertResidentState({ teamId = '', role = '', memberId = '', patch = {} } = {}) {
    const safeTeamId = String(teamId || '').trim();
    const safeRoleName = safeRole(role || '');
    if (!safeTeamId || !safeRoleName) return null;

    const nowMs = nowFn();
    const deployment = roleDeployment?.resolve?.(safeRoleName) || roleDeployment?.get?.(safeRoleName) || null;
    const preferredNode = safeNode(patch.preferredNode || deployment?.preferredNode || deployment?.selectedNode || DEFAULT_NODE_ID);
    const actualNode = safeNode(patch.actualNode || patch.node || deployment?.selectedNode || preferredNode || DEFAULT_NODE_ID);
    const requestedNode = safeNode(patch.requestedNode || preferredNode || actualNode || DEFAULT_NODE_ID);
    const resolvedMemberId = String(memberId || patch.memberId || `${safeRoleName}.${preferredNode}`);

    let member = getResident({ teamId: safeTeamId, memberId: resolvedMemberId }) || getResident({ teamId: safeTeamId, role: safeRoleName });
    if (!member && teamStore?.createMember) {
      member = buildResidentFromMember(teamStore.createMember({
        memberId: resolvedMemberId,
        teamId: safeTeamId,
        agentRef: String(deployment?.outwardIdentity || safeRoleName),
        role: safeRoleName,
        capabilities: Array.isArray(deployment?.capabilities) ? deployment.capabilities : [],
        status: safeStatus(patch.status || 'idle'),
        metadata: {
          resident: true,
          role: safeRoleName,
          preferredNode,
          node: actualNode,
          requestedNode,
          actualNode,
          memberKey: String(patch.memberKey || `${safeRoleName}.${actualNode}`),
        },
        createdAt: nowMs,
        updatedAt: nowMs,
      }), {
        preferredNode,
        actualNode,
      });
    }
    if (!member) return null;

    const leaseMs = Number(patch.leaseMs ?? defaultLeaseMs);
    const leaseUntil = Number(patch.leaseUntil ?? (leaseMs > 0 ? nowMs + leaseMs : 0));
    const metadata = {
      ...(member.metadata || {}),
      resident: true,
      role: safeRoleName,
      preferredNode,
      requestedNode,
      actualNode,
      node: actualNode,
      status: safeStatus(patch.status || member.status || 'idle'),
      memberKey: String(patch.memberKey || member.memberKey || `${safeRoleName}.${actualNode}`),
      childSessionKey: String(patch.childSessionKey || member.childSessionKey || ''),
      runId: String(patch.runId || member.runId || ''),
      lastHeartbeatAt: Number(patch.lastHeartbeatAt ?? nowMs),
      lastStartedAt: Number(patch.lastStartedAt ?? member.lastStartedAt ?? 0),
      lastCompletedAt: Number(patch.lastCompletedAt ?? member.lastCompletedAt ?? 0),
      lastTaskId: String(patch.lastTaskId || member.lastTaskId || ''),
      degraded: Boolean(patch.degraded ?? member.degraded ?? false),
      degradedReason: String(patch.degradedReason || member.degradedReason || ''),
      leaseUntil,
    };

    const targetMemberId = String(member.memberId || resolvedMemberId);
    const updated = teamStore?.updateMemberState ? teamStore.updateMemberState({
      memberId: targetMemberId,
      status: metadata.status,
      metadata,
      updatedAt: nowMs,
    }) : null;

    // Keep physical lease / heartbeat columns in sync with resident metadata.
    // Overview / sweep read these columns, so metadata-only updates are insufficient.
    if (teamStore?.renewLease) {
      try {
        teamStore.renewLease({
          memberId: targetMemberId,
          leaseUntil,
          lastHeartbeatAt: Number(metadata.lastHeartbeatAt || nowMs),
          actualNode,
        });
      } catch {}
    }

    const refreshedMember = teamStore?.getMemberById ? teamStore.getMemberById(targetMemberId) : null;
    const resident = buildResidentFromMember(refreshedMember || updated || member, {
      status: metadata.status,
      actualNode,
      preferredNode,
      requestedNode,
      memberKey: metadata.memberKey,
      childSessionKey: metadata.childSessionKey,
      runId: metadata.runId,
      leaseUntil,
      lastHeartbeatAt: metadata.lastHeartbeatAt,
      lastStartedAt: metadata.lastStartedAt,
      lastCompletedAt: metadata.lastCompletedAt,
      lastTaskId: metadata.lastTaskId,
      degraded: metadata.degraded,
      degradedReason: metadata.degradedReason,
    });

    if (teamStore?.appendMailboxMessage) {
      teamStore.appendMailboxMessage({
        messageId: makeId('msg'),
        teamId: safeTeamId,
        taskId: String(patch.lastTaskId || resident.lastTaskId || member.lastTaskId || ''),
        kind: String(patch.mailboxKind || 'resident.heartbeat'),
        fromMemberId: String(resident.memberId || resolvedMemberId),
        toMemberId: '',
        broadcast: true,
        payload: {
          role: safeRoleName,
          node: actualNode,
          status: resident.status,
          memberKey: resident.memberKey,
          runId: resident.runId,
          childSessionKey: resident.childSessionKey,
          leaseUntil: resident.leaseUntil,
          degraded: resident.degraded,
          degradedReason: resident.degradedReason,
        },
        status: 'delivered',
        createdAt: nowMs,
        deliveredAt: nowMs,
      });
    }

    return resident;
  }

  function noteSessionStarted({ teamId = '', role = '', memberId = '', invocation = {}, taskId = '' } = {}) {
    const actualNode = safeNode(invocation?.effectiveNode || invocation?._routedNode || invocation?.selectedNode || invocation?.requestedNode || DEFAULT_NODE_ID);
    return upsertResidentState({
      teamId,
      role,
      memberId,
      patch: {
        status: 'busy',
        actualNode,
        requestedNode: safeNode(invocation?.requestedNode || actualNode || DEFAULT_NODE_ID),
        memberKey: `${safeRole(role)}.${actualNode}`,
        runId: String(invocation?.runId || ''),
        childSessionKey: String(invocation?.childSessionKey || ''),
        degraded: Boolean(invocation?.degraded || false),
        degradedReason: String(invocation?.degradedReason || ''),
        lastTaskId: String(taskId || ''),
        lastStartedAt: nowFn(),
        lastHeartbeatAt: nowFn(),
        mailboxKind: 'resident.session.started',
      },
    });
  }

  function noteSessionCompleted({ teamId = '', role = '', memberId = '', taskId = '', status = 'idle' } = {}) {
    return upsertResidentState({
      teamId,
      role,
      memberId,
      patch: {
        status: safeStatus(status || 'idle'),
        lastTaskId: String(taskId || ''),
        lastCompletedAt: nowFn(),
        lastHeartbeatAt: nowFn(),
        mailboxKind: 'resident.session.completed',
      },
    });
  }

  function noteHeartbeat({ teamId = '', role = '', memberId = '', taskId = '', patch = {} } = {}) {
    return upsertResidentState({
      teamId,
      role,
      memberId,
      patch: {
        ...patch,
        lastTaskId: String(taskId || patch?.lastTaskId || ''),
        lastHeartbeatAt: Number(patch?.lastHeartbeatAt || nowFn()),
        mailboxKind: String(patch?.mailboxKind || 'resident.heartbeat'),
      },
    });
  }

  function sweepResidents({ teamId = '', idleStatus = 'idle' } = {}) {
    const residents = listResidents({ teamId, includeOffline: true });
    const nowMs = nowFn();
    const swept = [];

    for (const resident of residents) {
      if (!resident) continue;
      const leaseUntil = Number(resident.leaseUntil || 0);
      if (leaseUntil > 0 && leaseUntil <= nowMs && String(resident.status || '') === 'busy') {
        const updated = upsertResidentState({
          teamId: String(resident.teamId || teamId || ''),
          role: String(resident.role || ''),
          memberId: String(resident.memberId || ''),
          patch: {
            status: safeStatus(idleStatus || 'idle'),
            leaseUntil: 0,
            lastHeartbeatAt: nowMs,
            degraded: true,
            degradedReason: 'lease_expired',
            mailboxKind: 'resident.lease.expired',
          },
        });
        if (updated) swept.push(updated);
      }
    }

    return {
      ok: true,
      observedAt: nowMs,
      count: swept.length,
      items: swept,
    };
  }

  function getResidentOverview({ teamId = '' } = {}) {
    const residents = listResidents({ teamId, includeOffline: true });
    const nodes = teamNodeHealth?.getNodeStatusSync ? teamNodeHealth.getNodeStatusSync() : { ts: nowFn() };
    return {
      observedAt: Number(nodes?.ts || nowFn()),
      count: residents.length,
      busyCount: residents.filter((x) => x.status === 'busy').length,
      activeLeaseCount: residents.filter((x) => x.leaseActive).length,
      residents,
      nodes,
    };
  }

  // P1.2: Directly update physical lease/heartbeat columns via store
  function renewResident(memberId, { leaseUntil, lastHeartbeatAt, actualNode = '' } = {}) {
    if (!teamStore?.renewLease) return null;
    const now = nowFn();
    const lease = Number(leaseUntil ?? (now + defaultLeaseMs));
    const hb = Number(lastHeartbeatAt ?? now);
    return teamStore.renewLease({
      memberId: String(memberId || ''),
      leaseUntil: lease,
      lastHeartbeatAt: hb,
      actualNode: String(actualNode || ''),
    });
  }

  // P1.2: Expire stale residents whose lease has passed
  function expireStaleResidents() {
    if (!teamStore?.expireLeases) return { ok: true, changed: 0 };
    const now = nowFn();
    const result = teamStore.expireLeases(now);
    return { ok: true, nowMs: now, changes: Number(result?.changes || 0) };
  }

  // P1.2: Get all residents with active leases from physical columns
  function getActiveResidentsFromStore(nowTimestamp) {
    if (!teamStore?.getActiveResidents) return [];
    return teamStore.getActiveResidents(nowTimestamp || nowFn());
  }

  // P1.2: Get active residents on a specific node
  function getActiveResidentsByNode(node, nowTimestamp) {
    if (!teamStore?.getActiveResidentsByNode) return [];
    return teamStore.getActiveResidentsByNode(String(node || ''), nowTimestamp || nowFn());
  }

  // P1.2: Periodic heartbeat loop — expires stale leases on interval
  let _heartbeatTimer = null;
  function startHeartbeatLoop(intervalMs = 30000) {
    if (_heartbeatTimer) return; // already running
    const safeInterval = Math.max(5000, Number(intervalMs) || 30000);
    console.log(`[team-resident-runtime] heartbeat loop started (interval=${safeInterval}ms)`);
    _heartbeatTimer = setInterval(() => {
      try {
        const result = expireStaleResidents();
        if (result.changes > 0) {
          console.log(`[team-resident-runtime] heartbeat sweep: expired ${result.changes} stale resident(s)`);
        }
      } catch (err) {
        console.error('[team-resident-runtime] heartbeat sweep error:', err?.message || err);
      }
    }, safeInterval);
    _heartbeatTimer.unref?.();
  }

  function stopHeartbeatLoop() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
      console.log('[team-resident-runtime] heartbeat loop stopped');
    }
  }

  return {
    buildResidentFromMember,
    ensureResidentMembers,
    getResident,
    listResidents,
    upsertResidentState,
    noteSessionStarted,
    noteSessionCompleted,
    noteHeartbeat,
    sweepResidents,
    getResidentOverview,
    // P1.2: Heartbeat / lease
    renewResident,
    expireStaleResidents,
    getActiveResidentsFromStore,
    getActiveResidentsByNode,
    startHeartbeatLoop,
    stopHeartbeatLoop,
  };
}

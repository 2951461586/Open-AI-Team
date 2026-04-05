import { DEFAULT_NODE_ID, canonicalNodeId } from '../team/team-node-ids.mjs';

export function tryHandleTeamResidentRoute(req, res, ctx = {}) {
  const {
    isOrchAuthorized,
    sendJson,
    handleJsonBody,
    teamResidentRuntime,
    agentLifecycle,
  } = ctx;

  // INTERNAL CONTROL-PLANE ONLY.
  // Boundary: resident heartbeat ingress for persistent workers / external node supervisors.
  if (req.method === 'POST' && req.url === '/internal/team/resident/heartbeat') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      const teamId = String(body?.teamId || '').trim();
      const role = String(body?.role || '').trim().toLowerCase();
      const memberId = String(body?.memberId || body?.memberKey || '').trim();
      if (!teamId) return { ok: false, error: 'team_id_required' };
      if (!role) return { ok: false, error: 'role_required' };

      const resident = teamResidentRuntime?.noteHeartbeat?.({
        teamId,
        role,
        memberId,
        taskId: String(body?.taskId || '').trim(),
        patch: {
          status: String(body?.status || '').trim() || undefined,
          actualNode: String(body?.actualNode || body?.node || '').trim() || undefined,
          requestedNode: String(body?.requestedNode || '').trim() || undefined,
          memberKey: String(body?.memberKey || '').trim() || undefined,
          childSessionKey: String(body?.childSessionKey || '').trim() || undefined,
          runId: String(body?.runId || '').trim() || undefined,
          degraded: typeof body?.degraded === 'boolean' ? body.degraded : undefined,
          degradedReason: String(body?.degradedReason || '').trim() || undefined,
          leaseMs: Number(body?.leaseMs || 0) || undefined,
          leaseUntil: Number(body?.leaseUntil || 0) || undefined,
          mailboxKind: String(body?.mailboxKind || 'resident.heartbeat').trim(),
        },
      }) || null;

      return {
        ok: !!resident,
        resident,
      };
    });
    return true;
  }

  // INTERNAL CONTROL-PLANE ONLY.
  // Boundary: supervisor-style lease sweep for resident workers.
  if (req.method === 'POST' && req.url === '/internal/team/resident/sweep') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      const teamId = String(body?.teamId || '').trim();
      if (!teamId) return { ok: false, error: 'team_id_required' };
      return teamResidentRuntime?.sweepResidents?.({
        teamId,
        idleStatus: String(body?.idleStatus || 'idle').trim() || 'idle',
      }) || { ok: false, error: 'resident_runtime_not_wired' };
    });
    return true;
  }

  // INTERNAL CONTROL-PLANE ONLY.
  // Boundary: agent lifecycle register / heartbeat / drain / deregister for real worker processes.
  if (req.method === 'POST' && req.url === '/internal/team/agent/register') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      if (!agentLifecycle?.register) return { ok: false, error: 'agent_lifecycle_not_wired' };
      return agentLifecycle.register({
        agentId: String(body?.agentId || body?.agent_id || '').trim(),
        role: String(body?.role || '').trim(),
        node: canonicalNodeId(String(body?.node || body?.actualNode || DEFAULT_NODE_ID).trim(), DEFAULT_NODE_ID),
        capabilities: Array.isArray(body?.capabilities) ? body.capabilities : [],
        leaseMs: Number(body?.leaseMs || body?.lease_ms || 0) || undefined,
      });
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/agent/heartbeat') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      if (!agentLifecycle?.heartbeat) return { ok: false, error: 'agent_lifecycle_not_wired' };
      return agentLifecycle.heartbeat({
        agentId: String(body?.agentId || body?.agent_id || '').trim(),
        currentTaskCount: Number.isFinite(Number(body?.currentTaskCount)) ? Number(body.currentTaskCount) : undefined,
        status: String(body?.status || '').trim() || undefined,
        leaseMs: Number(body?.leaseMs || body?.lease_ms || 0) || undefined,
      });
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/agent/drain') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      if (!agentLifecycle?.drain) return { ok: false, error: 'agent_lifecycle_not_wired' };
      return agentLifecycle.drain({
        agentId: String(body?.agentId || body?.agent_id || '').trim(),
      });
    });
    return true;
  }

  if (req.method === 'POST' && req.url === '/internal/team/agent/deregister') {
    if (!isOrchAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return true;
    }
    handleJsonBody(req, res, (body) => {
      if (!agentLifecycle?.deregister) return { ok: false, error: 'agent_lifecycle_not_wired' };
      return agentLifecycle.deregister({
        agentId: String(body?.agentId || body?.agent_id || '').trim(),
        reason: String(body?.reason || 'graceful_exit').trim(),
      });
    });
    return true;
  }

  return false;
}

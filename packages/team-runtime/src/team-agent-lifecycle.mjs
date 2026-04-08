import { DEFAULT_NODE_ID, canonicalNodeId } from './team-node-ids.mjs';

/**
 * team-agent-lifecycle.mjs
 *
 * P5: Agent lifecycle management — registration, heartbeat, graceful exit.
 * Agents actively register themselves, send periodic heartbeats,
 * and can declare graceful shutdown (drain mode).
 */

/**
 * @typedef {object} AgentRegistration
 * @property {string} agentId
 * @property {string} role
 * @property {string} node
 * @property {number} registeredAt
 * @property {number} lastHeartbeatAt
 * @property {number} leaseUntilMs - Absolute timestamp when lease expires
 * @property {'active'|'draining'|'offline'} status
 * @property {string[]} capabilities
 * @property {number} currentTaskCount - How many tasks this agent is currently handling
 */

export function createAgentLifecycleManager({
  defaultLeaseDurationMs = 5 * 60 * 1000,  // 5 minutes
  heartbeatGracePeriodMs = 90 * 1000,       // 90 seconds grace after missed heartbeat
  onAgentRegistered,
  onAgentExpired,
  onAgentDraining,
  now = () => Date.now(),
} = {}) {
  /** @type {Map<string, AgentRegistration>} */
  const agents = new Map();

  function nowMs() {
    return Number(typeof now === 'function' ? now() : Date.now());
  }

  function normalizeCapabilities(capabilities = []) {
    return Array.isArray(capabilities)
      ? [...new Set(capabilities.map((item) => String(item || '').trim()).filter(Boolean))]
      : [];
  }

  function getConfig() {
    return {
      defaultLeaseDurationMs: Number(defaultLeaseDurationMs || 0),
      heartbeatGracePeriodMs: Number(heartbeatGracePeriodMs || 0),
    };
  }

  function getAgent(agentId = '') {
    const reg = agents.get(String(agentId || '').trim());
    return reg ? { ...reg, capabilities: [...reg.capabilities] } : null;
  }

  /**
   * Register a new agent or re-register an existing one.
   */
  function register({ agentId, role, node, capabilities = [], leaseMs } = {}) {
    const id = String(agentId || '').trim();
    if (!id) return { ok: false, error: 'missing_agent_id' };

    const ts = nowMs();
    const existing = agents.get(id);
    const lease = Number(leaseMs || defaultLeaseDurationMs);
    const reg = {
      agentId: id,
      role: String(role || existing?.role || '').trim(),
      node: canonicalNodeId(String(node || existing?.node || DEFAULT_NODE_ID).trim(), DEFAULT_NODE_ID),
      registeredAt: Number(existing?.registeredAt || ts),
      lastHeartbeatAt: ts,
      leaseUntilMs: ts + lease,
      status: 'active',
      capabilities: normalizeCapabilities(capabilities.length > 0 ? capabilities : (existing?.capabilities || [])),
      currentTaskCount: Number(existing?.currentTaskCount || 0),
    };

    agents.set(id, reg);
    if (typeof onAgentRegistered === 'function') onAgentRegistered({ ...reg, capabilities: [...reg.capabilities] });
    return { ok: true, agent: { ...reg, capabilities: [...reg.capabilities] } };
  }

  /**
   * Process a heartbeat from an agent. Renews lease.
   */
  function heartbeat({ agentId, currentTaskCount, status, leaseMs } = {}) {
    const id = String(agentId || '').trim();
    const reg = agents.get(id);
    if (!reg) return { ok: false, error: 'agent_not_found' };

    const ts = nowMs();
    reg.lastHeartbeatAt = ts;
    reg.leaseUntilMs = ts + Number(leaseMs || defaultLeaseDurationMs);
    if (typeof currentTaskCount === 'number' && Number.isFinite(currentTaskCount)) reg.currentTaskCount = Number(currentTaskCount);
    if (status === 'draining') {
      reg.status = 'draining';
      if (typeof onAgentDraining === 'function') onAgentDraining({ ...reg, capabilities: [...reg.capabilities] });
    } else if (status === 'active') {
      reg.status = 'active';
    }
    return { ok: true, agent: { ...reg, capabilities: [...reg.capabilities] } };
  }

  /**
   * Graceful exit — agent declares it's shutting down.
   * Marks as offline and removes from active registry.
   */
  function deregister({ agentId, reason = 'graceful_exit' } = {}) {
    const id = String(agentId || '').trim();
    const reg = agents.get(id);
    if (!reg) return { ok: false, error: 'agent_not_found' };

    reg.status = 'offline';
    reg.leaseUntilMs = 0;
    agents.delete(id);
    return { ok: true, agentId: id, reason, agent: { ...reg, capabilities: [...reg.capabilities] } };
  }

  /**
   * Drain an agent — mark it as draining so no new tasks route to it,
   * but let current tasks finish.
   */
  function drain({ agentId } = {}) {
    const id = String(agentId || '').trim();
    const reg = agents.get(id);
    if (!reg) return { ok: false, error: 'agent_not_found' };

    reg.status = 'draining';
    if (typeof onAgentDraining === 'function') onAgentDraining({ ...reg, capabilities: [...reg.capabilities] });
    return { ok: true, agent: { ...reg, capabilities: [...reg.capabilities] } };
  }

  /**
   * Sweep expired agents (lease expired + grace period).
   * Should be called periodically (e.g., every 30s).
   */
  function sweepExpired() {
    const ts = nowMs();
    const expired = [];
    for (const [id, reg] of agents) {
      if (reg.leaseUntilMs > 0 && (ts > reg.leaseUntilMs + heartbeatGracePeriodMs)) {
        expired.push({ ...reg, capabilities: [...reg.capabilities] });
        agents.delete(id);
        if (typeof onAgentExpired === 'function') onAgentExpired({ ...reg, capabilities: [...reg.capabilities] });
      }
    }
    return expired;
  }

  /**
   * Get all active (non-expired, non-draining) agents for a role on a node.
   */
  function getActiveAgents({ role, node } = {}) {
    const ts = nowMs();
    const result = [];
    for (const reg of agents.values()) {
      if (reg.status !== 'active') continue;
      if (reg.leaseUntilMs > 0 && ts > reg.leaseUntilMs) continue;
      if (role && reg.role !== String(role || '')) continue;
      if (node && reg.node !== String(node || '')) continue;
      result.push({ ...reg, capabilities: [...reg.capabilities] });
    }
    return result;
  }

  /**
   * Check if a specific agent is available for new tasks.
   */
  function isAvailable(agentId = '') {
    const reg = agents.get(String(agentId || '').trim());
    if (!reg) return false;
    if (reg.status !== 'active') return false;
    const ts = nowMs();
    return reg.leaseUntilMs <= 0 || ts <= reg.leaseUntilMs;
  }

  /**
   * Get a snapshot of all registered agents.
   */
  function snapshot() {
    return Array.from(agents.values()).map((reg) => ({ ...reg, capabilities: [...reg.capabilities] }));
  }

  function stats() {
    const items = snapshot();
    return {
      count: items.length,
      activeCount: items.filter((item) => item.status === 'active').length,
      drainingCount: items.filter((item) => item.status === 'draining').length,
      byRole: Object.fromEntries(items.reduce((acc, item) => {
        const key = String(item.role || 'unknown');
        acc.set(key, Number(acc.get(key) || 0) + 1);
        return acc;
      }, new Map()).entries()),
      byNode: Object.fromEntries(items.reduce((acc, item) => {
        const key = String(item.node || 'unknown');
        acc.set(key, Number(acc.get(key) || 0) + 1);
        return acc;
      }, new Map()).entries()),
    };
  }

  return {
    register,
    heartbeat,
    deregister,
    drain,
    sweepExpired,
    getActiveAgents,
    isAvailable,
    getConfig,
    getAgent,
    snapshot,
    stats,
  };
}

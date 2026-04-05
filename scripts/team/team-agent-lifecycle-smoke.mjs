import { createAgentLifecycleManager } from '../../src/team/team-agent-lifecycle.mjs';

let passed = 0;
let failed = 0;
function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
    passed += 1;
  } else {
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

let nowCursor = 1_700_000_000_000;
const now = () => nowCursor;
const expiredEvents = [];
const drainingEvents = [];
const registeredEvents = [];

const lifecycle = createAgentLifecycleManager({
  defaultLeaseDurationMs: 1000,
  heartbeatGracePeriodMs: 200,
  now,
  onAgentExpired: (reg) => expiredEvents.push(reg.agentId),
  onAgentDraining: (reg) => drainingEvents.push(reg.agentId),
  onAgentRegistered: (reg) => registeredEvents.push(reg.agentId),
});

const registered = lifecycle.register({
  agentId: 'agent:1',
  role: 'executor',
  node: 'violet',
  capabilities: ['execute', 'execute'],
});
assert(registered.ok === true, 'register ok');
assert(lifecycle.snapshot().length === 1, 'snapshot has 1 agent');
assert(lifecycle.getAgent('agent:1')?.capabilities?.length === 1, 'capabilities deduped');
assert(lifecycle.isAvailable('agent:1') === true, 'agent available after register');
assert(registeredEvents.includes('agent:1'), 'register callback fired');

nowCursor += 500;
const hb = lifecycle.heartbeat({ agentId: 'agent:1', currentTaskCount: 2, status: 'active' });
assert(hb.ok === true, 'heartbeat ok');
assert(lifecycle.getAgent('agent:1')?.currentTaskCount === 2, 'heartbeat updates task count');
assert(lifecycle.getActiveAgents({ role: 'executor', node: 'violet' }).length === 1, 'getActiveAgents filters role+node');

const drained = lifecycle.drain({ agentId: 'agent:1' });
assert(drained.ok === true, 'drain ok');
assert(lifecycle.isAvailable('agent:1') === false, 'draining agent unavailable');
assert(drainingEvents.includes('agent:1'), 'drain callback fired');

const reRegistered = lifecycle.register({ agentId: 'agent:1', role: 'executor', node: 'violet' });
assert(reRegistered.ok === true, 're-register ok');
assert(lifecycle.getAgent('agent:1')?.status === 'active', 're-register resets status to active');

nowCursor += 1301;
const expired = lifecycle.sweepExpired();
assert(expired.length === 1, 'expired agent swept');
assert(expiredEvents.includes('agent:1'), 'expired callback fired');
assert(lifecycle.snapshot().length === 0, 'snapshot empty after sweep');

lifecycle.register({ agentId: 'agent:2', role: 'critic', node: 'lebang' });
const dereg = lifecycle.deregister({ agentId: 'agent:2', reason: 'shutdown' });
assert(dereg.ok === true, 'deregister ok');
assert(lifecycle.snapshot().length === 0, 'deregister removes agent');

const stats = lifecycle.stats();
assert(stats.count === 0, 'stats reflect empty registry');
assert(lifecycle.getConfig().defaultLeaseDurationMs === 1000, 'getConfig exposes lease');
assert(lifecycle.getConfig().heartbeatGracePeriodMs === 200, 'getConfig exposes grace');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

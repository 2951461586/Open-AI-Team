import assert from 'node:assert/strict';
import { createAgentLifecycleManager } from '../../src/team/team-agent-lifecycle.mjs';

test('Agent lifecycle manager tracks register, drain, heartbeat, and expiry', () => {
  let now = 1000;
  const expired = [];
  const manager = createAgentLifecycleManager({
    defaultLeaseDurationMs: 100,
    heartbeatGracePeriodMs: 50,
    onAgentExpired(agent) { expired.push(agent.agentId); },
    now: () => now,
  });
  const reg = manager.register({ agentId: 'agent-1', role: 'executor', node: 'n1', capabilities: ['run'] });
  assert.equal(reg.ok, true);
  assert.equal(manager.isAvailable('agent-1'), true);
  const drain = manager.drain({ agentId: 'agent-1' });
  assert.equal(drain.agent.status, 'draining');
  manager.heartbeat({ agentId: 'agent-1', status: 'active', currentTaskCount: 2 });
  assert.equal(manager.getAgent('agent-1').status, 'active');
  now = 1200;
  assert.equal(manager.sweepExpired().length, 1);
  assert.deepEqual(expired, ['agent-1']);
  assert.equal(manager.isAvailable('agent-1'), false);
});

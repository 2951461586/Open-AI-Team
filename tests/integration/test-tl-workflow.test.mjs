import assert from 'node:assert/strict';
import { createTLRuntime } from '../../src/team/team-tl-runtime.mjs';
import { createInMemoryTeamStore, createNativeChatStub, createIdGenerator } from '../helpers/test-helpers.mjs';

function createGovernanceRuntime() {
  return {
    shouldSkipStage() { return { skip: false }; },
  };
}

test('TL runtime returns direct reply for non-delegated decisions', async () => {
  const teamStore = createInMemoryTeamStore();
  const directReply = '直接答复';
  const nativeChat = createNativeChatStub({ reply: directReply });
  const runtime = createTLRuntime({
    teamStore,
    nativeChat,
    governanceRuntime: createGovernanceRuntime(),
    roleConfig: { roles: { executor: { displayName: '执行者', capabilities: ['implementation'] } } },
    now: () => 1000,
    idgen: createIdGenerator(),
  });
  const result = await runtime.handleTeamRun({ text: '你好', scopeKey: 'test' });
  assert.equal(result.ok, true);
  assert.equal(result.action, 'tl_direct');
  assert.equal(result.reply, directReply);
  assert.equal(teamStore.tasks.size, 0);
});

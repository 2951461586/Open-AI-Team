import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelRouter, estimateComplexity } from '../../src/agent-harness-core/model-router.mjs';

test('ModelRouter routes short simple text to utility', () => {
  const info = estimateComplexity('帮我润色一句话');
  assert.equal(info.bucket, 'utility');
});

test('ModelRouter routes normal conversation to chat', () => {
  const router = new ModelRouter({ config: {
    default: {
      chat: { provider: 'openai', model: 'chat-model' },
      utility: { provider: 'openai', model: 'utility-model' },
      reasoning: { provider: 'openai', model: 'reasoning-model' },
    },
    fallback: {
      chat: { provider: 'openai', model: 'chat-fallback' },
      utility: { provider: 'openai', model: 'utility-fallback' },
      reasoning: { provider: 'openai', model: 'reasoning-fallback' },
    },
  } });
  const out = router.route('我们来讨论一下这个需求怎么拆比较合适，先不用写代码。');
  assert.equal(out.preset, 'chat');
  assert.equal(out.primary.model, 'chat-model');
});

test('ModelRouter routes complex code-like text to reasoning', () => {
  const out = estimateComplexity('请分析这段代码为什么报错\n```js\nfunction main() { throw new Error("boom") }\n```\n并给出重构方案');
  assert.equal(out.bucket, 'reasoning');
});

test('ModelRouter supports routeWithPreferred override', () => {
  const router = new ModelRouter({ config: {
    default: {
      chat: { provider: 'openai', model: 'chat-model' },
      utility: { provider: 'openai', model: 'utility-model' },
      reasoning: { provider: 'openai', model: 'reasoning-model' },
    },
    fallback: {
      chat: { provider: 'openai', model: 'chat-fallback' },
      utility: { provider: 'openai', model: 'utility-fallback' },
      reasoning: { provider: 'openai', model: 'reasoning-fallback' },
    },
  } });
  const out = router.routeWithPreferred('forced-model', '随便聊聊');
  assert.equal(out.primary.model, 'forced-model');
  assert.equal(out.preferredModelId, 'forced-model');
});

test('ModelRouter falls back when primary model fails', async () => {
  const seen = [];
  const router = new ModelRouter({
    config: {
      default: {
        chat: { provider: 'openai', model: 'chat-model' },
        utility: { provider: 'openai', model: 'utility-model' },
        reasoning: { provider: 'openai', model: 'reasoning-model' },
      },
      fallback: {
        chat: { provider: 'openai', model: 'chat-fallback' },
        utility: { provider: 'openai', model: 'utility-fallback' },
        reasoning: { provider: 'openai', model: 'reasoning-fallback' },
      },
    },
    invoker: async ({ model }) => {
      seen.push(model);
      if (model === 'chat-model') throw new Error('primary_failed');
      return { ok: true, reply: 'ok', model, tokenUsage: { total_tokens: 12 }, latencyMs: 5, cost: 0.001 };
    },
  });
  const result = await router.execute({ text: '这是一段普通对话，长度适中，适合主聊天模型处理。' });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'chat-fallback');
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(seen, ['chat-model', 'chat-fallback']);
});

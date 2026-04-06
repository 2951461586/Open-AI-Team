import assert from 'node:assert/strict';
import path from 'node:path';
import { buildAgentSystemPrompt, getPersonalityTemplate, resolveAgentPersonality } from '../../src/team/agent-personality.mjs';

const registryPath = path.resolve('tests/fixtures/personalities-fixture.json');

test('Personality registry resolves fallback and scenario override', () => {
  const tpl = getPersonalityTemplate('missing', { registryPath });
  assert.equal(tpl.id, 'executor');
  const resolved = resolveAgentPersonality({ personality: { active: 'executor', templates: ['executor'] } }, { registryPath, scenario: 'incident' });
  assert.equal(resolved.personalityId, 'executor');
  assert.equal(resolved.personality.tone, '冷静');
  assert.equal(resolved.source, 'scenario_override');
});

test('Personality builder injects prompt metadata', () => {
  const built = buildAgentSystemPrompt({
    agentName: 'Violet',
    role: 'executor',
    rolePrompt: '你是执行者。',
    roleConfig: { personality: { active: 'executor', templates: ['executor'] } },
    registryPath,
    scenario: 'incident',
  });
  assert.match(built.systemPrompt, /执行者|务实|冷静|短句/);
  assert.equal(built.personalityId, 'executor');
  assert.equal(Array.isArray(built.availablePersonalities), true);
});

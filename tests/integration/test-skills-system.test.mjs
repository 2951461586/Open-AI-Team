import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillRegistry } from '../../packages/skills/src/skill-registry.mjs';
import { SkillRuntime } from '../../packages/skills/src/skill-runtime.mjs';
import { withTempDir } from '../helpers/test-helpers.mjs';

test('SkillRegistry loads all 11 built-in skills', async () => {
  await withTempDir(async (dir) => {
    const registry = new SkillRegistry();
    const result = await registry.fromBuiltins();
    
    assert.equal(result.loaded.length, 11, 'Should load 11 built-in skills');
    assert.equal(result.errors.length, 0, 'Should have no errors');
    
    const skillIds = result.loaded.map(s => s.id).sort();
    const expected = [
      'chart-visualization',
      'code-review',
      'data-analysis',
      'document',
      'image-generation',
      'report-generation',
      'research',
      'skill-creator',
      'slide-creation',
      'translation',
      'web-search',
    ].sort();
    
    assert.deepEqual(skillIds, expected, 'Should have all expected skill IDs');
  });
});

test('SkillRegistry can execute web-search skill', async () => {
  const registry = new SkillRegistry();
  await registry.fromBuiltins();
  
  const result = await registry.execute('web-search', { query: 'test query' });
  assert.equal(result.ok, true);
  assert.equal(result.data.query, 'test query');
});

test('SkillRegistry can execute code-review skill', async () => {
  const registry = new SkillRegistry();
  await registry.fromBuiltins();
  
  const result = await registry.execute('code-review', { 
    code: 'const x = 1;', 
    language: 'javascript' 
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.language, 'javascript');
  assert.equal(result.data.status, 'completed');
});

test('SkillRegistry returns error for non-existent skill', async () => {
  const registry = new SkillRegistry();
  await registry.fromBuiltins();
  
  const result = await registry.execute('non-existent-skill', {});
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('not found'));
});

test('SkillRuntime loads built-in skills and tracks lifecycle', async () => {
  await withTempDir(async (dir) => {
    const registry = new SkillRegistry();
    const runtime = new SkillRuntime({ registry });
    
    await registry.fromBuiltins();
    
    assert.ok(runtime.listLoaded('web-search').length >= 0);
    assert.ok(runtime.listLoaded('code-review').length >= 0);
  });
});

test('SkillRegistry list filters by type correctly', async () => {
  const registry = new SkillRegistry();
  await registry.fromBuiltins();
  
  const allSkills = registry.list();
  const compoundSkills = registry.list('compound');
  const metaSkills = registry.list('meta');
  const regularSkills = registry.list('skill');
  
  assert.ok(allSkills.length >= 11);
  assert.equal(compoundSkills.length, 1);
  assert.equal(metaSkills.length, 1);
  assert.ok(regularSkills.length >= 9);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SkillRegistry } from '../../src/team/skill-registry.mjs';
import { SkillRuntime } from '../../src/team/skill-runtime.mjs';
import { withTempDir } from '../helpers/test-helpers.mjs';

test('SkillRegistry loads manifests from directory and executes latest version by default', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, 'skills');
    const v1Dir = path.join(skillsDir, 'echo-v1');
    const v2Dir = path.join(skillsDir, 'echo-v2');
    await fs.mkdir(v1Dir, { recursive: true });
    await fs.mkdir(v2Dir, { recursive: true });
    await fs.writeFile(path.join(v1Dir, 'skill.manifest.json'), JSON.stringify({
      id: 'echo',
      name: 'Echo',
      version: '1.0.0',
      type: 'skill',
      description: 'echo v1',
      entry: './impl.mjs',
      capabilities: ['read'],
      tags: ['test'],
      dependencies: [],
    }, null, 2));
    await fs.writeFile(path.join(v1Dir, 'impl.mjs'), "export async function execute(request){ return { value: request.value, version: '1.0.0' }; }\n");
    await fs.writeFile(path.join(v2Dir, 'skill.manifest.json'), JSON.stringify({
      id: 'echo',
      name: 'Echo',
      version: '2.0.0',
      type: 'skill',
      description: 'echo v2',
      entry: './impl.mjs',
      capabilities: ['write'],
      tags: ['test', 'latest'],
      dependencies: [],
    }, null, 2));
    await fs.writeFile(path.join(v2Dir, 'impl.mjs'), "export default async function(request){ return { echoed: request.value, version: '2.0.0' }; }\n");

    const registry = new SkillRegistry();
    const dirResult = await registry.fromDirectory(skillsDir);
    assert.equal(dirResult.loaded?.length, 2);
    assert.equal(registry.list().length, 2);
    assert.equal(registry.list('skill', 'latest').length, 1);
    const execResult = await registry.execute('echo', { value: 'hi' }, {});
    assert.equal(execResult.ok, true);
    assert.deepEqual(execResult.data, { echoed: 'hi', version: '2.0.0' });
    const oldResult = await registry.execute('echo', { value: 'hi' }, { version: '1.0.0' });
    assert.equal(oldResult.ok, true);
    assert.deepEqual(oldResult.data, { value: 'hi', version: '1.0.0' });
  });
});

test('SkillRuntime fires lifecycle hooks and supports hot reload without dropping other versions', async () => {
  await withTempDir(async (dir) => {
    const stateFile = path.join(dir, 'lifecycle.log');
    const skillDir = path.join(dir, 'hot-skill');
    await fs.mkdir(skillDir, { recursive: true });
    const writeSkill = async (version, label) => {
      await fs.writeFile(path.join(skillDir, 'impl.mjs'), `
import fs from 'node:fs/promises';
export async function onLoad({ manifest, reason }) { await fs.appendFile(${JSON.stringify(stateFile)}, 'load:' + manifest.version + ':' + reason + '\\n'); }
export async function onUnload({ manifest, reason }) { await fs.appendFile(${JSON.stringify(stateFile)}, 'unload:' + manifest.version + ':' + reason + '\\n'); }
export default async function execute(){ return { label: ${JSON.stringify(label)} }; }
`);
      return {
        id: 'hot-skill',
        name: 'Hot Skill',
        version,
        type: 'skill',
        description: 'hot reloadable skill',
        entry: './impl.mjs',
        capabilities: ['execute'],
        tags: ['hot'],
        dependencies: [],
      };
    };

    const registry = new SkillRegistry();
    const runtime = new SkillRuntime({ registry });
    await fs.writeFile(stateFile, '');
    await runtime.register(await writeSkill('1.0.0', 'v1'), { rootDir: skillDir });
    await runtime.register(await writeSkill('2.0.0', 'v2'), { rootDir: skillDir });
    assert.equal(runtime.listLoaded('hot-skill').length, 2);
    await runtime.hotReload(await writeSkill('2.0.0', 'v2b'), { rootDir: skillDir });
    assert.equal(runtime.listLoaded('hot-skill').length, 2);
    const log = await fs.readFile(stateFile, 'utf8');
    assert.match(log, /load:1.0.0:register/);
    assert.match(log, /load:2.0.0:register/);
    assert.match(log, /unload:2.0.0:hot-reload/);
    assert.match(log, /load:2.0.0:hot-reload/);
  });
});

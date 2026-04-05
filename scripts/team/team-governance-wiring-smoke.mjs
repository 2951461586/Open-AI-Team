/**
 * team-governance-wiring-smoke.mjs
 *
 * Verifies that app bootstrap and runtime wiring resolve the canonical
 * team governance config path instead of falling back to legacy defaults.
 */

import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const canonicalPath = join(__dirname, '..', '..', 'config', 'team', 'governance.json');

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

const explicitRt = createGovernanceRuntime(canonicalPath);
const explicitMeta = explicitRt.getConfigMeta();
assert(explicitMeta.loaded === true, 'explicit governance config loads');
assert(explicitMeta.path === canonicalPath, 'explicit path matches canonical file', explicitMeta.path);
assert(explicitMeta.version === '2.0.0', 'explicit config version is 2.0.0');
assert(explicitMeta.usedFallback === false, 'explicit load does not use fallback');

const defaultRt = createGovernanceRuntime();
const defaultMeta = defaultRt.getConfigMeta();
assert(defaultMeta.loaded === true, 'default governance config loads');
assert(defaultMeta.path === canonicalPath, 'default loader resolves canonical team governance path', defaultMeta.path);
assert(defaultMeta.version === '2.0.0', 'default loader version is 2.0.0');
assert(defaultMeta.usedFallback === false, 'default loader does not fall back to legacy path');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

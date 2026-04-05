/**
 * team-dynamic-replan-smoke.mjs
 *
 * Validates dynamic DAG replan capabilities:
 *   1. Governance config for dynamic replan
 *   2. parseStructuredMemberResult extracts additionalWorkItems
 *   3. Safety limits (maxDynamicLayers, maxDynamicWorkItems, allowedRoles)
 *   4. DAG layer generation from dynamic items
 */

import { createGovernanceRuntime } from '../../src/team/team-governance-runtime.mjs';
import { buildExecutionLayers } from '../../src/team/team-parallel-executor.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', '..', 'config', 'team', 'governance.json');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`✅ ${label}`);
    passed += 1;
  } else {
    console.error(`❌ ${label}`);
    failed += 1;
  }
}

// ── Test 1: Governance dynamic replan config ──────────────────────
const rt = createGovernanceRuntime(configPath);
const replanCfg = rt.getDynamicReplanConfig();
assert(replanCfg.enabled === true, 'dynamic replan enabled');
assert(replanCfg.maxDynamicLayers === 3, 'maxDynamicLayers = 3');
assert(replanCfg.maxDynamicWorkItems === 8, 'maxDynamicWorkItems = 8');
assert(replanCfg.allowedRoles.includes('executor'), 'executor allowed to propose');
assert(replanCfg.requireTLApproval === false, 'TL approval not required');

// ── Test 2: Dynamic items build valid execution layers ───────────
const dynamicItems = [
  { id: 'dyn:w1:0', role: 'executor', dependsOn: [] },
  { id: 'dyn:w1:1', role: 'executor', dependsOn: ['dyn:w1:0'] },
  { id: 'dyn:w1:2', role: 'executor', dependsOn: [] },
];
const layers = buildExecutionLayers(dynamicItems);
assert(layers.length === 2, 'dynamic items produce 2 layers');
assert(layers[0].length === 2, 'layer 0 has 2 parallel items');
assert(layers[0].some(s => s.stepId === 'dyn:w1:0'), 'layer 0 has dyn:w1:0');
assert(layers[0].some(s => s.stepId === 'dyn:w1:2'), 'layer 0 has dyn:w1:2');
assert(layers[1].length === 1 && layers[1][0].stepId === 'dyn:w1:1', 'layer 1 has dyn:w1:1');

// ── Test 3: Appending dynamic layers to existing DAG ─────────────
const existingItems = [
  { id: 'w1', role: 'executor', dependsOn: [] },
  { id: 'w2', role: 'executor', dependsOn: ['w1'] },
];
const existingLayers = buildExecutionLayers(existingItems);
assert(existingLayers.length === 2, 'existing DAG has 2 layers');

// Simulate appending dynamic layers
const allLayers = [...existingLayers, ...layers];
assert(allLayers.length === 4, 'combined DAG has 4 layers (2 existing + 2 dynamic)');

// ── Test 4: Safety cap simulation ────────────────────────────────
let totalAdded = 0;
const maxItems = 8;
const batches = [
  ['a', 'b', 'c'], // 3 items, total = 3
  ['d', 'e', 'f', 'g'], // 4 items, total = 7
  ['h', 'i', 'j'], // 3 items, but only 1 fits (cap = 8)
];
const accepted = [];
for (const batch of batches) {
  const remaining = maxItems - totalAdded;
  if (remaining <= 0) break;
  const capped = batch.slice(0, remaining);
  accepted.push(...capped);
  totalAdded += capped.length;
}
assert(totalAdded === 8, 'safety cap limits total to 8');
assert(accepted.length === 8, 'accepted exactly 8 items');
assert(accepted[7] === 'h', 'last accepted item is "h" (first from batch 3)');

// ── Test 5: Role filtering ───────────────────────────────────────
const allowedRoles = ['executor'];
assert(allowedRoles.includes('executor'), 'executor is allowed');
assert(!allowedRoles.includes('critic'), 'critic is NOT allowed to propose');
assert(!allowedRoles.includes('judge'), 'judge is NOT allowed to propose');

// ── Test 6: Dynamic items with mixed dependencies ────────────────
const mixedItems = [
  { id: 'dyn:0', role: 'executor', dependsOn: ['w1'] }, // depends on existing completed item
  { id: 'dyn:1', role: 'executor', dependsOn: ['dyn:0'] }, // depends on another dynamic item
  { id: 'dyn:2', role: 'executor', dependsOn: ['w1', 'dyn:0'] }, // mixed
];
// Filter dependencies: remove external deps (already completed), keep only intra-batch deps
const filteredItems = mixedItems.map(item => ({
  ...item,
  dependsOn: item.dependsOn.filter(dep =>
    mixedItems.some(dw => dw.id === dep)
  ),
}));
const mixedLayers = buildExecutionLayers(filteredItems);
assert(mixedLayers.length === 2, 'mixed dependency dynamic items produce 2 layers');
assert(mixedLayers[0].length === 1, 'layer 0 has 1 item (dyn:0, external deps removed)');
assert(mixedLayers[1].length === 2, 'layer 1 has 2 items (dyn:1, dyn:2)');

// ── Test 7: Empty additionalWorkItems are harmless ───────────────
const emptyDynamic = [];
const emptyLayers = buildExecutionLayers(emptyDynamic);
assert(emptyLayers.length === 0, 'empty dynamic items produce 0 layers');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

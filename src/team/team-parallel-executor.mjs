/**
 * team-parallel-executor.mjs
 *
 * P3/P4: Parallel sub-task execution engine + DAG validation.
 * Takes a plan with DAG-structured steps and dispatches independent steps in parallel.
 *
 * Step schema:
 * {
 *   stepId: string,
 *   title: string,
 *   description: string,
 *   dependsOn: string[],   // stepIds this step depends on (empty = root/independent)
 *   node?: string,          // preferred node for this step
 *   status: 'pending' | 'running' | 'done' | 'failed' | 'skipped',
 * }
 */

function normalizeSteps(steps = []) {
  return Array.isArray(steps)
    ? steps.map((step, index) => ({
        ...step,
        stepId: String(step?.stepId || step?.id || '').trim(),
        dependsOn: Array.isArray(step?.dependsOn)
          ? [...new Set(step.dependsOn.map((dep) => String(dep || '').trim()).filter(Boolean))]
          : [],
        _index: index,
      }))
    : [];
}

/**
 * Validate a DAG before execution.
 * Fails on:
 * - missing / duplicate step ids
 * - self dependencies
 * - missing dependencies
 * - cycles / unsatisfied dependency chains
 *
 * @param {Array} steps
 * @param {object} opts
 * @param {Array<string>} opts.allowExternalDeps - dependencies already satisfied outside this batch
 * @returns {{ ok: boolean, steps: Array, layers: Array<Array>, errors: Array<object> }}
 */
export function validateExecutionDag(steps = [], opts = {}) {
  const normalized = normalizeSteps(steps);
  const allowExternalDeps = new Set(
    Array.isArray(opts?.allowExternalDeps)
      ? opts.allowExternalDeps.map((dep) => String(dep || '').trim()).filter(Boolean)
      : []
  );

  if (normalized.length === 0) {
    return { ok: true, steps: [], layers: [], errors: [] };
  }

  const stepMap = new Map();
  const errors = [];

  for (const step of normalized) {
    if (!step.stepId) {
      errors.push({
        code: 'missing_step_id',
        message: 'stepId is required',
        index: step._index,
      });
      continue;
    }

    if (stepMap.has(step.stepId)) {
      errors.push({
        code: 'duplicate_step_id',
        message: `duplicate stepId: ${step.stepId}`,
        stepId: step.stepId,
        index: step._index,
      });
      continue;
    }

    stepMap.set(step.stepId, step);
  }

  for (const step of stepMap.values()) {
    for (const dep of step.dependsOn) {
      if (dep === step.stepId) {
        errors.push({
          code: 'self_dependency',
          message: `step ${step.stepId} depends on itself`,
          stepId: step.stepId,
          dependency: dep,
        });
        continue;
      }

      if (!stepMap.has(dep) && !allowExternalDeps.has(dep)) {
        errors.push({
          code: 'missing_dependency',
          message: `step ${step.stepId} depends on missing step ${dep}`,
          stepId: step.stepId,
          dependency: dep,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, steps: [...stepMap.values()], layers: [], errors };
  }

  const completed = new Set(allowExternalDeps);
  const layers = [];
  const remaining = new Map(stepMap);

  while (remaining.size > 0) {
    const layer = [];

    for (const step of remaining.values()) {
      const depsReady = step.dependsOn.every((dep) => completed.has(dep));
      if (depsReady) layer.push(step);
    }

    if (layer.length === 0) {
      for (const step of remaining.values()) {
        errors.push({
          code: 'dependency_cycle',
          message: `step ${step.stepId} is blocked by unresolved dependencies`,
          stepId: step.stepId,
          unresolvedDependencies: step.dependsOn.filter((dep) => !completed.has(dep)),
        });
      }
      return { ok: false, steps: [...stepMap.values()], layers, errors };
    }

    layers.push(layer);
    for (const step of layer) {
      completed.add(step.stepId);
      remaining.delete(step.stepId);
    }
  }

  return { ok: true, steps: [...stepMap.values()], layers, errors: [] };
}

/**
 * Build execution layers from a DAG of steps.
 * Each layer contains steps whose dependencies are all satisfied.
 * Steps within the same layer can execute in parallel.
 *
 * NOTE: invalid DAGs no longer get force-included as a final layer.
 * Call validateExecutionDag() when you need explicit error reasons.
 *
 * @param {Array} steps - Plan steps with { stepId, dependsOn: [] }
 * @param {object} opts
 * @returns {Array<Array>} - Layers of steps, each layer is parallelizable
 */
export function buildExecutionLayers(steps = [], opts = {}) {
  return validateExecutionDag(steps, opts).layers;
}

/**
 * Execute a plan's steps respecting DAG dependencies.
 * Steps in the same layer run in parallel via Promise.all.
 *
 * @param {object} opts
 * @param {Array} opts.steps - Plan steps with DAG structure
 * @param {function} opts.executeStep - async (step, context) => { ok, result, error }
 * @param {function} opts.onStepStarted - (step, layerIndex) => void
 * @param {function} opts.onStepCompleted - (step, result, layerIndex) => void
 * @param {function} opts.onLayerCompleted - (layer, layerIndex, results) => void
 * @param {object} opts.context - Passed to executeStep
 * @param {Array<string>} opts.allowExternalDeps - dependencies already satisfied outside this batch
 * @returns {Promise<{ ok: boolean, layers: Array, results: Map, errors: Array }>}
 */
export async function executeParallelPlan({
  steps = [],
  executeStep,
  onStepStarted,
  onStepCompleted,
  onLayerCompleted,
  context = {},
  allowExternalDeps = [],
} = {}) {
  if (typeof executeStep !== 'function') {
    return { ok: false, layers: [], results: new Map(), errors: [{ error: 'executeStep_not_configured' }] };
  }

  const validation = validateExecutionDag(steps, { allowExternalDeps });
  if (!validation.ok) {
    return {
      ok: false,
      layers: validation.layers || [],
      results: new Map(),
      errors: validation.errors || [{ error: 'invalid_dag' }],
      totalSteps: Array.isArray(steps) ? steps.length : 0,
      completedSteps: 0,
      failedSteps: validation.errors?.length || 1,
      error: 'invalid_dag',
    };
  }

  const layers = validation.layers;
  const results = new Map();
  const errors = [];

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];

    // Dispatch all steps in this layer in parallel
    const promises = layer.map(async (step) => {
      if (typeof onStepStarted === 'function') onStepStarted(step, layerIdx);

      try {
        const result = await executeStep(step, { ...context, layerIndex: layerIdx, completedResults: results });
        results.set(step.stepId, result);
        if (typeof onStepCompleted === 'function') onStepCompleted(step, result, layerIdx);

        if (!result?.ok) {
          errors.push({ stepId: step.stepId, error: result?.error || 'step_failed', layerIndex: layerIdx });
        }
        return result;
      } catch (err) {
        const errorResult = { ok: false, error: String(err?.message || err || 'step_exception') };
        results.set(step.stepId, errorResult);
        errors.push({ stepId: step.stepId, error: errorResult.error, layerIndex: layerIdx });
        if (typeof onStepCompleted === 'function') onStepCompleted(step, errorResult, layerIdx);
        return errorResult;
      }
    });

    const layerResults = await Promise.all(promises);
    if (typeof onLayerCompleted === 'function') onLayerCompleted(layer, layerIdx, layerResults);
  }

  return {
    ok: errors.length === 0,
    layers,
    results,
    errors,
    totalSteps: steps.length,
    completedSteps: results.size,
    failedSteps: errors.length,
  };
}

/**
 * Check if a plan's steps have DAG structure (any step has dependsOn).
 * If not, treat all steps as sequential (each depends on the previous).
 */
export function hasDagStructure(steps = []) {
  return Array.isArray(steps) && steps.some((s) => Array.isArray(s.dependsOn) && s.dependsOn.length > 0);
}

/**
 * Convert a flat sequential step list into a linear DAG (each step depends on the previous).
 */
export function linearizeToDag(steps = []) {
  return steps.map((step, idx) => ({
    ...step,
    stepId: String(step.stepId || step.id || `step_${idx}`),
    dependsOn: idx === 0 ? [] : [String(steps[idx - 1].stepId || steps[idx - 1].id || `step_${idx - 1}`)],
  }));
}

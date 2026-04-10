export const MODEL_CAPABILITIES = {
  REASONING: 'reasoning',
  LONG_CONTEXT: 'long_context',
  MULTIMODAL: 'multimodal',
  FAST: 'fast',
  CODE: 'code',
  FUNCTION_CALLING: 'function_calling',
  JSON_MODE: 'json_mode',
};

export const TASK_TYPES = {
  CHAT: 'chat',
  UTILITY: 'utility',
  REASONING: 'reasoning',
  CODE_GENERATION: 'code_generation',
  CODE_REVIEW: 'code_review',
  RESEARCH: 'research',
  SUMMARIZATION: 'summarization',
  CREATIVE: 'creative',
};

export function createEnhancedModelRouter({
  models = [],
  defaultModel = null,
  capabilityTags = {},
} = {}) {
  const modelRegistry = new Map();

  for (const model of models) {
    registerModel(model);
  }

  function registerModel(model = {}) {
    const id = String(model.id || model.name || '').trim();
    if (!id) return false;

    const capabilities = [];

    if (model.capabilities) {
      capabilities.push(...(Array.isArray(model.capabilities) ? model.capabilities : [model.capabilities]));
    } else {
      if (model.supports_reasoning || model.reasoning) capabilities.push(MODEL_CAPABILITIES.REASONING);
      if (model.maxTokens >= 100000 || model.context_window >= 100000) capabilities.push(MODEL_CAPABILITIES.LONG_CONTEXT);
      if (model.vision || model.multimodal) capabilities.push(MODEL_CAPABILITIES.MULTIMODAL);
      if (model.fast || model.latency === 'low') capabilities.push(MODEL_CAPABILITIES.FAST);
      if (model.code || model.supports_code) capabilities.push(MODEL_CAPABILITIES.CODE);
      if (model.function_calling || model.tools) capabilities.push(MODEL_CAPABILITIES.FUNCTION_CALLING);
      if (model.json_mode || model.response_format === 'json') capabilities.push(MODEL_CAPABILITIES.JSON_MODE);
    }

    modelRegistry.set(id, {
      id,
      name: model.name || id,
      provider: model.provider || 'unknown',
      maxTokens: Number(model.maxTokens || model.max_output_tokens || 4096),
      contextWindow: Number(model.context_window || model.maxTokens || 8192),
      capabilities,
      costPerToken: model.cost_per_token || model.cost || 0,
      latency: model.latency || 'medium',
      priority: Number(model.priority || 100),
      tags: model.tags || [],
      metadata: model.metadata || {},
    });

    return true;
  }

  function getModel(id = '') {
    return modelRegistry.get(String(id)) || null;
  }

  function listModels(filter = {}) {
    let models = [...modelRegistry.values()];

    if (filter.capability) {
      models = models.filter((m) => m.capabilities.includes(filter.capability));
    }
    if (filter.provider) {
      models = models.filter((m) => m.provider === filter.provider);
    }
    if (filter.tag) {
      models = models.filter((m) => m.tags.includes(filter.tag));
    }

    return models.sort((a, b) => b.priority - a.priority);
  }

  function estimateTaskRequirements(task = '') {
    const text = String(task || '').trim().toLowerCase();
    const length = text.length;
    const requirements = {
      minContext: length * 2,
      preferredCapabilities: [],
      taskType: TASK_TYPES.CHAT,
      maxLatency: 'medium',
    };

    if (length > 10000 || text.includes('长文本') || text.includes('文档')) {
      requirements.preferredCapabilities.push(MODEL_CAPABILITIES.LONG_CONTEXT);
      requirements.taskType = TASK_TYPES.RESEARCH;
    }

    if (/```|function|class |def |import |export |code|代码|编程|debug|error|bug/.test(text)) {
      requirements.preferredCapabilities.push(MODEL_CAPABILITIES.CODE);
      requirements.taskType = TASK_TYPES.CODE_GENERATION;
    }

    if (/review|审查|检查|分析|评估/.test(text)) {
      requirements.taskType = TASK_TYPES.CODE_REVIEW;
      requirements.preferredCapabilities.push(MODEL_CAPABILITIES.REASONING);
    }

    if (/推理|规划|分析|分解|步骤|reason|plan|analyze|step by step/.test(text)) {
      requirements.preferredCapabilities.push(MODEL_CAPABILITIES.REASONING);
      requirements.taskType = TASK_TYPES.REASONING;
    }

    if (/总结|摘要|概括|summary|summary/.test(text)) {
      requirements.taskType = TASK_TYPES.SUMMARIZATION;
      requirements.maxLatency = 'low';
      requirements.preferredCapabilities.push(MODEL_CAPABILITIES.FAST);
    }

    if (/创意|写作|写诗|故事|creative|write|story/.test(text)) {
      requirements.taskType = TASK_TYPES.CREATIVE;
    }

    if (requirements.preferredCapabilities.length === 0) {
      requirements.preferredCapabilities.push(MODEL_CAPABILITIES.FUNCTION_CALLING);
      requirements.taskType = TASK_TYPES.CHAT;
    }

    return requirements;
  }

  function selectModel(requirements = {}) {
    const contextNeeded = requirements.minContext || 0;
    const preferredCaps = requirements.preferredCapabilities || [];
    const maxLatency = requirements.maxLatency || 'medium';

    let candidates = [...modelRegistry.values()];

    candidates = candidates.filter((m) => {
      if (contextNeeded > 0 && m.contextWindow < contextNeeded) return false;
      if (maxLatency === 'low' && m.latency !== 'low') return false;
      return true;
    });

    if (preferredCaps.length > 0) {
      candidates.sort((a, b) => {
        const aMatch = preferredCaps.filter((c) => a.capabilities.includes(c)).length;
        const bMatch = preferredCaps.filter((c) => b.capabilities.includes(c)).length;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return b.priority - a.priority;
      });
    } else {
      candidates.sort((a, b) => b.priority - a.priority);
    }

    return candidates[0] || defaultModel || null;
  }

  function route(task = '', options = {}) {
    const requirements = estimateTaskRequirements(task);
    const selected = selectModel({
      ...requirements,
      ...options,
    });

    return {
      task,
      taskType: requirements.taskType,
      requirements,
      selected,
      selectedId: selected?.id || null,
      selectedProvider: selected?.provider || null,
      allCandidates: listModels(),
    };
  }

  return {
    registerModel,
    getModel,
    listModels,
    estimateTaskRequirements,
    selectModel,
    route,
  };
}

export default {
  MODEL_CAPABILITIES,
  TASK_TYPES,
  createEnhancedModelRouter,
};

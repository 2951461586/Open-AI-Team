import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  default: {
    chat: { provider: 'openai', model: 'gpt-4o-mini', maxRetries: 1 },
    utility: { provider: 'openai', model: 'gpt-4o-mini', maxRetries: 2 },
    reasoning: { provider: 'openai', model: 'gpt-4o', maxRetries: 1 },
  },
  fallback: {
    chat: { provider: 'openai', model: 'gpt-3.5-turbo' },
    utility: { provider: 'openai', model: 'gpt-3.5-turbo' },
    reasoning: { provider: 'openai', model: 'gpt-4o-mini' },
  },
};

function normalizeText(input = '') {
  if (typeof input === 'string') return input;
  if (input == null) return '';
  if (typeof input === 'object') {
    return [input.text, input.prompt, input.task, input.content, input.summary].filter(Boolean).join('\n');
  }
  return String(input);
}

function estimateComplexity(textOrTask = '') {
  const text = normalizeText(textOrTask).trim();
  const lower = text.toLowerCase();
  const length = text.length;
  const lines = text ? text.split(/\r?\n/).length : 0;
  const codeLike = /```|function\s|class\s|const\s|let\s|var\s|import\s|export\s|<\/?[a-z][^>]*>|\bpython\b|\bjavascript\b|\btypescript\b|\berror\b|\bstack\b/.test(lower);
  const reasoningLike = /规划|推理|分析|设计|架构|排查|debug|debugging|root cause|tradeoff|step by step|compare|plan|reason|refactor/.test(lower);
  const conversationalLike = /聊|讨论|怎么|如何|建议|帮我想|一起看|是否|感觉|觉得/.test(lower);
  const shortSimple = length > 0 && length <= 40 && lines <= 2 && !codeLike && !reasoningLike && !conversationalLike;
  if (shortSimple) return { bucket: 'utility', score: 1, reasons: ['short_simple'] };
  let score = 0;
  if (conversationalLike) score += 1;
  if (length > 120) score += 1;
  if (length > 400) score += 2;
  if (length > 1200) score += 2;
  if (lines > 12) score += 1;
  if (codeLike) score += 3;
  if (reasoningLike) score += 2;
  const bucket = score >= 4 ? 'reasoning' : (score === 0 ? 'utility' : 'chat');
  return { bucket, score, reasons: [codeLike ? 'code_like' : '', reasoningLike ? 'reasoning_like' : '', length > 400 ? 'long_text' : ''].filter(Boolean) };
}

function safeReadJson(filePath = '') {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export class ModelRouter {
  constructor({ configPath = path.resolve(process.cwd(), 'config/models.json'), config = null, invoker = null, auditLogger = null } = {}) {
    this.configPath = configPath;
    this.config = config || safeReadJson(configPath) || DEFAULT_CONFIG;
    this.invoker = typeof invoker === 'function' ? invoker : null;
    this.auditLogger = typeof auditLogger === 'function' ? auditLogger : null;
  }

  getConfig() {
    return this.config || DEFAULT_CONFIG;
  }

  resolvePreset(preset = 'chat') {
    const cfg = this.getConfig();
    const primary = cfg?.default?.[preset] || DEFAULT_CONFIG.default[preset] || DEFAULT_CONFIG.default.chat;
    const fallback = cfg?.fallback?.[preset] || DEFAULT_CONFIG.fallback[preset] || null;
    return { primary, fallback };
  }

  pickPreset(textOrTask = '') {
    return estimateComplexity(textOrTask).bucket;
  }

  route(textOrTask = '') {
    const complexity = estimateComplexity(textOrTask);
    const resolved = this.resolvePreset(complexity.bucket);
    return {
      preset: complexity.bucket,
      primary: resolved.primary,
      fallback: resolved.fallback,
      complexity,
    };
  }

  routeWithPreferred(modelId = '', textOrTask = '') {
    const base = this.route(textOrTask);
    if (!modelId) return base;
    return {
      ...base,
      preferredModelId: String(modelId),
      primary: { ...base.primary, model: String(modelId) },
    };
  }

  async execute(request = {}, options = {}) {
    if (!this.invoker) throw new Error('model_router_invoker_required');
    const text = request?.text ?? request?.prompt ?? request?.content ?? '';
    const routeInfo = options?.preferredModelId
      ? this.routeWithPreferred(options.preferredModelId, text)
      : this.route(text);
    const attempts = [routeInfo.primary, routeInfo.fallback].filter(Boolean);
    let lastResult = null;
    let lastError = null;
    for (let index = 0; index < attempts.length; index += 1) {
      const selected = attempts[index];
      const startedAt = Date.now();
      try {
        const result = await this.invoker({
          ...request,
          provider: selected.provider,
          model: selected.model,
          routePreset: routeInfo.preset,
          routeInfo,
        });
        const finishedAt = Date.now();
        const enriched = {
          ...result,
          model: result?.model || selected.model,
          provider: result?.provider || selected.provider,
          routePreset: routeInfo.preset,
          routeInfo,
          fallbackUsed: index > 0,
          latencyMs: Number(result?.latencyMs || (finishedAt - startedAt)),
          tokenUsage: result?.tokenUsage || result?.usage || null,
          cost: Number(result?.cost || 0),
        };
        if (this.auditLogger) {
          await this.auditLogger({ ok: !!enriched?.ok, request, response: enriched, selectedModel: selected, routeInfo, startedAt, finishedAt, fallbackUsed: index > 0 });
        }
        lastResult = enriched;
        if (enriched?.ok !== false) return enriched;
        lastError = new Error(String(enriched?.error || 'model_router_attempt_failed'));
      } catch (error) {
        const finishedAt = Date.now();
        lastError = error;
        if (this.auditLogger) {
          await this.auditLogger({ ok: false, request, error: String(error?.message || error || 'model_router_attempt_failed'), selectedModel: selected, routeInfo, startedAt, finishedAt, fallbackUsed: index > 0 });
        }
      }
    }
    if (lastResult) return lastResult;
    return { ok: false, error: String(lastError?.message || 'model_router_failed'), routeInfo };
  }
}

export function createModelRouter(options = {}) {
  return new ModelRouter(options);
}

export { estimateComplexity };

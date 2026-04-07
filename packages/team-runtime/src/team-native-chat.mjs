/**
 * team-native-chat.mjs — LLM chat via OpenAI-compatible streaming API
 *
 * Provides generateReply (blocking) and generateReplyStream (SSE streaming)
 * for TL runtime. Uses the configured OpenAI-compatible endpoint directly
 * for low-latency, real-time token delivery.
 */

export function createNativeChatRuntime({
  baseUrl = 'http://127.0.0.1:8317/v1',
  apiKey = '',
  model = 'gpt-5.4',
  traceLogger = null,
} = {}) {

  // Pre-resolve API key at construction time
  let resolvedApiKey = String(apiKey || '').trim();
  if (!resolvedApiKey) {
    resolvedApiKey = String(process.env.TEAM_NATIVE_CHAT_API_KEY || process.env.NATIVE_CHAT_API_KEY || process.env.CLIPROXYAPI_API_KEY || '').trim();
  }

  const completionsUrl = `${baseUrl}/chat/completions`;

  function extractTextContent(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === 'string') return part;
          if (!part || typeof part !== 'object') return '';
          return String(part.text || part.content || part.value || '').trim();
        })
        .filter(Boolean)
        .join('');
    }
    if (value && typeof value === 'object') {
      return String(value.text || value.content || value.value || '').trim();
    }
    return '';
  }

  function extractBlockingReply(data = {}) {
    return String(
      extractTextContent(data?.choices?.[0]?.message?.content)
      || extractTextContent(data?.choices?.[0]?.message?.reasoning_content)
      || extractTextContent(data?.choices?.[0]?.text)
      || extractTextContent(data?.message?.content)
      || extractTextContent(data?.output_text)
      || ''
    ).trim();
  }

  function buildMessages(text, history, systemPrompt) {
    const msgs = [];
    if (systemPrompt) {
      msgs.push({ role: 'system', content: systemPrompt });
    }
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        const role = String(h?.role || 'user').toLowerCase();
        const content = String(h?.content || '').trim();
        if (content && ['user', 'assistant', 'system'].includes(role)) {
          msgs.push({ role, content });
        }
      }
    }
    msgs.push({ role: 'user', content: text });
    return msgs;
  }

  /**
   * generateReply — blocking, returns full response
   */
  async function generateReply({ text = '', history = [], mode = 'chat', systemPrompt = '', model: overrideModel = '' } = {}) {
    if (!text.trim()) return { ok: false, error: 'empty_text' };
    if (!resolvedApiKey) return { ok: false, error: 'no_api_key' };

    const selectedModel = String(overrideModel || model || '').trim();
    const startedAt = Date.now();
    try {
      const res = await globalThis.fetch(completionsUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${resolvedApiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: buildMessages(text, history, systemPrompt),
          stream: false,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(120_000), // 2 min timeout for non-streaming
      });

      const data = await res.json().catch(() => ({}));
      let reply = extractBlockingReply(data);
      const usage = data?.usage || null;
      const latencyMs = Date.now() - startedAt;
      const cost = 0;

      if (!reply) {
        const streamed = await generateReplyStream({
          text,
          history,
          mode,
          systemPrompt,
          model: selectedModel,
          onChunk: () => {},
        });
        if (streamed?.ok && streamed?.reply) {
          reply = String(streamed.reply).trim();
        }
      }

      const out = reply
        ? { ok: true, reply, source: 'openai_direct', model: selectedModel, tokenUsage: usage, latencyMs, cost }
        : { ok: false, error: 'empty_response', model: selectedModel, tokenUsage: usage, latencyMs, cost };
      if (typeof traceLogger === 'function') {
        try { await traceLogger({ op: 'native_chat.generateReply', mode, model: selectedModel, tokenUsage: usage, latencyMs, cost, ok: out.ok !== false }); } catch {}
      }
      return out;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      console.error('[native-chat] generateReply error:', err?.message);
      if (typeof traceLogger === 'function') {
        try { await traceLogger({ op: 'native_chat.generateReply', mode, model: selectedModel, tokenUsage: null, latencyMs, cost: 0, ok: false, error: String(err?.message || 'api_error') }); } catch {}
      }
      return { ok: false, error: String(err?.message || 'api_error'), model: selectedModel, latencyMs, cost: 0 };
    }
  }

  /**
   * generateReplyStream — SSE streaming, calls onChunk(delta, fullText) per token
   */
  async function generateReplyStream({ text = '', history = [], mode = 'chat', systemPrompt = '', onChunk, model: overrideModel = '' } = {}) {
    if (!text.trim()) return { ok: false, error: 'empty_text' };
    if (!resolvedApiKey) return { ok: false, error: 'no_api_key' };
    if (typeof onChunk !== 'function') {
      return generateReply({ text, history, mode, systemPrompt, model: overrideModel });
    }

    const selectedModel = String(overrideModel || model || '').trim();
    const startedAt = Date.now();
    try {
      const res = await globalThis.fetch(completionsUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${resolvedApiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: buildMessages(text, history, systemPrompt),
          stream: true,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(180_000), // 3 min timeout for streaming
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[native-chat] stream error:', res.status, errText.slice(0, 200));
        const failed = { ok: false, error: `api_${res.status}`, model: selectedModel, latencyMs: Date.now() - startedAt, cost: 0 };
        if (typeof traceLogger === 'function') {
          try { await traceLogger({ op: 'native_chat.generateReplyStream', mode, model: selectedModel, tokenUsage: null, latencyMs: failed.latencyMs, cost: 0, ok: false, error: failed.error }); } catch {}
        }
        return failed;
      }

      let fullText = '';
      const reader = res.body?.getReader?.();
      if (!reader) {
        const body = await res.text();
        const lines = body.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(delta, fullText);
            }
          } catch {}
        }
        const out = { ok: true, reply: fullText, source: 'openai_stream', model: selectedModel, tokenUsage: null, latencyMs: Date.now() - startedAt, cost: 0 };
        if (typeof traceLogger === 'function') {
          try { await traceLogger({ op: 'native_chat.generateReplyStream', mode, model: selectedModel, tokenUsage: null, latencyMs: out.latencyMs, cost: out.cost, ok: true }); } catch {}
        }
        return out;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(delta, fullText);
            }
          } catch {}
        }
      }

      if (buffer.trim()) {
        const remaining = buffer.trim();
        if (remaining.startsWith('data: ') && remaining.slice(6).trim() !== '[DONE]') {
          try {
            const chunk = JSON.parse(remaining.slice(6).trim());
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(delta, fullText);
            }
          } catch {}
        }
      }

      const out = { ok: true, reply: fullText, source: 'openai_stream', model: selectedModel, tokenUsage: null, latencyMs: Date.now() - startedAt, cost: 0 };
      if (typeof traceLogger === 'function') {
        try { await traceLogger({ op: 'native_chat.generateReplyStream', mode, model: selectedModel, tokenUsage: null, latencyMs: out.latencyMs, cost: out.cost, ok: true }); } catch {}
      }
      return out;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      console.error('[native-chat] stream error:', err?.message);
      if (typeof traceLogger === 'function') {
        try { await traceLogger({ op: 'native_chat.generateReplyStream', mode, model: selectedModel, tokenUsage: null, latencyMs, cost: 0, ok: false, error: String(err?.message || 'stream_error') }); } catch {}
      }
      return { ok: false, error: String(err?.message || 'stream_error'), model: selectedModel, latencyMs, cost: 0 };
    }
  }

  return {
    generateReply,
    generateReplyStream,
    isConfigured: () => !!resolvedApiKey,
  };
}

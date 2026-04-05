import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readCompletionPayload(filePath, attempts = 5) {
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const raw = await fsp.readFile(filePath, 'utf8');
      const text = String(raw || '').trim();
      if (!text) throw new Error('empty_completion_file');
      try {
        const parsed = JSON.parse(text);
        return {
          ok: true,
          payload: parsed,
          raw: text,
        };
      } catch {
        return {
          ok: true,
          payload: null,
          raw: text,
        };
      }
    } catch (err) {
      lastErr = err;
      await delay(40 * (i + 1));
    }
  }
  return {
    ok: false,
    error: String(lastErr?.message || lastErr || 'completion_read_failed'),
  };
}

export function createSessionCompletionBus() {
  async function ensureParentDir(filePath = '') {
    const dir = path.dirname(String(filePath || ''));
    if (!dir || dir === '.' || dir === '/') return;
    await fsp.mkdir(dir, { recursive: true });
  }

  async function publishCompletion({ filePath, payload, raw } = {}) {
    const target = String(filePath || '').trim();
    if (!target) return { ok: false, error: 'completion_file_required' };
    await ensureParentDir(target);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    const content = typeof raw === 'string'
      ? raw
      : JSON.stringify(payload || {}, null, 2);
    await fsp.writeFile(tmp, `${String(content || '').trim()}\n`, 'utf8');
    await fsp.rename(tmp, target);
    return { ok: true, filePath: target };
  }

  async function waitForCompletion({ filePath, timeoutMs = 120000 } = {}) {
    const target = String(filePath || '').trim();
    if (!target) return { ok: false, error: 'completion_file_required' };
    await ensureParentDir(target);

    const existing = await readCompletionPayload(target, 1);
    if (existing.ok) {
      return {
        ok: true,
        mode: 'file_event',
        filePath: target,
        payload: existing.payload,
        raw: existing.raw,
      };
    }

    const dir = path.dirname(target);
    const base = path.basename(target);

    return await new Promise((resolve) => {
      let settled = false;
      let watcher = null;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        try { watcher?.close?.(); } catch {}
        watcher = null;
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const tryRead = async () => {
        const out = await readCompletionPayload(target, 5);
        if (out.ok) {
          finish({
            ok: true,
            mode: 'file_event',
            filePath: target,
            payload: out.payload,
            raw: out.raw,
          });
        }
      };

      timer = setTimeout(() => {
        finish({ ok: false, error: 'timeout', filePath: target, mode: 'file_event' });
      }, Number(timeoutMs || 120000));

      try {
        watcher = fs.watch(dir, async (_eventType, filename) => {
          if (settled) return;
          if (filename && String(filename) !== base) return;
          await tryRead();
        });
      } catch (err) {
        finish({ ok: false, error: String(err?.message || err || 'watch_failed'), filePath: target, mode: 'file_event' });
        return;
      }

      // Race-safe one-shot after watcher attaches.
      void tryRead();
    });
  }

  return {
    ensureParentDir,
    publishCompletion,
    waitForCompletion,
  };
}

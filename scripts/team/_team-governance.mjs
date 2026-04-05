import fs from 'node:fs';
import path from 'node:path';

const LOCK_DIR = '/tmp/openclaw-team-locks';

function ensureDir() {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
}

export function makeBatchId(prefix = 'team-batch') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${prefix}:${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

export function acquireSingleFlight(lockKey, metadata = {}) {
  ensureDir();
  const file = path.join(LOCK_DIR, `${lockKey}.json`);
  if (fs.existsSync(file)) {
    const active = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ok: false, file, active };
  }
  const payload = {
    lockKey,
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    ...metadata,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return { ok: true, file, payload };
}

export function releaseSingleFlight(lock) {
  try {
    if (lock?.file && fs.existsSync(lock.file)) fs.unlinkSync(lock.file);
  } catch {}
}

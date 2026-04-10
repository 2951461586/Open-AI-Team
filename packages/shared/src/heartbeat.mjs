export const HEARTBEAT_INTERVAL_MS = 30000;

export function createHeartbeat({
  intervalMs = HEARTBEAT_INTERVAL_MS,
  onHeartbeat = null,
  onTimeout = null,
  timeoutMs = 60000,
} = {}) {
  let timer = null;
  let running = false;
  let lastBeat = null;
  let beatCount = 0;
  let missedBeats = 0;

  function beat() {
    lastBeat = new Date().toISOString();
    beatCount++;
    missedBeats = 0;
    return { ok: true, beatCount, at: lastBeat };
  }

  function checkTimeout() {
    if (!lastBeat) return { ok: true, timedOut: false };

    const elapsed = Date.now() - new Date(lastBeat).getTime();
    const timedOut = elapsed > timeoutMs;

    if (timedOut) {
      missedBeats++;
      onTimeout?.({ elapsed, missedBeats, beatCount });
    }

    return { ok: true, timedOut, elapsed, missedBeats };
  }

  function start() {
    if (running) return;
    running = true;
    lastBeat = new Date().toISOString();

    timer = setInterval(() => {
      const result = beat();
      onHeartbeat?.(result);
      checkTimeout();
    }, intervalMs);

    if (timer?.unref) timer.unref();
  }

  function stop() {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function getStatus() {
    return {
      running,
      lastBeat,
      beatCount,
      missedBeats,
      intervalMs,
      timeoutMs,
    };
  }

  return {
    start,
    stop,
    beat,
    checkTimeout,
    getStatus,
  };
}

export function createFileWatcherHeartbeat({
  watchPaths = [],
  intervalMs = 60000,
  onChange = null,
} = {}) {
  let timer = null;
  let running = false;
  let fileStates = new Map();

  async function getFileState(filePath = '') {
    try {
      const fs = await import('node:fs/promises');
      const stat = await fs.stat(filePath);
      return {
        mtime: stat.mtime.toISOString(),
        size: stat.size,
        exists: true,
      };
    } catch {
      return { exists: false };
    }
  }

  async function scanForChanges() {
    const changes = [];

    for (const filePath of watchPaths) {
      const current = await getFileState(filePath);
      const previous = fileStates.get(filePath);

      if (!previous) {
        fileStates.set(filePath, current);
        continue;
      }

      if (current.exists && previous.exists) {
        if (current.mtime !== previous.mtime || current.size !== previous.size) {
          changes.push({ path: filePath, previous, current });
          fileStates.set(filePath, current);
        }
      }
    }

    if (changes.length > 0) {
      onChange?.(changes);
    }
  }

  function start() {
    if (running) return;
    running = true;

    for (const filePath of watchPaths) {
      getFileState(filePath).then((state) => {
        fileStates.set(filePath, state);
      });
    }

    timer = setInterval(scanForChanges, intervalMs);
    if (timer?.unref) timer.unref();
  }

  function stop() {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    fileStates.clear();
  }

  function addWatchPath(filePath = '') {
    if (!watchPaths.includes(filePath)) {
      watchPaths.push(filePath);
    }
  }

  function removeWatchPath(filePath = '') {
    const idx = watchPaths.indexOf(filePath);
    if (idx >= 0) {
      watchPaths.splice(idx, 1);
      fileStates.delete(filePath);
    }
  }

  function getStatus() {
    return {
      running,
      watchPaths: [...watchPaths],
      trackedFiles: fileStates.size,
      intervalMs,
    };
  }

  return {
    start,
    stop,
    addWatchPath,
    removeWatchPath,
    getStatus,
  };
}

export default {
  HEARTBEAT_INTERVAL_MS,
  createHeartbeat,
  createFileWatcherHeartbeat,
};

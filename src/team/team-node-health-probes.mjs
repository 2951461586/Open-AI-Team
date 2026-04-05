import { spawn, spawnSync, execSync } from 'node:child_process';
import os from 'node:os';

export async function ping(fetchImpl = globalThis.fetch, url = '', timeoutMs = 1500) {
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'fetch_unavailable' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: ctl.signal });
    const latencyMs = Date.now() - started;
    clearTimeout(t);
    return { ok: !!res.ok, status: Number(res.status || 0), latencyMs };
  } catch (err) {
    clearTimeout(t);
    return { ok: false, error: String(err?.message || err || 'ping_failed') };
  }
}

export function pingPeerRelayViaSsh({ host = '', port = 18080, timeoutMs = 2500 } = {}) {
  return new Promise((resolve) => {
    if (!host) {
      resolve({ ok: false, error: 'peer_host_missing' });
      return;
    }
    const started = Date.now();
    const remoteCmd = `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:${Number(port || 18080)}/status`;
    const child = spawn('ssh', [host, remoteCmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch {}
      resolve({ ok: false, error: 'ssh_timeout' });
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const latencyMs = Date.now() - started;
      const status = Number(String(out || '').trim() || 0);
      resolve({ ok: code === 0 && (status === 200 || status === 400 || status === 404), status, latencyMs });
    });
    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, error: String(err?.message || err || 'ssh_failed') });
    });
  });
}

export function readLocalStats({ controlPlaneSystemdUnit = '' } = {}) {
  try {
    const load = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = Math.max(0, totalMem - freeMem);
    let diskTotal = 0;
    let diskUsed = 0;
    try {
      const out = execSync('df -k / | tail -1', { encoding: 'utf8' }).trim();
      const parts = out.split(/\s+/);
      diskTotal = Number(parts[1] || 0) * 1024;
      diskUsed = Number(parts[2] || 0) * 1024;
    } catch {}
    let controlPlaneStatus = 'unknown';
    let controlPlaneOk = false;
    try {
      const probe = spawnSync(
        'systemctl',
        ['--user', 'show', String(controlPlaneSystemdUnit || 'control-plane'), '-p', 'ActiveState', '-p', 'MainPID'],
        { encoding: 'utf8', timeout: 1500, killSignal: 'SIGKILL' },
      );
      if (probe.error?.code === 'ETIMEDOUT') {
        controlPlaneStatus = 'control_probe_timeout';
      } else if (probe.status === 0) {
        const activeState = String((String(probe.stdout || '').match(/ActiveState=(.+)/) || [])[1] || '').trim();
        const mainPid = Number(String((String(probe.stdout || '').match(/MainPID=(.+)/) || [])[1] || '0').trim() || 0);
        controlPlaneStatus = activeState || 'unknown';
        controlPlaneOk = activeState === 'active' && mainPid > 0;
      } else {
        controlPlaneStatus = 'control_probe_failed';
      }
    } catch {}
    return {
      host: os.hostname(),
      load1: Number(load[0]?.toFixed?.(2) || 0),
      load5: Number(load[1]?.toFixed?.(2) || 0),
      load15: Number(load[2]?.toFixed?.(2) || 0),
      cpuPercent: undefined,
      memoryTotalMb: Math.round(totalMem / 1024 / 1024),
      memoryUsedMb: Math.round(usedMem / 1024 / 1024),
      memoryUsedPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
      diskTotalGb: Math.round((diskTotal / 1024 / 1024 / 1024) * 10) / 10,
      diskUsedGb: Math.round((diskUsed / 1024 / 1024 / 1024) * 10) / 10,
      diskUsedPercent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
      uptimeHuman: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
      controlPlaneOk,
      controlPlaneStatus,
    };
  } catch {
    return null;
  }
}

export function readRemoteStatsViaSsh({ host = '', timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    if (!host) return resolve(null);
    const remoteCmd = [
      'LOAD=$(cat /proc/loadavg 2>/dev/null | awk \'{print $1" "$2" "$3}\')',
      'MEM=$(awk \'/MemTotal|MemAvailable/ {print $2}\' /proc/meminfo 2>/dev/null | xargs)',
      'DISK=$(df -k / 2>/dev/null | tail -1 | awk \'{print $2" "$3}\')',
      'UP=$(cut -d. -f1 /proc/uptime 2>/dev/null)',
      'HOST=$(hostname 2>/dev/null)',
      'printf "%s\\n" "$HOST|$LOAD|$MEM|$DISK|$UP"',
    ].join('; ');
    const child = spawn('ssh', [host, remoteCmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch {}
      resolve(null);
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code !== 0) return resolve(null);
      const line = String(out || '').trim().split('\n').filter(Boolean).pop() || '';
      const [hostName, loadRaw, memRaw, diskRaw, uptimeRaw] = line.split('|');
      const [load1, load5, load15] = String(loadRaw || '').split(/\s+/).map(Number);
      const [memTotalKb, memAvailKb] = String(memRaw || '').split(/\s+/).map(Number);
      const [diskTotalKb, diskUsedKb] = String(diskRaw || '').split(/\s+/).map(Number);
      const usedMemKb = memTotalKb > 0 && memAvailKb >= 0 ? (memTotalKb - memAvailKb) : 0;
      const uptimeSec = Number(uptimeRaw || 0);
      resolve({
        host: hostName || host,
        load1: Number((load1 || 0).toFixed?.(2) || load1 || 0),
        load5: Number((load5 || 0).toFixed?.(2) || load5 || 0),
        load15: Number((load15 || 0).toFixed?.(2) || load15 || 0),
        cpuPercent: undefined,
        memoryTotalMb: memTotalKb ? Math.round(memTotalKb / 1024) : undefined,
        memoryUsedMb: usedMemKb ? Math.round(usedMemKb / 1024) : undefined,
        memoryUsedPercent: memTotalKb ? Math.round((usedMemKb / memTotalKb) * 100) : undefined,
        diskTotalGb: diskTotalKb ? Math.round((diskTotalKb / 1024 / 1024) * 10) / 10 : undefined,
        diskUsedGb: diskUsedKb ? Math.round((diskUsedKb / 1024 / 1024) * 10) / 10 : undefined,
        diskUsedPercent: diskTotalKb ? Math.round((diskUsedKb / diskTotalKb) * 100) : undefined,
        uptimeHuman: uptimeSec ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m` : '--',
      });
    });
    child.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(null);
    });
  });
}

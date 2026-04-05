import { spawn, spawnSync, execSync } from 'node:child_process';
import os from 'node:os';
import { CANONICAL_NODE_IDS, DEFAULT_NODE_ID, OBSERVER_NODE_ID, REVIEW_NODE_ID, canonicalNodeId, withLegacyNodeAliases } from './team-node-ids.mjs';

/**
 * 三节点健康检查模块
 */
export function createTeamNodeHealth({
  fetchImpl = globalThis.fetch,
  peerHost = '',
  peerWebhookPort = 18080,
  peerControlBaseUrl = '',
  peerControlToken = '',
  lebangHost = REVIEW_NODE_ID,
  lebangWebhookPort = 19092,
  lebangControlBaseUrl = '',
  lebangControlToken = '',
  controlPlaneSystemdUnit = 'orchestrator.service',
  localControlUrl = 'http://127.0.0.1:19090',
  teamStore = null,
} = {}) {
  const disableSshRemoteProbe = ['1', 'true', 'yes', 'on'].includes(String(process.env.TEAM_NODE_HEALTH_DISABLE_SSH || '').trim().toLowerCase());
  const hasVioletControl = !!String(peerControlBaseUrl || '').trim();
  const hasLebangControl = !!String(lebangControlBaseUrl || '').trim();
  const reachabilityGraceMs = { [DEFAULT_NODE_ID]: 60000, [OBSERVER_NODE_ID]: 45000, [REVIEW_NODE_ID]: 45000, laoda: 60000, violet: 45000, lebang: 45000 };
  const lastHealthyAt = { [DEFAULT_NODE_ID]: Date.now(), [OBSERVER_NODE_ID]: 0, [REVIEW_NODE_ID]: 0, laoda: Date.now(), violet: 0, lebang: 0 };
  let lastSnapshot = {
    ts: Date.now(),
    [DEFAULT_NODE_ID]: { node: DEFAULT_NODE_ID, reachable: true, latencyMs: 0, fallbackReady: true, probe: 'local_http', statsSource: 'local', statsStatus: 'unknown', stats: null },
    [OBSERVER_NODE_ID]: { node: OBSERVER_NODE_ID, reachable: false, latencyMs: 0, fallbackReady: true, probe: hasVioletControl ? 'control_http' : 'relay_ssh', statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh', statsStatus: disableSshRemoteProbe ? 'disabled' : 'pending', stats: null },
    [REVIEW_NODE_ID]: { node: REVIEW_NODE_ID, reachable: false, latencyMs: 0, fallbackReady: true, probe: hasLebangControl ? 'control_http' : 'relay_ssh', statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh', statsStatus: disableSshRemoteProbe ? 'disabled' : 'pending', stats: null },
  };

  // Root fix: remote node health must not write into any host chat/session transcript.
  // Reachability stays on HTTP(/health) or relay probe; remote stats use SSH only when enabled.

  async function ping(url, timeoutMs = 1500) {
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


  function resolveReachability(nodeName, rawOk) {
    const now = Date.now();
    if (canonicalNodeId(nodeName, DEFAULT_NODE_ID) === DEFAULT_NODE_ID) {
      lastHealthyAt[DEFAULT_NODE_ID] = now; lastHealthyAt.laoda = now;
      return true;
    }
    if (rawOk) {
      lastHealthyAt[nodeName] = now;
      return true;
    }
    const graceMs = Number(reachabilityGraceMs[nodeName] || 0);
    return graceMs > 0 && (now - Number(lastHealthyAt[nodeName] || 0)) < graceMs;
  }

  function stableLatency(nodeName, rawResult) {
    if (rawResult?.ok) return Number(rawResult.latencyMs || 0);
    return Number(lastSnapshot?.[nodeName]?.latencyMs || 0);
  }

  function pingPeerRelayViaSsh(host, port, timeoutMs = 2500) {
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
      child.stdout.on('data', d => { out += d.toString(); });
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

  function readLocalStats() {
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
          ['--user', 'show', String(controlPlaneSystemdUnit || 'orchestrator.service'), '-p', 'ActiveState', '-p', 'MainPID'],
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

  function readRemoteStatsViaSsh(host, timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (!host) return resolve(null);
      const remoteCmd = [
        'LOAD=$(cat /proc/loadavg 2>/dev/null | awk \'{print $1" "$2" "$3}\')',
        'MEM=$(awk \'/MemTotal|MemAvailable/ {print $2}\' /proc/meminfo 2>/dev/null | xargs)',
        'DISK=$(df -k / 2>/dev/null | tail -1 | awk \'{print $2" "$3}\')',
        'UP=$(cut -d. -f1 /proc/uptime 2>/dev/null)',
        'HOST=$(hostname 2>/dev/null)',
        'printf "%s\\n" "$HOST|$LOAD|$MEM|$DISK|$UP"'
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
      child.stdout.on('data', d => { out += d.toString(); });
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


  async function refreshNodeStatus() {
    const violetUrl = String(peerControlBaseUrl || '').trim().replace(/\/$/, '');
    const lebangUrl = String(lebangControlBaseUrl || '').trim().replace(/\/$/, '');

    const [laodaResult, violetResult, lebangResult, laodaStats, violetSshStats, lebangSshStats] = await Promise.all([
      ping(`${String(localControlUrl || 'http://127.0.0.1:19090').replace(/\/$/, '')}/health`),
      violetUrl ? ping(`${violetUrl}/health`, 1500) : (disableSshRemoteProbe ? Promise.resolve({ ok: false, error: 'ssh_probe_disabled' }) : pingPeerRelayViaSsh(peerHost || OBSERVER_NODE_ID, peerWebhookPort)),
      lebangUrl ? ping(`${lebangUrl}/health`, 1500) : (disableSshRemoteProbe ? Promise.resolve({ ok: false, error: 'ssh_probe_disabled' }) : pingPeerRelayViaSsh(lebangHost, lebangWebhookPort)),
      Promise.resolve(readLocalStats()),
      disableSshRemoteProbe ? Promise.resolve(null) : readRemoteStatsViaSsh(peerHost || OBSERVER_NODE_ID),
      disableSshRemoteProbe ? Promise.resolve(null) : readRemoteStatsViaSsh(lebangHost),
    ]);

    const violetStats = violetSshStats || null;
    const lebangStats = lebangSshStats || null;
    const laodaReachable = resolveReachability(DEFAULT_NODE_ID, !!laodaResult.ok);
    const violetReachable = resolveReachability(OBSERVER_NODE_ID, !!violetResult.ok);
    const lebangReachable = resolveReachability(REVIEW_NODE_ID, !!lebangResult.ok);

    if (violetStats && violetReachable) {
      violetStats.controlPlaneOk = true;
      violetStats.controlPlaneStatus = 'reachable';
    } else if (violetStats) {
      violetStats.controlPlaneOk = false;
      violetStats.controlPlaneStatus = 'unreachable';
    }
    if (lebangStats && lebangReachable) {
      lebangStats.controlPlaneOk = true;
      lebangStats.controlPlaneStatus = 'reachable';
    } else if (lebangStats) {
      lebangStats.controlPlaneOk = false;
      lebangStats.controlPlaneStatus = 'unreachable';
    }

    lastSnapshot = {
      ts: Date.now(),
      [DEFAULT_NODE_ID]: {
        node: DEFAULT_NODE_ID,
        reachable: laodaReachable,
        latencyMs: stableLatency(DEFAULT_NODE_ID, laodaResult),
        fallbackReady: true,
        probe: 'local_http',
        statsSource: 'local',
        statsStatus: laodaStats ? 'ok' : 'missing',
        stats: laodaStats,
      },
      [OBSERVER_NODE_ID]: {
        node: OBSERVER_NODE_ID,
        reachable: violetReachable,
        latencyMs: stableLatency(OBSERVER_NODE_ID, violetResult),
        fallbackReady: true,
        probe: violetUrl ? 'control_http' : 'relay_ssh',
        statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh',
        statsStatus: disableSshRemoteProbe ? 'disabled' : (violetStats ? 'ok' : 'missing'),
        stats: violetStats,
      },
      [REVIEW_NODE_ID]: {
        node: REVIEW_NODE_ID,
        reachable: lebangReachable,
        latencyMs: stableLatency(REVIEW_NODE_ID, lebangResult),
        fallbackReady: true,
        probe: lebangUrl ? 'control_http' : 'relay_ssh',
        statsSource: disableSshRemoteProbe ? 'disabled' : 'ssh',
        statsStatus: disableSshRemoteProbe ? 'disabled' : (lebangStats ? 'ok' : 'missing'),
        stats: lebangStats,
      },
    };

    if (teamStore?.getActiveResidentsByNode) {
      const nowTs = Date.now();
      for (const nodeName of CANONICAL_NODE_IDS) {
        if (!lastSnapshot[nodeName]) continue;
        try {
          const activeResidents = teamStore.getActiveResidentsByNode(nodeName, nowTs);
          lastSnapshot[nodeName].activeResidentCount = activeResidents.length;
          lastSnapshot[nodeName].activeResidentRoles = activeResidents.map((m) => m.role || '').filter(Boolean);
        } catch {
          lastSnapshot[nodeName].activeResidentCount = 0;
          lastSnapshot[nodeName].activeResidentRoles = [];
        }
      }
    }

    return withLegacyNodeAliases(lastSnapshot);
  }

  function getNodeStatusSync() {
    return withLegacyNodeAliases(lastSnapshot);
  }

  function computeNodeWeights() {
    const weights = {};
    for (const nodeName of CANONICAL_NODE_IDS) {
      const snap = lastSnapshot[nodeName];
      if (!snap || !snap.reachable) {
        weights[nodeName] = { weight: 0, reason: 'unreachable' };
        continue;
      }
      let w = 100;
      const stats = snap.stats || {};
      const hasStats = stats && Object.keys(stats).length > 0;
      let reason = 'healthy';

      if (!hasStats) {
        w = Math.min(w, 45);
        reason = snap.statsStatus === 'disabled' ? 'stats_disabled' : 'reachable_no_stats';
      }

      if (typeof stats.memoryUsedPercent === 'number') {
        if (stats.memoryUsedPercent > 90) w -= 60;
        else if (stats.memoryUsedPercent > 80) w -= 30;
        else if (stats.memoryUsedPercent > 70) w -= 10;
      }
      if (typeof stats.load1 === 'number') {
        if (stats.load1 > 4) w -= 40;
        else if (stats.load1 > 2) w -= 20;
        else if (stats.load1 > 1) w -= 5;
      }
      if (typeof stats.diskUsedPercent === 'number') {
        if (stats.diskUsedPercent > 95) w -= 30;
        else if (stats.diskUsedPercent > 90) w -= 10;
      }
      if (typeof snap.latencyMs === 'number' && snap.latencyMs > 0) {
        if (snap.latencyMs > 2000) w -= 30;
        else if (snap.latencyMs > 500) w -= 10;
      }
      const residentCount = Number(snap.activeResidentCount || 0);
      if (residentCount > 3) w -= 20;
      else if (residentCount > 1) w -= 5;

      const finalWeight = Math.max(0, w);
      if (reason === 'healthy') {
        reason = finalWeight >= 70 ? 'healthy' : finalWeight >= 30 ? 'degraded' : 'overloaded';
      }
      weights[nodeName] = { weight: finalWeight, reason };
    }
    return weights;
  }

  function selectBestNode(preferredNode = DEFAULT_NODE_ID, fallbackNode = DEFAULT_NODE_ID, affinityBonus = 15) {
    const weights = computeNodeWeights();
    if (weights[preferredNode]) {
      weights[preferredNode] = {
        ...weights[preferredNode],
        weight: Math.min(100, weights[preferredNode].weight + affinityBonus),
      };
    }
    let bestNode = preferredNode;
    let bestWeight = -1;
    for (const [nodeName, info] of Object.entries(weights)) {
      if (info.weight > bestWeight) {
        bestWeight = info.weight;
        bestNode = nodeName;
      }
    }
    if (bestWeight <= 0) {
      bestNode = weights[fallbackNode]?.weight > 0 ? fallbackNode : preferredNode;
    }
    const degraded = bestNode !== preferredNode;
    const degradedReason = degraded ? `load_aware_reroute:${preferredNode}→${bestNode}(w=${bestWeight})` : '';
    return { selectedNode: bestNode, weights, degraded, degradedReason };
  }

  return {
    ping,
    refreshNodeStatus,
    getNodeStatusSync,
    computeNodeWeights,
    selectBestNode,
  };
}

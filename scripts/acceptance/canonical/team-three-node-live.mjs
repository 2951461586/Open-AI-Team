import { spawn } from 'node:child_process';

async function fetchJson(url = '') {
  try {
    const res = await fetch(url);
    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {}
    return { ok: res.ok, status: res.status, data, rawText, url };
  } catch (error) {
    return { ok: false, status: 0, error: String(error?.message || error || ''), url };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNodesWithWarmup({ attempts = 4, delayMs = 1200 } = {}) {
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    last = await fetchJson('http://127.0.0.1:19090/state/team/nodes');
    const nodes = last?.data?.nodes || {};
    if (last?.ok && nodes?.laoda?.reachable === true && nodes?.violet?.reachable === true && nodes?.lebang?.reachable === true) {
      return last;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  return last;
}

const REPO_ROOT = new URL('../../../', import.meta.url);

function runCommand(cmd, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const [bin, ...args] = cmd;
    const child = spawn(bin, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stdout, stderr });
    });
  });
}

function extractTrailingJson(text = '') {
  const s = String(text || '').trim();
  if (!s) return null;
  const starts = [];
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '{') starts.push(i);
  }
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(s.slice(starts[i]));
    } catch {}
  }
  return null;
}

const startedAt = Date.now();
const nodes = await fetchNodesWithWarmup();
const nodeSummary = {
  laodaReachable: nodes?.data?.nodes?.laoda?.reachable === true,
  lebangReachable: nodes?.data?.nodes?.lebang?.reachable === true,
  violetReachable: nodes?.data?.nodes?.violet?.reachable === true,
  plannerPreferredNode: String(nodes?.data?.deployment?.planner?.preferredNode || ''),
  criticPreferredNode: String(nodes?.data?.deployment?.critic?.preferredNode || ''),
  judgePreferredNode: String(nodes?.data?.deployment?.judge?.preferredNode || ''),
  authorityNode: String(nodes?.data?.deployment?.authority?.node || ''),
  outputNode: String(nodes?.data?.deployment?.authority?.outputNode || ''),
  observerPreferredNode: String(nodes?.data?.deployment?.observer?.preferredNode || ''),
};

const steps = [];

function pushStep({ key, label, result, validate }) {
  const parsed = extractTrailingJson(`${result.stdout || ''}\n${result.stderr || ''}`);
  const summary = parsed?.summary || null;
  const ok = !result.timedOut && Number(result.code || 0) === 0 && !!parsed && validate(parsed, summary);
  steps.push({
    key,
    label,
    ok,
    timedOut: result.timedOut,
    exitCode: result.code,
    signal: result.signal,
    summary,
    parsed,
    stderrTail: String(result.stderr || '').trim().split('\n').slice(-12),
  });
  return ok;
}

let ok = nodes.ok
  && nodeSummary.laodaReachable
  && nodeSummary.lebangReachable
  && nodeSummary.violetReachable
  && nodeSummary.plannerPreferredNode === 'violet'
  && nodeSummary.criticPreferredNode === 'lebang'
  && nodeSummary.judgePreferredNode === 'laoda'
  && nodeSummary.authorityNode === 'laoda'
  && nodeSummary.outputNode === 'laoda'
  && nodeSummary.observerPreferredNode === 'violet';

steps.push({
  key: 'nodes',
  label: 'three-node topology baseline',
  ok,
  timedOut: false,
  exitCode: nodes.status || 0,
  signal: null,
  summary: nodeSummary,
  parsed: nodes.data,
  stderrTail: nodes.ok ? [] : [String(nodes.error || nodes.rawText || 'nodes_fetch_failed')],
});

if (ok) {
  const ingress = await runCommand(['node', 'scripts/acceptance/canonical/team-three-node-async-ingress-live.mjs'], 120000);
  ok = pushStep({
    key: 'asyncIngressLive',
    label: 'three-node async ingress live acceptance',
    result: ingress,
    validate(parsed) {
      return parsed.ok === true;
    },
  });
}

if (ok) {
  const ingressMissingDeliveryMode = await runCommand(['node', 'scripts/acceptance/canonical/team-async-ingress-missing-delivery-mode-smoke.mjs'], 120000);
  ok = pushStep({
    key: 'asyncIngressMissingDeliveryMode',
    label: 'async ingress missing deliveryMode acceptance',
    result: ingressMissingDeliveryMode,
    validate(parsed, summary = {}) {
      return parsed.ok === true
        && summary.webhookEntryDeliveryMode === 'group'
        && summary.ingressHitDeliveryMode === 'group';
    },
  });
}

if (ok) {
  const planner = await runCommand(['node', 'scripts/acceptance/canonical/team-planner-violet-live.mjs'], 180000);
  ok = pushStep({
    key: 'plannerLocalAuthorityLive',
    label: 'planner local authority live acceptance',
    result: planner,
    validate(parsed, summary = {}) {
      return summary.selectedNode === 'violet'
        && summary.endpointVerified === true
        && summary.hasPlan === true
        && summary.planSubmitCount >= 1;
    },
  });
}

if (ok) {
  const critic = await runCommand(['node', 'scripts/acceptance/canonical/team-critic-lebang-live.mjs'], 180000);
  ok = pushStep({
    key: 'criticLocalAuthorityLive',
    label: 'critic local authority live acceptance',
    result: critic,
    validate(parsed, summary = {}) {
      return summary.hasApprovedReview === true
        && summary.selectedNode === 'lebang'
        && summary.routeConsistent === true
        && (summary.endpointVerified === true || summary.localFallbackVerified === true);
    },
  });
}

if (ok) {
  const visible = await runCommand(['node', 'scripts/acceptance/canonical/team-visible-delivery-dryrun-live.mjs'], 120000);
  ok = pushStep({
    key: 'visibleDeliveryDryrunLive',
    label: 'visible delivery dryrun acceptance',
    result: visible,
    validate(parsed, summary = {}) {
      return Number(summary.outputCommandEmittedCount || 0) >= 1
        && Number(summary.outputDeliveredCount || 0) >= 1
        && summary.authoritative === true
        && summary.visiblePayloadPrepared === true
        && summary.visibleDeliveredRecorded === true;
    },
  });
}

const firstFailure = steps.find((x) => !x.ok && !x.observationOnly) || null;

console.log(JSON.stringify({
  ok,
  acceptance: 'team-three-node-live.v2',
  startedAt,
  finishedAt: Date.now(),
  durationMs: Date.now() - startedAt,
  steps: steps.map((x) => ({
    key: x.key,
    label: x.label,
    ok: x.ok,
    observationOnly: x.observationOnly === true,
    timedOut: x.timedOut,
    exitCode: x.exitCode,
    signal: x.signal,
    summary: x.summary,
  })),
  firstFailure: firstFailure ? {
    key: firstFailure.key,
    label: firstFailure.label,
    stderrTail: firstFailure.stderrTail,
  } : null,
}, null, 2));


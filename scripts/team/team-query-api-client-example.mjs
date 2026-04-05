import { fetchContracts, fetchPublishedTaskReadModels } from '../../src/team/query-api/sdk.mjs';

const base = process.env.TEAM_API_BASE || 'http://127.0.0.1:19090';
const taskId = process.argv[2] || '';

async function main() {
  const contracts = await fetchContracts(base);
  const routeCatalog = contracts?.queryContracts?.routes || {};

  console.log('contract:', contracts.api.contract);
  console.log('routes:', Object.keys(routeCatalog).sort().join(', '));

  if (!taskId) {
    console.log('tip: pass a taskId to inspect summary/workbench/governance/pipeline/control');
    return;
  }

  const { summary, workbench, governance, pipeline, control } = await fetchPublishedTaskReadModels(base, taskId);

  console.log(JSON.stringify({
    taskId,
    summary: {
      route: summary.api.route,
      resource: summary.resource,
      currentMemberKey: summary.currentMemberKey,
      protocolSource: summary.protocolSource,
      nextBestAction: summary.nextBestAction,
    },
    workbench: {
      route: workbench.api.route,
      batchId: workbench.summary?.batchId || '',
      currentMemberKey: workbench.summary?.currentMemberKey || '',
      hasPlan: workbench.summary?.hasPlan === true,
      hasReview: workbench.summary?.hasReview === true,
      hasDecision: workbench.summary?.hasDecision === true,
    },
    governance: {
      route: governance.api.route,
      batchId: governance.batchId,
      counterKeys: Object.keys(governance.counters || {}),
      eventCount: Array.isArray(governance.events) ? governance.events.length : 0,
      timelineCount: Array.isArray(governance.timeline) ? governance.timeline.length : 0,
    },
    pipeline: {
      route: pipeline.api.route,
      phase: pipeline.pipeline?.phase || '',
      phaseProgress: pipeline.pipeline?.phaseProgress ?? null,
      judgeContractVersion: pipeline.roles?.judge?.contractVersion || '',
    },
    control: {
      route: control.api.route,
      manualActions: Array.isArray(control.manualActions) ? control.manualActions : [],
      controlEndpoint: control.controlEndpoint || '',
      exampleCount: Array.isArray(control.examples) ? control.examples.length : 0,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exitCode = 1;
});

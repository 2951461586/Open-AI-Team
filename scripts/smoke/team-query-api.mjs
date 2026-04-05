import { discoverLiveTaskId, fetchContracts, fetchRoot, fetchTaskBundle } from '../../src/team/query-api/sdk.mjs';

const base = process.env.TEAM_API_BASE || 'http://127.0.0.1:19090';

async function main() {
  const contracts = await fetchContracts(base);
  const root = await fetchRoot(base);
  const taskId = process.argv[2] || discoverLiveTaskId(root);

  const { summary, workbench, governance, pipeline, control } = await fetchTaskBundle(base, taskId);

  console.log(JSON.stringify({
    ok: true,
    summary: {
      taskId,
      contract: contracts.api.contract,
      discoveredFrom: process.argv[2] ? 'cli' : 'root.activeBatchOverview[0]',
      routeCatalogSize: Object.keys(contracts?.queryContracts?.routes || {}).length,
      summary: {
        route: summary.api.route,
        state: summary.resource?.state || '',
        currentMemberKey: summary.currentMemberKey || '',
        protocolSource: summary.protocolSource || '',
      },
      workbench: {
        route: workbench.api.route,
        batchId: workbench.summary?.batchId || '',
        hasPlan: workbench.summary?.hasPlan === true,
        hasReview: workbench.summary?.hasReview === true,
        hasDecision: workbench.summary?.hasDecision === true,
      },
      governance: {
        route: governance.api.route,
        batchId: governance.batchId || '',
        eventCount: Array.isArray(governance.events) ? governance.events.length : 0,
        timelineCount: Array.isArray(governance.timeline) ? governance.timeline.length : 0,
      },
      pipeline: {
        route: pipeline.api.route,
        phase: pipeline.pipeline?.phase || '',
        estimatedCompletion: pipeline.pipeline?.estimatedCompletion || '',
      },
      control: {
        route: control.api.route,
        manualActionCount: Array.isArray(control.manualActions) ? control.manualActions.length : 0,
      },
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exitCode = 1;
});

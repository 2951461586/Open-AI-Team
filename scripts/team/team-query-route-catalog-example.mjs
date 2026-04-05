import { fetchContracts, fetchResidents, selectPublishedRouteCatalog } from '../../src/team/query-api/sdk.mjs';

const base = process.env.TEAM_API_BASE || 'http://127.0.0.1:19090';

async function main() {
  const contracts = await fetchContracts(base);
  const featuredRoutes = selectPublishedRouteCatalog(contracts);
  const residents = await fetchResidents(base);

  console.log(JSON.stringify({
    ok: true,
    contract: contracts.api.contract,
    featuredRouteKeys: contracts?.queryContracts?.featuredRouteKeys || [],
    featuredRoutes,
    featuredRouteNames: Object.entries(featuredRoutes)
      .filter(([, value]) => value && typeof value === 'object' && value.path)
      .map(([key]) => key),
    residents: {
      route: residents.api.route,
      count: residents.counts?.count ?? residents.resource?.count ?? 0,
      busyCount: residents.counts?.busyCount ?? 0,
      activeLeaseCount: residents.counts?.activeLeaseCount ?? 0,
      observedAt: residents.observedAt ?? null,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exitCode = 1;
});

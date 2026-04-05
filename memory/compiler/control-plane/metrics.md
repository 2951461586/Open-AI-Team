# Memory Compiler Metrics
- Generated at: 2026-04-01T05:58:41.859Z
- Window: last 24h
- Evidence JSON: memory/compiler/reports/compiler-metrics.latest.json
## Trust
- control-plane trusted: true
- operator verdict: trusted-with-operator-backlog
- snapshot trust: trusted-with-operator-backlog
- final trust: trusted-with-operator-backlog (source=memory/compiler/reports/control-plane-verify.latest.json)
- acceptance: 0/0
- blockers: 0
- warnings: 4
## Inventory
- facts: 489
- threads: 46
- continuity: 28
- manifests: 1838
- source backlink sources: 215
- source backlink artifacts: 6227
## Review Queue
- open: 6
- operator open: 0
- acceptance open: 6
- source-dispatch blocking open: 0
- operator-facing blocking triage: 1
- blocking triage summary: 1. [blocking|high] operator blocking triage sample mnfmj5yk -> confirmed (score=77)
- resolved: 649
## Scheduler Window
- runs: 70
- avg jobs/run: 2.5285714285714285
- max jobs/run: 7
- throttled: 0
- deduped: 0
- pending queue: 1
## Runtime Bridge Probe
- scene: task
- source dispatch: false (blocking=false)
- source authority: trusted-derived-with-source-backing
- selected facts/threads/digests: 6/2/1
- runtime source mix quality: trusted-clean; supporting=sum,file
- runtime source mix authority/trusted ratio: 0.785 / 0.279
- source mix policy effect: budget=mixed-keep-budget; escalation=lcm-on-demand
- prepend chars: 1704
- runtime probe: preciseDispatch=true blocking=false taskMix=trusted-clean taskBudget=mixed-keep-budget
## Durable Batch Truth Contract
- latest namespace/scope: acceptance / failed-batch-replay-latest
- latest truth mode: acceptance-replay-latest-not-live-truth
- live truth run: durable-batch-mnfms3ej-dh6vaj
- acceptance latest run: durable-batch-mnfmuh6f-ut2p1o
- operator truth pointer: memory/compiler/reports/control-plane-verify.latest.json
## Session Pack / Handoff
- current pack: sessionpack_2fc8b5cd8cd2
- generated in window: 143
- latest handoff: handoff_ffad47472b1e
## Recent Scheduler Runs
1. heartbeat jobs=3 throttled=false deduped=false finished=2026-04-01T05:58:35.110Z
2. heartbeat jobs=4 throttled=false deduped=false finished=2026-04-01T05:58:15.178Z
3. heartbeat jobs=3 throttled=false deduped=false finished=2026-04-01T05:58:04.842Z
4. heartbeat jobs=3 throttled=false deduped=false finished=2026-04-01T05:57:54.902Z
5. heartbeat jobs=3 throttled=false deduped=false finished=2026-04-01T05:57:45.369Z
6. daily jobs=7 throttled=false deduped=false finished=2026-04-01T05:56:34.333Z
7. heartbeat jobs=3 throttled=false deduped=false finished=2026-04-01T05:56:24.459Z
8. session-end jobs=1 throttled=false deduped=false finished=2026-04-01T05:49:47.068Z
9. heartbeat jobs=3 throttled=false deduped=false finished=2026-04-01T05:49:36.610Z
10. session-end jobs=1 throttled=false deduped=false finished=2026-04-01T05:49:08.632Z

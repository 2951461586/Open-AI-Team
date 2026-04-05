# P8: Archive Directories Purge

**Date**: 2026-03-28
**Status**: ✅ Complete — Regression 15/15 PASS

## Summary

Deleted all archive directories from disk. Git history preserves full content.

## Deleted

| Directory | Files | Content |
|-----------|-------|---------|
| `archive/` (P1-P7 归档) | 157 | Pipeline-era src, adapters, routes, scripts |
| `scripts/archive/team-runtime/` (早期归档) | 24 | Pre-pipeline smoke tests |
| `docs/archive/` | 0 | Empty dir |
| **Total** | **181** | **~19,871 lines .mjs** |

## Collateral updates
- `config/system.manifest.json`: removed `archiveRoot`, `docs.archive` keys; updated debate note
- `docs/index.md`: updated archive section to reference git history
- No npm scripts affected (already cleaned in P7)

## Verification
- Regression 15/15 PASS ✅
- No dangling `archive/` references in config or docs ✅
- `system.manifest.json` valid JSON ✅

## Final P1-P8 Pipeline Retirement Summary

| Phase | Action | Lines Removed |
|-------|--------|--------------|
| P1 | Pipeline runtime core (13 files) | ~2,970 |
| P2 | Pipeline adapters (49 files) | ~6,500 |
| P3 | Pipeline routes + v1 dispatch | ~810 |
| P4 | Pipeline shim + 12 smoke tests | ~1,775 |
| P5 | Bootstrap + dead imports | ~91 |
| P6 | 7 orphan team modules | ~785 |
| P7 | 68 dead scripts + 4 npm entries | ~4,949 |
| P8 | Archive purge (181 files) | ~19,871 (from disk) |
| **Active code retired** | **P1-P7** | **~17,880** |

> P8 doesn't add to "active code retired" since archive files were already dead.
> It removes ~19,871 lines of dead weight from the working tree.

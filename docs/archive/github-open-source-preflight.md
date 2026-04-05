# GitHub Open-Source Preflight

This document captures the current large-grain execution order for open-source cleanup.

## P0 — Release Blockers

Done in this pass:
- added `LICENSE`
- removed `private: true` from `package.json`
- replaced private `.env.example` values with neutral placeholders
- rewrote `README.md` around a host-neutral product narrative
- added `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- added a minimal GitHub Actions smoke workflow
- removed committed runtime output from `run/`

## P1 — Public Contract Surface

Done in this pass:
- added initial public schemas under `schemas/`
- added `docs/architecture/public-contract-schemas.md`
- added `examples/third-party-agent-sample/`
- neutralized public ingress examples toward `group:*` / `dashboard:*`
- added public example config files under `config/examples/`

## P2 — Remaining Deep Coupling To Retire

Current status after the canonical-node cleanup pass:
- active runtime/config now uses public-safe canonical node IDs (`node-a`, `node-b`, `node-c`)
- active source keeps a bounded legacy alias compatibility layer, but canonical IDs are the primary semantics
- maintainer-specific public IPs / tailnet hosts have been removed from active `config/team/*.json`
- ops/investigation scripts have been shifted toward env-driven remote targets instead of hard-coded private hosts
- archive and compat material still preserve historical QQ/OpenClaw context, but should keep historical labels clearly separated from current canonical guidance

## P6 — Release Engineering and CI

Done in this pass:
- replaced the minimal single-job GitHub Actions workflow with layered public-safe jobs (`mainline`, `public-contracts`, `oss-minimal`, `third-party-template`)
- documented release engineering authority in `docs/architecture/release-engineering-and-ci.md`
- added a release-engineering / CI smoke gate to guard workflow layering and release-doc discoverability
- documented the current dashboard build boundary honestly: repo-scoped contract surface vs workspace-only sibling app shell

## P7 — Dashboard Single-Repo Build Authority

Done in this pass:
- moved the dashboard app shell in-tree under `dashboard/` with repo-local package/config/public/script surface
- replaced sibling-workspace dashboard build assumptions with repo-local build authority
- added a `dashboard-build` GitHub CI lane for actual dashboard app builds plus bundle residue scan
- added a dedicated P7 smoke to guard single-repo dashboard build authority and repo/docs alignment

## P8 — Release Artifacts and Publish Pipeline

Done in this pass:
- added a local release artifact staging command (`npm run release:stage-artifacts`)
- added CI artifact upload for public contracts, source docs, dashboard static export, oss-minimal evidence, and third-party sample bundles
- added a tag-triggered `release.yml` workflow plus `workflow_dispatch` dry-run path
- added a dedicated P8 smoke to guard release artifact / publish pipeline structure
- documented release artifact classes, release bundles, and tag publish flow in `docs/architecture/release-artifacts-and-publishing.md`

## P9 — Release Notes, Provenance, and Version Story

Done in this pass:
- added local release notes generation (`npm run release:notes`)
- added staged `PROVENANCE.json` and `VERSION-STORY.json` outputs beside release-manifest data
- aligned `dashboard` to the repo release track version and documented a deliberate dual-track version story
- upgraded `release.yml` to publish notes/provenance/version-story assets and use generated release notes as the GitHub release body
- added a dedicated P9 smoke to guard notes/provenance/version-track alignment

## Recommended Next Cut

1. add stronger provenance/signing layers (sigstore or equivalent) beyond SHA256 checksums
2. expand third-party validation from validator+smoke to a fuller end-to-end sample package exercise
3. continue shrinking maintainer-only runtime/config assumptions from active source
4. consider future package/app split (`apps/dashboard`, `packages/*`) once repo boundaries are fully stable
5. optionally automate changelog sectioning from conventional commit classes when commit discipline is ready

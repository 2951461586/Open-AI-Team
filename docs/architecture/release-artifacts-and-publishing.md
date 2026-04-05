# Release Artifacts and Publishing

> P8 authority document for deciding **what release artifacts exist**, **how CI uploads them**, and **how tag-based publishing works**.

---

## 1. Goal

P8 turns release engineering from “green CI + docs confidence” into a **publishable artifact pipeline**.

The purpose is to make every GitHub-facing release answer three concrete questions:
- what files should a release attach?
- which job produces each artifact?
- what is the tag-based path from validation to published release assets?

---

## 2. Release Artifact Classes

### A. Public contracts bundle
Produced from:
- `schemas/`
- `fixtures/public-contracts/`

Purpose:
- give external consumers a contract-first bundle
- make schema/fixture compatibility easy to download and pin

### B. Dashboard static export bundle
Produced from:
- `dashboard/out/`
- `dashboard/README.md`
- `dashboard/DEPLOY-OSS.md`

Purpose:
- expose the repo-local dashboard build result as a release artifact
- make the UI surface independently inspectable from source tree browsing

### C. OSS minimal evidence bundle
Produced from:
- latest `examples/oss-minimal/.runs/*/run-report.json`
- `examples/oss-minimal/agent-manifest.json`
- `examples/oss-minimal/agent-package.json`
- `examples/oss-minimal/README.md`

Purpose:
- provide runnable-sample evidence, not just source code
- attach one canonical run-report snapshot to releases

### D. Third-party sample bundle
Produced from:
- `examples/third-party-agent-sample/README.md`
- `agent-manifest.json`
- `agent-package.json`
- `agent-shell.mjs`

Purpose:
- provide a forkable onboarding template as a download-friendly artifact

### E. Source docs bundle
Produced from:
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `LICENSE`
- key release/p8 authority docs
- `dashboard/README.md`

Purpose:
- attach the release narrative authority alongside binaries/static outputs

---

## 3. Staging Command

Stage all release artifacts locally with:

```bash
node scripts/team/team-stage-release-artifacts.mjs
```

Or use the package entrypoint:

```bash
npm run release:stage-artifacts
```

Output root:

```text
.release-artifacts/
  public-contracts/
  dashboard-static-export/
  oss-minimal/
  third-party-agent-sample/
  source-docs/
  release-manifest.json
```

---

## 4. CI Upload Policy

### `public-contracts` job uploads
- public contracts bundle
- source docs bundle

### `dashboard-build` job uploads
- dashboard static export bundle

### `oss-minimal` job uploads
- OSS minimal evidence bundle

### `third-party-template` job uploads
- third-party sample bundle

Rule:
- every uploaded workflow artifact should correspond to a documented public artifact class
- CI uploads should use stable names and not depend on private paths or live infra

---

## 5. Tag Publish Flow

### Validation phase
Before publishing a versioned release:
- `npm run smoke:team`
- `npm run fixtures:route-derived`
- `npm run smoke:public-schemas`
- `npm run smoke:dashboard-public-contract`
- `npm run dashboard:build`
- `npm run dashboard:check-bundle`
- `npm run smoke:oss-minimal`
- `npm run demo:oss-minimal`
- `npm run validate:agent-package`
- `npm run validate:third-party-agent`
- `npm run smoke:third-party-agent`
- `npm run release:stage-artifacts`

### Publish phase
Canonical release trigger:
1. create tag `vX.Y.Z`
2. push tag to GitHub
3. `release.yml` reruns validation/build/staging
4. workflow packs `.release-artifacts/*` into release bundles
5. GitHub Release is created/updated with attached archives + checksums

### Manual verification phase
`workflow_dispatch` should still be available for dry-run staging + artifact upload without requiring an actual publish.

---

## 6. Required Release Bundles

A tag-based GitHub release should publish:
- `public-contracts.tar.gz`
- `dashboard-static-export.tar.gz`
- `oss-minimal-evidence.tar.gz`
- `third-party-agent-sample.tar.gz`
- `source-docs.tar.gz`
- `PROVENANCE.json`
- `VERSION-STORY.json`
- `RELEASE-NOTES.md`
- `SHA256SUMS.txt`

---

## 7. P8 Acceptance Bar

P8 is complete when:
1. CI uploads documented artifact bundles from the right jobs
2. a release workflow exists for tag-based publish
3. a staging script can reproduce the release artifact tree locally
4. release docs describe the tag flow and attached bundles
5. mainline contains a smoke that guards this publish pipeline structure

---

## 8. One-line Rule

**A release is not just green CI — it is a reproducible set of public artifacts with a documented tag-to-publish path.**

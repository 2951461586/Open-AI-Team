# Release Notes, Provenance, and Version Story

> P9 authority document for deciding **how release notes are generated**, **what provenance metadata must ship**, and **how version numbers are explained across the repository**.

---

## 1. Goal

P9 makes a release not only publishable, but also **explainable**.

A public release should answer three questions:
- what changed?
- what exact source/build context produced these artifacts?
- why do some surfaces share a version while others intentionally do not?

---

## 2. Release Notes

Generate release notes with:

```bash
npm run release:stage-artifacts
npm run release:notes
```

Primary output:
- `.release-artifacts/RELEASE-NOTES.md`

Rules:
- release notes should summarize both release tracks
- release notes should list attached bundles
- release notes should include recent commit summary
- tag-based GitHub releases should use `RELEASE-NOTES.md` as the release body source

---

## 3. Provenance Metadata

Every staged release must produce:
- `.release-artifacts/PROVENANCE.json`
- `.release-artifacts/VERSION-STORY.json`

### `PROVENANCE.json`
Machine-readable release context:
- generated timestamp
- release tag / ref when available
- git commit SHA when available
- workflow/run metadata when available
- staged artifact target summary
- release track versions

### `VERSION-STORY.json`
Machine-readable explanation of version tracks and included surfaces.

---

## 4. Dual-Track Version Story

P9 keeps a **dual-track version story** on purpose.

### A. Repo release track
Current authority version:
- root package version
- dashboard package version
- third-party sample manifest version
- GitHub tag/release narrative

This track is the public GitHub-facing release track.

### B. Standalone harness track
Current authority version:
- `src/agent-harness-core/oss-agent-manifest.json`
- `examples/oss-minimal/agent-manifest.json`

This track keeps the standalone broker/harness substrate lineage explicit.
It does **not** need to equal the repo release track on every cut.

### P9 rule
- dashboard should align to the repo release track
- third-party sample should align to the repo release track
- standalone harness / oss-minimal sample may stay on their own substrate version track when justified
- release notes and provenance must explain both tracks together

---

## 5. Publish Behavior

`release.yml` should:
- run staging
- generate release notes
- pack release bundles
- attach `PROVENANCE.json`, `VERSION-STORY.json`, and `RELEASE-NOTES.md`
- use `RELEASE-NOTES.md` as the GitHub release body

---

## 6. P9 Acceptance Bar

P9 is complete when:
1. release notes can be generated locally
2. provenance/version-story JSON files are staged locally
3. release workflow publishes notes + provenance assets
4. version-story rules are documented and machine-readable
5. mainline contains a smoke that guards notes/provenance/version-track alignment

---

## 7. One-line Rule

**A strong release explains not only what ships, but also what version story and source provenance made it real.**

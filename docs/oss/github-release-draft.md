# GitHub Release Draft

## AI Team Runtime: open-source repo convergence release

This release turns the repository from a partially-internal system into a much clearer open-source product line.

### Highlights

- **AI Team Runtime + Dashboard** are now the clear primary product story.
- **Agent Harness** is now presented as the reusable standalone execution substrate.
- **Independent-agent onboarding** is backed by runnable examples, package/manifest contracts, and smoke/validation coverage.
- **Dashboard contracts** now align more cleanly with stable public read models.
- **Release engineering and repo-boundary guardrails** have been tightened to support GitHub-facing publication.

### What changed

#### 1. Public product framing
The repo now has a clearer reading order and authority map:
- AI Team Runtime
- Dashboard
- Agent Harness
- Optional Integrations

This reduces confusion around legacy paths, transition surfaces, and host-specific wiring.

#### 2. Stronger execution substrate
The harness surface now better reflects a stronger execution baseline, including:
- normalized execution envelopes
- tool/runtime evidence capture
- remote broker / worker path reliability improvements
- standalone baseline credibility for OSS minimal runs

#### 3. Better dashboard/public-contract alignment
Dashboard-facing flows now prefer stable shared read models instead of relying only on payload-local assumptions.
This makes the UI surface more credible as a public workbench/observability layer.

#### 4. Third-party agent onboarding credibility
Independent-agent onboarding is no longer just a docs claim.
The repo now includes a more productized public sample and validation flow for third-party agents.

#### 5. Release and hygiene guardrails
The repo has stronger release-facing checks around:
- public release story
- repo boundary hygiene
- runnable example credibility
- contract validation

### Validation snapshot
The following checks are green in the current release-prep pass:
- `npm run smoke:oss-minimal`
- `npm run smoke:release-engineering`
- `npm run validate:agent-package`
- `npm run audit:repo-boundary`
- `npm run audit:repo-hygiene`

### Notes for contributors
If you are new here, start with:
1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `docs/oss/repo-authority.md`
5. `docs/oss/contributor-start-here.md`

### Upgrade note
This release is mostly about **clarity, boundaries, packaging, and OSS credibility** rather than a single end-user feature drop.

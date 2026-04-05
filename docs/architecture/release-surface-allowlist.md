# Release Surface Allowlist

> P0 authority document for deciding what belongs to the public GitHub-facing surface, what is optional integration surface, and what should be treated as maintainer/private or historical context.

---

## 1. Public Mainline Surface

These paths belong to the main public product and should remain public-safe, documented, and contributor-friendly.

### Product entry and authority docs
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `docs/architecture/`
- `docs/api/`
- `docs/index.md`

### Core runtime and contracts
- `src/team/`
- `src/team-core/`
- `src/team-runtime-adapters/` *(only for neutral adapter contracts and mainline runtime wiring)*
- `src/routes/`
- `src/agent-harness-core/`
- `schemas/`
- `config/examples/`

### Product applications and public examples
- `dashboard/src/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`
- `examples/team-runtime-public/`
- `fixtures/public-contracts/`

### Public validation surface
- `scripts/smoke/`
- public-safe parts of `scripts/team/`
- `.github/workflows/`

---

## 2. Public But Secondary / Transitional Surface

These paths may stay in the repository during transition, but should not dominate the first-time contributor story.

- `config/team/`
- `config/README.md`
- `examples/README.md`
- `dashboard/README.md`
- `scripts/README.md`
- `fixtures/README.md`
- selected fixture-generation tooling

### Background / non-authority context kept in-tree
These may remain visible in the repository, but should not be treated as primary product authority:
- `references/`
- `memory/`

### Locked interpretation
- `config/examples/` = public-safe example config surface
- `config/team/` = maintainer-facing active runtime inventory
- `fixtures/public-contracts/` = public contract sample/validation surface
- `references/` = background comparison material only

Rule:
- allowed in-tree
- referenced only when relevant
- not a replacement for the main public product narrative

---

## 3. Optional Integration Surface

These paths are allowed only as **optional integrations**, not as the primary product definition.

- `src/integrations/openclaw/`
- compatibility ingress layers for QQ / webhook / NapCat
- host-specific control-plane wiring
- compatibility field normalization for legacy envelopes

Rule:
- may exist
- must be documented as optional
- must not define the default mental model for the product

---

## 4. Maintainer / Private / Live-Ops Surface

These paths or materials should be treated as maintainer-facing, private, or candidates for future split/quarantine.

- `scripts/ops/`
- `scripts/acceptance/` *(especially live/multi-node environment checks)*
- live deployment docs and maintainer-host notes under `docs/ops/`
- paths containing production hostnames, private paths, or deployment-specific operational assumptions
- local runtime state and generated outputs such as `state/` and `run/`

Rule:
- useful for maintainers
- not part of the public product promise
- should gradually move behind clearer maintainer/private boundaries

---

## 5. Historical / Archive Surface

These paths are historical reference only:
- `docs/archive/`
- retired compatibility explanations
- old runtime migration notes once superseded by current authority docs

Rule:
- preserved for context
- never used as current product authority
- should be clearly labeled historical / not-for-mainline

---

## 6. Contribution Rule of Thumb

Before adding or editing a path, ask:

1. Is this part of the public product?
2. Is it only an optional integration?
3. Is it maintainer/private ops?
4. Is it historical?

If the answer is unclear, it does **not** belong in the primary public surface by default.

---

## 7. P0 Release Guardrail

A GitHub-facing release should make it easy to identify:
- what the product is
- what the reusable substrate is
- what the onboarding SDK/contract surface is
- what integrations are optional
- what material is historical or maintainer-only

Any path that blurs these lines should be treated as cleanup debt.

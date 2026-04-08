# @ai-team/agent-harness

A **forkable execution substrate** for standalone or third-party agents.

This package is the canonical package authority for the standalone harness line. It is meant to be understandable and reusable **without** requiring OpenClaw-specific session internals.

---

## What this package is

`@ai-team/agent-harness` is the reusable harness layer that provides:
- runtime contract builders
- workflow/policy abstractions
- provider registry wiring
- shell / doctor / activation surfaces
- session / desk / bridge / lifecycle contracts
- standalone runtime assets

Use it when you want:
- a harness substrate you can fork
- explicit onboarding contracts for independent agents
- a shell-driven activation and doctor workflow
- a host-neutral execution baseline

---

## Core concepts

### Manifest
Declares runtime shape, worker/broker entries, provider declarations, and host-neutral runtime assumptions.

### Agent package
Declares the product-facing contract surface:
- session
- desk
- host-layer
- bridge
- lifecycle
- capability gate
- shell
- plugin refs

### Provider registry
Connects abstract declared capabilities to concrete runtime providers.

### Shell / doctor / activation
Gives external integrators a productized entrypoint instead of forcing them to reverse-engineer internals.

### Session / desk / bridge
Defines how an agent runs, collaborates, exchanges artifacts, and participates in host-neutral flows.

---

## What this package owns

- harness SDK / contract builders
- workflow / policy pack abstractions
- provider registry / backend provider / broker runtime adapters
- agent shell / product shell / role worker
- sandbox / plugin / tool runtime / capability surfaces
- standalone broker product runtime
- standalone harness manifest / package assets mirrored for package-owned release surface

---

## What this package does not own

- Team Runtime orchestration policy under `packages/team-runtime/`
- app bootstrap / route assembly under app/server surfaces
- host-specific team runtime adapters
- optional integration wiring such as OpenClaw-specific host surfaces

---

## Lifecycle model

At a high level, the package supports:

```text
manifest + package
  -> provider registry
  -> runtime bootstrap
  -> run creation
  -> role worker execution
  -> artifact / desk / bridge interactions
  -> completion / resume / doctor
```

This makes it suitable as a **strong execution base**, not just a helper library.

---

## Key files

- `src/index.mjs` — package export surface
- `src/standalone-product-runtime.mjs` — standalone runtime entry
- `src/agent-shell.mjs` — shell surface
- `src/product-shell.mjs` — product-facing shell
- `src/provider-registry.mjs` — provider wiring
- `src/role-worker.mjs` — worker runtime
- `src/remote-broker-server.mjs` — broker server
- `src/oss-agent-manifest.json` — product manifest asset
- `src/oss-agent-package.json` — product package asset

---

## Minimal runnable path

If you want the shortest path to a working baseline, use the OSS minimal example:

```bash
npm install
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
```

Then read:
- `../../examples/oss-minimal/README.md`
- `../../docs/architecture/independent-agent-onboarding.md`

---

## Third-party onboarding path

If your goal is to integrate an external agent:

```bash
npm run validate:third-party-agent
npm run smoke:third-party-agent
node examples/third-party-agent-sample/agent-shell.mjs package
node examples/third-party-agent-sample/agent-shell.mjs onboarding
```

This demonstrates a host-neutral path based on explicit contracts rather than host-private session semantics.

---

## Contract map

| Surface | Purpose |
|---|---|
| manifest | runtime/bootstrap/provider declaration |
| package | product-facing agent contract |
| provider registry | runtime provider binding |
| shell | onboarding / doctor / activation |
| session | execution/session boundary |
| desk | artifact/file/note collaboration |
| bridge | route/transport interop |
| lifecycle | heartbeat / cron / long-running behavior |
| capability gate | safety / injected capability policy |

---

## Compatibility rule

Legacy source paths under `src/agent-harness-core/` remain compatibility shims or compatibility asset paths only.
New harness logic should land in `packages/agent-harness/`.

---

## Position in the repo

This package is the answer to:

> “What is the reusable execution substrate I can fork even if I do not want the whole Team Runtime product?”

For the higher-level runtime product, see:
- `../team-runtime/README.md`
- `../../docs/oss/what-is-ai-team-runtime.md`

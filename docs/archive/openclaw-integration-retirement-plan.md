# OpenClaw Integration Retirement Plan

> Purpose: identify the remaining **active OpenClaw-specific coupling points** and lock the cleanup order so the repository can stay host-neutral by default while preserving OpenClaw as an optional integration package.

## 1. Current verified state

The repository is **no longer OpenClaw-first** at the main narrative level, but several active coupling points still remain in runtime wiring and maintainer-facing operational surfaces.

Verified active coupling points:

- `src/integrations/openclaw/host-bootstrap.mjs`
- `src/integrations/openclaw/session-control-plane-tools.mjs`
- `src/index-bootstrap.mjs` currently imports `createOpenClawRemoteSessionHostBootstrap()` as the default remote-session host bootstrap
- `src/index-host-config.mjs` still contains maintainer-host assumptions such as:
  - `orchestrator.service`
  - service-env probing
  - live `/proc/*/environ` fallback probing
  - alias-aware node inventory merging for current maintainer topology
- `config/team/network-ports*.json` and `config/team/roles.json` still encode current maintainer topology and aliases
- live acceptance / maintainer scripts still target current node identities and active topology assumptions
- deployment scripts/docs still contain instance-specific defaults such as `board.liziai.cloud`, `api.liziai.cloud`, `/root/.openclaw/*`, `/srv/...`

## 2. Residual coupling classes

### A. Optional integration coupling *(allowed, but should stay isolated)*
These are acceptable if they remain outside the default product path:

- OpenClaw tool-name mapping
- OpenClaw session/control-plane semantics
- host bootstrap wiring for OpenClaw-backed remote sessions

Current home:
- `src/integrations/openclaw/`

### B. Maintainer-host coupling *(should not define public mental model)*
These are currently still mixed into active runtime or ops-facing code:

- `orchestrator.service` default assumptions
- service-env and `/proc` probing
- current maintainer node aliases (`laoda`, `violet`, `lebang`)
- current runtime topology files under `config/team/`

Current home:
- `src/index-host-config.mjs`
- `src/team/team-node-health.mjs`
- `config/team/*`
- `scripts/acceptance/canonical/*`
- `scripts/ops/*`

### C. Public docs/deploy defaults that still leak maintainer instance assumptions
These are not core runtime coupling, but they still make the repo feel operator-owned rather than public:

- `scripts/deploy/dashboard-cloudbase.sh`
- docs mentioning `board.liziai.cloud`
- docs mentioning `api.liziai.cloud`
- docs mentioning `/root/.openclaw/*`

## 3. Locked cleanup direction

### Keep
Keep as optional integration only:
- `src/integrations/openclaw/`

### Isolate further
Move toward explicit package/integration boundaries for:
- OpenClaw host bootstrap
- OpenClaw tool-name mapping
- maintainer-host config probing helpers

### Neutralize in-place
Continue removing host-specific assumptions from:
- active README / onboarding / baseline docs
- dashboard primary field names
- public schema ids and sample payloads
- public deploy docs and default env examples

## 4. Concrete cleanup phases

### Phase B1 — make OpenClaw explicitly optional at bootstrap boundary
Current problem:
- `src/index-bootstrap.mjs` still imports OpenClaw bootstrap as the default remote-session host bootstrap implementation.

Target:
- `index-bootstrap` should depend on a host-neutral bootstrap selector contract.
- OpenClaw bootstrap should be injected/configured as an optional integration implementation, not appear as the default hardwired import.

### Phase B2 — split host-runtime probing from public runtime bootstrap
Current problem:
- `src/index-host-config.mjs` mixes:
  - neutral env/config loading
  - maintainer-host systemd/proc probing
  - current topology alias handling

Target split:
- neutral config loader
- maintainer-host probe helper
- topology inventory resolver

### Phase B3 — downgrade current node identity assumptions
Current problem:
- active code and acceptance still speak in `laoda / violet / lebang`.

Target:
- primary runtime docs/tests should prefer `node-a / node-b / node-c` or role-based neutral ids
- maintainer-facing overlays may still map aliases for live ops only

### Phase B4 — strip public deploy/default leakage
Current problem:
- some scripts/docs still default to maintainer instance values.

Target:
- public deploy scripts require explicit env injection
- instance-specific defaults move to maintainer-only docs or local overlays

## 5. Exit criteria

This cleanup line is complete when:

- OpenClaw integration remains present but clearly optional
- active bootstrap no longer hardwires OpenClaw as the default remote-session path
- maintainer-host probing is separated from neutral runtime config loading
- public docs and examples no longer depend on maintainer instance values
- active narrative can be understood without reading OpenClaw internals first

## 6. One-line conclusion

The repo is already **OpenClaw-compatible**, but not yet fully **OpenClaw-detached**. The remaining work is mainly about removing default-host assumptions from active bootstrap, host config probing, and maintainer-facing deployment defaults.

# Contributing

## Development Flow

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Run a baseline smoke:
   - `npm run smoke:oss-minimal`
   - `npm run smoke:team`

## Ground Rules

- Keep host-neutral logic in `packages/agent-harness/` and `packages/team-core/` (legacy `src/agent-harness-core/` / `src/team-core/` are compatibility shim surfaces only)
- Put host/runtime-specific wiring in `src/team-runtime-adapters/` (not in packaged team-runtime export modules)
- Put historical material in `docs/archive/`, not in current authority docs
- Avoid introducing private host paths, internal node names, or provider-specific assumptions into public defaults
- Do not present `plugins/`, `services/`, `electron/`, `projects/`, or `shared/` as primary product authority unless an explicit authority flip is documented
- Keep runtime/generated areas such as `state/`, `data/`, `run/`, `logs/`, `tmp/`, `artifacts/`, and `reports/` out of the product narrative

## Pull Request Checklist

- [ ] no secrets or private infrastructure identifiers added
- [ ] docs updated for user-visible contract changes
- [ ] smoke coverage updated or justified
- [ ] backward-compatibility impact explained
- [ ] legacy compat additions explicitly marked
- [ ] no secondary/non-mainline directory is accidentally presented as primary authority
- [ ] no runtime/generated/local-state directory is being promoted into public product docs

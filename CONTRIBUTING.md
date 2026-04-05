# Contributing

## Development Flow

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Run a baseline smoke:
   - `npm run smoke:oss-minimal`
   - `npm run smoke:team`

## Ground Rules

- Keep host-neutral logic in `src/agent-harness-core/` and `src/team-core/`
- Put host/runtime-specific wiring in `src/team-runtime-adapters/`
- Put historical material in `docs/archive/`, not in current authority docs
- Avoid introducing private host paths, internal node names, or provider-specific assumptions into public defaults

## Pull Request Checklist

- [ ] no secrets or private infrastructure identifiers added
- [ ] docs updated for user-visible contract changes
- [ ] smoke coverage updated or justified
- [ ] backward-compatibility impact explained
- [ ] legacy compat additions explicitly marked

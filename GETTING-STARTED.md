# Getting Started

## 1. 5 Minutes

See it running — no configuration needed:

```bash
git clone <your-repo-url> ai-team-harness
cd ai-team-harness
npm install
cp .env.example .env
npm run smoke:team          # should pass in ~30s
node examples/oss-minimal/product-shell.mjs  # run a demo task
cd dashboard && npm run dev  # open http://localhost:3000
```

That's it. You should see the dashboard with a task timeline.

---

## 2. Understand What You're Looking At

```
src/team/          → Multi-agent runtime (Planner, Executor, Critic, Judge)
src/routes/        → HTTP API routes
dashboard/         → Next.js web UI
examples/          → Runnable demos
schemas/           → Machine-readable API contracts
scripts/team/      → Smoke tests (each validates one boundary)
```

## 3. Choose Your Interest

Don't try to understand the whole repo at once. Pick one:

### I want the team workflow
Read: `ARCHITECTURE.md` → `src/team/`

### I want the dashboard / frontend
```bash
cd dashboard && npm install && npm run dev
```
Key files: `dashboard/src/components/panels/WorkbenchPanel.tsx`, `dashboard/src/components/TaskCard.tsx`

### I want the agent substrate (forkable core)
Read: `src/agent-harness-core/README.md` → `examples/oss-minimal/`

### I want to contribute a third-party agent
Read: `examples/third-party-agent-sample/README.md`

---

## 4. Deep Dives

Once you've picked a focus:

- **Runtime architecture:** `docs/architecture/current-team-runtime-architecture.md`
- **Execution contracts:** `docs/architecture/execution-product-surface-and-delivery-closure.md`
- **Dashboard contracts:** `docs/deploy/dashboard-source-authority.md`
- **API reference:** `docs/api/`
- **Repo map (detailed):** `docs/architecture/product-surface-and-repo-map.md`

---

## 5. Contributing

1. Keep host-neutral logic in `src/team-core/` and `src/agent-harness-core/`
2. Each new surface needs a smoke test in `scripts/team/`
3. Update docs for user-visible changes
4. No hard-coded host paths, machine names, or platform assumptions in public defaults

Before making a PR, run `npm run smoke:team` and make sure it passes.

---

## 6. Troubleshooting

- `npm run smoke:team` fails → check Node version (need 22+)
- dashboard won't build → run `npm ci` in `dashboard/` first
- dashboard contract / build validation → `npm run dashboard:build` from repo root
- API port conflict → set `PORT=19090` in `.env` or pick another port

---

## 7. Repository Boundaries

- **Public primary surfaces:** `src/`, `dashboard/`, `schemas/`, `examples/`
- **Maintainer-only surfaces:** `config/team/`, `docs/ops/`, `scripts/ops/`
- **Historical reference:** `docs/archive/` — context only, not current authority

Start with the public surfaces. Only look at the rest when you have a specific reason.

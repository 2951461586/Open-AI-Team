# Examples

Three public tracks — pick one:

## 1. Main Product — AI Team Runtime + Dashboard

Run the full orchestrator with dashboard UI:

```bash
npm install
npm run smoke:team
cd dashboard && npm run dev
```

## 2. Minimal Standalone — `oss-minimal/`

Lightweight demo of the agent substrate without a full orchestrator:

```bash
npm run demo:oss-minimal
npm run status:oss-minimal
```

See [oss-minimal/README.md](oss-minimal/README.md).

## 3. Third-Party Agent Template

Minimal forkable agent package for external onboarding:

See [third-party-agent-sample/README.md](third-party-agent-sample/README.md).

---

**Rule:** Examples help you run or fork. They don't redefine the main product boundary. See [GETTING-STARTED.md](../GETTING-STARTED.md) for the full guide.

# Dashboard Public Deployment Template

> This file describes the **public / reusable** deployment shape for the dashboard.
> Instance-specific maintainer details remain in `DEPLOY.md`.

## Goal

Deploy the dashboard without assuming:
- `board.liziai.cloud`
- `api.liziai.cloud`
- `/srv/board.liziai.cloud`
- `/root/.openclaw/*`
- a specific systemd override path

## Required Build Inputs

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE` | API base URL consumed by the dashboard |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for realtime chat/events |
| `NEXT_PUBLIC_WORKSPACE` | Default workspace scope |
| `NEXT_PUBLIC_ENABLE_REALTIME` | Enable realtime mode (`1` or empty) |
| `NEXT_PUBLIC_DASHBOARD_TOKEN` | Browser-visible dashboard-scoped token |

## Optional Deploy Inputs

| Variable | Purpose |
|---|---|
| `LOCAL_STATIC_DIR` | Local static output sync target |
| `TCB_ENV_ID` | CloudBase environment ID |
| `TCB_SECRET_ID` / `TCB_SECRET_KEY` | CloudBase credentials |
| `TENCENT_CREDENTIALS_FILE` | Alternate credentials file |
| `ORCH_OVERRIDE_FILE` | Optional override source for dashboard token |
| `SKIP_BUILD=1` | Deploy existing `out/` only |

## Example

```bash
NEXT_PUBLIC_API_BASE=https://api.example.com \
NEXT_PUBLIC_WS_URL=wss://api.example.com/ws/chat \
NEXT_PUBLIC_WORKSPACE=main \
NEXT_PUBLIC_ENABLE_REALTIME=1 \
NEXT_PUBLIC_DASHBOARD_TOKEN=dashboard_scope_token \
LOCAL_STATIC_DIR=/srv/example-dashboard \
TCB_ENV_ID=your-cloudbase-env \
bash scripts/deploy/dashboard-cloudbase.sh
```

## Recommended Rule

Treat `scripts/deploy/dashboard-cloudbase.sh` as a **maintainer-friendly deploy entry**, not as proof that all public users should mirror the same host layout.

## Reverse Proxy Example (Caddy)

A reusable split deployment template now lives at:

- `scripts/deploy/Caddyfile.dashboard-api.example`

It reflects the currently working production shape:
- board domain serves static dashboard files
- api domain reverse-proxies the orchestrator
- API origin explicitly answers CORS preflight for the board origin
- `/ws/*` is forwarded with HTTP/1.1 for WebSocket traffic
- `/` on the API origin returns an explicit JSON health-style payload instead of hanging

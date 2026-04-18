FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV CI=true \
    NODE_ENV=production

FROM base AS dashboard-prebuilt
WORKDIR /app
COPY dashboard/out ./dashboard/out

FROM base AS runtime-builder
WORKDIR /app
COPY package.json package-lock.json pnpm-workspace.yaml ./
COPY src ./src
COPY scripts ./scripts
COPY config ./config
COPY packages ./packages
COPY apps ./apps
COPY examples ./examples
COPY fixtures ./fixtures
COPY schemas ./schemas
COPY .env.example ./.env.example
COPY node_modules ./node_modules
COPY --from=dashboard-prebuilt /app/dashboard/out ./dashboard/out
RUN mkdir -p /app/state /app/task_workspaces /app/config/team

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=19090 \
    MCP_PORT=7331 \
    BIND=0.0.0.0 \
    CI=true

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY --from=runtime-builder /app/node_modules ./node_modules
COPY --from=runtime-builder /app/package.json ./package.json
COPY --from=runtime-builder /app/package-lock.json ./package-lock.json
COPY --from=runtime-builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=runtime-builder /app/src ./src
COPY --from=runtime-builder /app/scripts ./scripts
COPY --from=runtime-builder /app/config ./config
COPY --from=runtime-builder /app/packages ./packages
COPY --from=runtime-builder /app/apps ./apps
COPY --from=runtime-builder /app/examples ./examples
COPY --from=runtime-builder /app/fixtures ./fixtures
COPY --from=runtime-builder /app/schemas ./schemas
COPY --from=runtime-builder /app/.env.example ./.env.example
COPY --from=runtime-builder /app/dashboard/out ./dashboard/out
COPY --from=runtime-builder /app/state ./state
COPY --from=runtime-builder /app/task_workspaces ./task_workspaces

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  || true \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/tmp /app/packages/state \
  && chown -R appuser:appgroup /app

USER appuser

EXPOSE 19090 7331

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=6 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD node src/index.mjs & \
    node /app/scripts/start-mcp.mjs --http --host 0.0.0.0 & \
    wait

LABEL org.opencontainers.image.title="AI Team Harness" \
      org.opencontainers.image.description="AI Team Runtime with Agent Orchestration" \
      org.opencontainers.image.source="https://github.com/org/repo"

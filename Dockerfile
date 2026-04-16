FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS base
WORKDIR /app
ENV CI=true \
    NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS dashboard-deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm install -g pnpm && pnpm install

FROM deps AS source
COPY . .

FROM dashboard-deps AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/ ./
ARG DASHBOARD_TOKEN=${DASHBOARD_TOKEN:-}
ARG NEXT_PUBLIC_ENABLE_REALTIME=${NEXT_PUBLIC_ENABLE_REALTIME:-}
ARG NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-}
ENV NEXT_PUBLIC_DASHBOARD_TOKEN=${DASHBOARD_TOKEN:-}
ENV NEXT_PUBLIC_ENABLE_REALTIME=${NEXT_PUBLIC_ENABLE_REALTIME:-}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-}
RUN npm run build

FROM base AS runtime-builder
WORKDIR /app
COPY --from=source /app/package.json ./package.json
COPY --from=source /app/package-lock.json ./package-lock.json
COPY --from=source /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=source /app/src ./src
COPY --from=source /app/scripts ./scripts
COPY --from=source /app/config ./config
COPY --from=source /app/packages ./packages
COPY --from=source /app/apps ./apps
COPY --from=source /app/examples ./examples
COPY --from=source /app/fixtures ./fixtures
COPY --from=source /app/schemas ./schemas
COPY --from=source /app/.env.example ./.env.example
COPY --from=dashboard-builder /app/dashboard/out ./dashboard/out
RUN mkdir -p /app/state /app/task_workspaces /app/config/team \
    && npm install -g pnpm \
    && pnpm install --no-frozen-lockfile

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=19090 \
    MCP_PORT=7331 \
    BIND=0.0.0.0 \
    CI=true

# Create non-root user for security
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
  && rm -rf /var/lib/apt/lists/* \
  && chown -R appuser:appgroup /app

USER appuser

EXPOSE 19090 7331

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=6 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

LABEL org.opencontainers.image.title="AI Team Harness" \
      org.opencontainers.image.description="AI Team Runtime with Agent Orchestration" \
      org.opencontainers.image.source="https://github.com/org/repo"

CMD ["node", "src/index.mjs"]
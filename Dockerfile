# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV CI=true

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS dashboard-deps
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

FROM deps AS source
COPY . .

FROM dashboard-deps AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    MCP_PORT=7331 \
    BIND=0.0.0.0 \
    CI=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=source /app/package.json ./package.json
COPY --from=source /app/package-lock.json ./package-lock.json
COPY --from=source /app/src ./src
COPY --from=source /app/scripts ./scripts
COPY --from=source /app/config ./config
COPY --from=source /app/packages ./packages
COPY --from=source /app/apps ./apps
COPY --from=source /app/examples ./examples
COPY --from=source /app/fixtures ./fixtures
COPY --from=source /app/schemas ./schemas
COPY --from=source /app/services ./services
COPY --from=source /app/shared ./shared
COPY --from=source /app/plugins ./plugins
COPY --from=source /app/.env.example ./.env.example
COPY --from=dashboard-builder /app/dashboard/out ./dashboard/out

RUN mkdir -p /app/state /app/task_workspaces /app/config/team

EXPOSE 3001 7331

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=6 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "src/index.mjs"]

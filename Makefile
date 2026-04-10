COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml
DEV_COMPOSE_FILES = -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: help install check docker-build docker-start docker-stop docker-restart docker-logs docker-ps docker-dev docker-dev-build docker-dev-stop docker-shell

help:
	@echo "AI Team Runtime - Make Commands"
	@echo ""
	@echo "Installation:"
	@echo "  make install          - Install dependencies (requires pnpm 9.x)"
	@echo "  make check           - Check prerequisites"
	@echo ""
	@echo "Docker (Production):"
	@echo "  make docker-start    - Start all services (builds if needed)"
	@echo "  make docker-stop     - Stop all services"
	@echo "  make docker-restart  - Restart all services"
	@echo "  make docker-logs     - View logs (follow mode)"
	@echo "  make docker-ps       - Show running containers"
	@echo "  make docker-shell     - Open shell in app container"
	@echo ""
	@echo "Docker (Development):"
	@echo "  make docker-dev      - Start dev mode with hot reload"
	@echo "  make docker-dev-build - Build and start dev mode"
	@echo "  make docker-dev-stop  - Stop dev mode"
	@echo ""
	@echo "Local Development:"
	@echo "  pnpm run dev         - Start in local mode (no Docker)"
	@echo "  pnpm run start       - Start API server"
	@echo "  pnpm run test        - Run tests"
	@echo ""
	@echo "Dashboard:"
	@echo "  make dashboard-build - Build dashboard UI"
	@echo "  make dashboard-dev   - Start dashboard dev server"
	@echo ""
	@echo "See INSTALL.md for detailed installation instructions."

install:
	@echo "Installing dependencies..."
	@which pnpm > /dev/null || (echo "pnpm not found. Run: corepack enable pnpm" && exit 1)
	@pnpm --version | grep -q "^9" || echo "Warning: pnpm 9.x recommended"
	pnpm install

check:
	@echo "Checking prerequisites..."
	@node --version | grep -q "^v1[89]" && echo "✓ Node.js OK" || echo "✗ Node.js 18+ required"
	@pnpm --version 2>/dev/null | grep -q "^9" && echo "✓ pnpm OK" || echo "✗ pnpm 9.x required"
	@docker --version > /dev/null 2>&1 && echo "✓ Docker OK" || echo "✗ Docker not found"
	@docker compose version > /dev/null 2>&1 && echo "✓ Docker Compose OK" || echo "✗ Docker Compose not found"

docker-build:
	$(COMPOSE) -f $(COMPOSE_FILE) build

docker-start:
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

docker-stop:
	$(COMPOSE) -f $(COMPOSE_FILE) down

docker-restart:
	$(COMPOSE) -f $(COMPOSE_FILE) down
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

docker-logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

docker-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps

docker-dev:
	$(COMPOSE) $(DEV_COMPOSE_FILES) up

docker-dev-build:
	$(COMPOSE) $(DEV_COMPOSE_FILES) up --build

docker-dev-stop:
	$(COMPOSE) $(DEV_COMPOSE_FILES) down

docker-shell:
	$(COMPOSE) -f $(COMPOSE_FILE) exec ai-team sh

dashboard-build:
	cd dashboard && pnpm install && pnpm run build

dashboard-dev:
	cd dashboard && pnpm install && pnpm run dev

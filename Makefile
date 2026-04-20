COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml
DEV_COMPOSE_FILE ?= docker-compose.dev.yml

.PHONY: help install check doctor setup-wizard docker-up docker-down docker-dev docker-dev-down docker-logs docker-ps deploy

help:
	@echo "AI Team Runtime - Make Commands"
	@echo ""
	@echo "Quick Start:"
	@echo "  make install          - Install dependencies"
	@echo "  make setup-wizard     - Run setup wizard"
	@echo ""
	@echo "Docker (Production):"
	@echo "  make docker-up        - Start services (builds if needed)"
	@echo "  make docker-down      - Stop services"
	@echo "  make docker-restart   - Restart services"
	@echo "  make docker-logs      - View logs"
	@echo "  make docker-ps        - Show containers"
	@echo ""
	@echo "Docker (Development):"
	@echo "  make docker-dev       - Start dev mode with hot reload"
	@echo "  make docker-dev-down  - Stop dev mode"
	@echo ""
	@echo "Deploy:"
	@echo "  make deploy           - One-click deploy (production)"
	@echo ""
	@echo "See INSTALL.md for detailed instructions."

install:
	@echo "Installing dependencies..."
	@which pnpm > /dev/null || (echo "pnpm not found. Run: corepack enable pnpm" && exit 1)
	pnpm install

check:
	@echo "Checking prerequisites..."
	@node --version | grep -q "^v1[89]" && echo "✓ Node.js OK" || echo "✗ Node.js 18+ required"
	@pnpm --version 2>/dev/null && echo "✓ pnpm OK" || echo "✗ pnpm required"
	@docker --version > /dev/null 2>&1 && echo "✓ Docker OK" || echo "✗ Docker not found"
	@docker compose version > /dev/null 2>&1 && echo "✓ Docker Compose OK" || echo "✗ Docker Compose not found"

doctor:
	@echo "Running AI Team Health Check..."
	node scripts/setup/doctor.mjs

setup-wizard:
	@echo "Running AI Team Setup Wizard..."
	node scripts/setup/setup-wizard.mjs

docker-up:
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

docker-down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

docker-restart: docker-down docker-up

docker-logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

docker-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps

docker-dev:
	$(COMPOSE) -f $(DEV_COMPOSE_FILE) up --build

docker-dev-down:
	$(COMPOSE) -f $(DEV_COMPOSE_FILE) down

deploy:
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build
	@echo ""
	@echo "Deployment complete!"
	@echo "Access: http://localhost:$${PORT:-19090}"
	@echo "Logs:   make docker-logs"
	@echo "Stop:   make docker-down"

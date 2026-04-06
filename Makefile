COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml
DEV_COMPOSE_FILES = -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: docker-build docker-start docker-stop docker-restart docker-logs docker-ps docker-dev docker-dev-build docker-dev-stop docker-shell

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
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f app

docker-ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps

docker-dev:
	$(COMPOSE) $(DEV_COMPOSE_FILES) up

docker-dev-build:
	$(COMPOSE) $(DEV_COMPOSE_FILES) up --build

docker-dev-stop:
	$(COMPOSE) $(DEV_COMPOSE_FILES) down

docker-shell:
	$(COMPOSE) -f $(COMPOSE_FILE) exec app sh

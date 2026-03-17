.PHONY: install update start stop restart status logs clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## First-time setup — generate secrets and start the stack
	@bash setup.sh

update: ## Pull latest changes, rebuild images, and restart services
	@bash update.sh

start: ## Start all services
	docker compose up -d

stop: ## Stop all services
	docker compose down

restart: ## Restart all services (no rebuild)
	docker compose restart

status: ## Show running containers and health
	docker compose ps

logs: ## Follow logs for all services (Ctrl-C to exit)
	docker compose logs -f

logs-api: ## Follow API logs only
	docker compose logs -f api

logs-worker: ## Follow worker logs only
	docker compose logs -f worker

build: ## Rebuild all images without cache
	docker compose build --no-cache

clean: ## Stop services and remove all volumes (DELETES DATA)
	@echo "WARNING: This will delete all data (database, redis). Press Ctrl-C to cancel."
	@sleep 5
	docker compose down -v

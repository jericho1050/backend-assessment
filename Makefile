# ===============================================
# Makefile
# Convenient commands for Docker operations
# ===============================================

.PHONY: help build up down logs shell test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs
	docker-compose logs -f

shell: ## Open shell in API container
	docker-compose exec api sh

test: ## Run tests
	docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm test

migrate: ## Run database migrations
	docker-compose exec api bun run db:migrate

seed: ## Seed database
	docker-compose exec api bun run db:seed

create-admin: ## Create admin user
	docker-compose exec api bun run create-admin

clean: ## Clean up containers and volumes
	docker-compose down -v

prod-up: ## Start production stack
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-build: ## Build production images
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

tools-up: ## Start with admin tools
	docker-compose --profile tools up -d

postgres-up: ## Start with PostgreSQL
	docker-compose --profile postgres up -d

redis-up: ## Start with Redis
	docker-compose --profile redis up -d

monitoring-up: ## Start monitoring stack
	docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

health: ## Check API health
	curl -f http://localhost:3000/api/health || echo "API is not healthy"

status: ## Show container status
	docker-compose ps

restart: ## Restart API service
	docker-compose restart api

rebuild: ## Rebuild and restart API
	docker-compose up -d --build api

dev: ## Start development environment with hot reload
	docker-compose up -d
	docker-compose logs -f api
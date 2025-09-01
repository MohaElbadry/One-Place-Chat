# One-Place-Chat Docker Management Makefile
# Usage: make <target>

# Default environment
ENVIRONMENT ?= development

# Project variables
PROJECT_NAME := opc
COMPOSE_FILE := devops/docker/docker-compose.yml

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)One-Place-Chat Docker Management$(NC)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Environment:$(NC) $(ENVIRONMENT)"
	@echo "$(YELLOW)Usage:$(NC) make <target> [ENVIRONMENT=production]"

# Environment Setup Commands
.PHONY: setup-env
setup-env: ## Setup environment files from configs
	@echo "$(GREEN)🔧 Setting up environment files...$(NC)"
	@./devops/scripts/setup-env.sh

.PHONY: setup-env-backend
setup-env-backend: ## Setup backend environment files
	@echo "$(GREEN)🔧 Setting up backend environment files...$(NC)"
	@mkdir -p backend
	@cp devops/configs/backend.env.example backend/.env.development
	@cp devops/configs/backend.env.example backend/.env.production
	@echo "$(GREEN)✅ Backend environment files created!$(NC)"
	@echo "$(YELLOW)📝 Edit backend/.env.development and backend/.env.production with your API keys$(NC)"

.PHONY: setup-env-frontend
setup-env-frontend: ## Setup frontend environment files
	@echo "$(GREEN)🔧 Setting up frontend environment files...$(NC)"
	@mkdir -p frontend
	@cp devops/configs/frontend.env.example frontend/.env.development
	@cp devops/configs/frontend.env.example frontend/.env.production
	@echo "$(GREEN)✅ Frontend environment files created!$(NC)"
	@echo "$(YELLOW)📝 Edit frontend/.env.development and frontend/.env.production if needed$(NC)"

.PHONY: setup-env-all
setup-env-all: setup-env-backend setup-env-frontend ## Setup all environment files
	@echo "$(GREEN)✅ All environment files setup complete!$(NC)"

# Development Commands
.PHONY: dev
dev: setup-env-all ## Start development environment
	@echo "$(GREEN)🚀 Starting development environment...$(NC)"
	@ENVIRONMENT=development docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Development environment started!$(NC)"
	@echo "$(BLUE)Frontend:$(NC) http://localhost:3000"
	@echo "$(BLUE)Backend:$(NC)  http://localhost:3001"
	@echo "$(BLUE)ChromaDB:$(NC) http://localhost:8000"

.PHONY: dev-build
dev-build: ## Start development environment with rebuild
	@echo "$(GREEN)🔨 Building and starting development environment...$(NC)"
	@ENVIRONMENT=development docker-compose -f $(COMPOSE_FILE) up -d --build
	@echo "$(GREEN)✅ Development environment built and started!$(NC)"

.PHONY: dev-logs
dev-logs: ## View development logs
	@echo "$(BLUE)📋 Development logs:$(NC)"
	@ENVIRONMENT=development docker-compose -f $(COMPOSE_FILE) logs -f

.PHONY: dev-down
dev-down: ## Stop development environment
	@echo "$(YELLOW)🛑 Stopping development environment...$(NC)"
	@ENVIRONMENT=development docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✅ Development environment stopped!$(NC)"

# Production Commands
.PHONY: prod
prod: ## Start production environment
	@echo "$(GREEN)🚀 Starting production environment...$(NC)"
	@ENVIRONMENT=production docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Production environment started!$(NC)"

.PHONY: prod-build
prod-build: ## Start production environment with rebuild
	@echo "$(GREEN)🔨 Building and starting production environment...$(NC)"
	@ENVIRONMENT=production docker-compose -f $(COMPOSE_FILE) up -d --build
	@echo "$(GREEN)✅ Production environment built and started!$(NC)"

.PHONY: prod-logs
prod-logs: ## View production logs
	@echo "$(BLUE)📋 Production logs:$(NC)"
	@ENVIRONMENT=production docker-compose -f $(COMPOSE_FILE) logs -f

.PHONY: prod-down
prod-down: ## Stop production environment
	@echo "$(YELLOW)🛑 Stopping production environment...$(NC)"
	@ENVIRONMENT=production docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✅ Production environment stopped!$(NC)"

# General Commands
.PHONY: up
up: ## Start current environment
	@echo "$(GREEN)🚀 Starting $(ENVIRONMENT) environment...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ $(ENVIRONMENT) environment started!$(NC)"

.PHONY: build
build: ## Build current environment
	@echo "$(GREEN)🔨 Building $(ENVIRONMENT) environment...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) up -d --build
	@echo "$(GREEN)✅ $(ENVIRONMENT) environment built!$(NC)"

.PHONY: down
down: ## Stop current environment
	@echo "$(YELLOW)🛑 Stopping $(ENVIRONMENT) environment...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✅ $(ENVIRONMENT) environment stopped!$(NC)"

.PHONY: logs
logs: ## View current environment logs
	@echo "$(BLUE)📋 $(ENVIRONMENT) logs:$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) logs -f

.PHONY: status
status: ## Show container status
	@echo "$(BLUE)📊 Container status:$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) ps

.PHONY: restart
restart: ## Restart current environment
	@echo "$(YELLOW)🔄 Restarting $(ENVIRONMENT) environment...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) restart
	@echo "$(GREEN)✅ $(ENVIRONMENT) environment restarted!$(NC)"

# Size Optimization Commands
.PHONY: size-test
size-test: ## Test and compare Docker image sizes
	@echo "$(BLUE)📏 Testing Docker image sizes...$(NC)"
	@./devops/scripts/build-size-test.sh

.PHONY: build-minimal
build-minimal: ## Build ultra-minimal Docker images
	@echo "$(GREEN)🔨 Building ultra-minimal images...$(NC)"
	@docker build -f backend/Dockerfile.ultra-minimal -t opc-backend-minimal backend/
	@docker build -f frontend/Dockerfile.ultra-minimal -t opc-frontend-minimal frontend/
	@echo "$(GREEN)✅ Ultra-minimal images built!$(NC)"
	@echo "$(BLUE)Backend:$(NC) opc-backend-minimal"
	@echo "$(BLUE)Frontend:$(NC) opc-frontend-minimal"

.PHONY: images-size
images-size: ## Show current image sizes
	@echo "$(BLUE)📏 Current Docker image sizes:$(NC)"
	@docker images | grep -E "(opc|one-place-chat|docker_)" | sort -k5 -hr

# Utility Commands
.PHONY: clean
clean: ## Remove all containers, networks, and volumes
	@echo "$(RED)🧹 Cleaning up all containers, networks, and volumes...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans
	@docker system prune -f
	@echo "$(GREEN)✅ Cleanup completed!$(NC)"

.PHONY: clean-volumes
clean-volumes: ## Remove all volumes (⚠️ Data loss)
	@echo "$(RED)⚠️  Removing all volumes (this will delete all data)...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down -v
	@docker volume prune -f
	@echo "$(GREEN)✅ Volumes removed!$(NC)"

.PHONY: logs-backend
logs-backend: ## View backend logs only
	@echo "$(BLUE)📋 Backend logs:$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) logs -f backend

.PHONY: logs-frontend
logs-frontend: ## View frontend logs only
	@echo "$(BLUE)📋 Frontend logs:$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) logs -f frontend

.PHONY: logs-chromadb
logs-chromadb: ## View ChromaDB logs only
	@echo "$(BLUE)📋 ChromaDB logs:$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) logs -f chromadb

.PHONY: shell-backend
shell-backend: ## Open shell in backend container
	@echo "$(BLUE)🐚 Opening shell in backend container...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) exec backend sh

.PHONY: shell-frontend
shell-frontend: ## Open shell in frontend container
	@echo "$(BLUE)🐚 Opening shell in frontend container...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) exec frontend sh

.PHONY: shell-chromadb
shell-chromadb: ## Open shell in ChromaDB container
	@echo "$(BLUE)🐚 Opening shell in ChromaDB container...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) exec chromadb sh

# Health Checks
.PHONY: health
health: ## Check service health
	@echo "$(BLUE)🏥 Checking service health...$(NC)"
	@chmod +x devops/scripts/health-check.sh
	@./devops/scripts/health-check.sh

# Monitoring Commands
.PHONY: monitoring
monitoring: ## Start monitoring stack (Prometheus + Grafana)
	@echo "$(GREEN)📊 Starting monitoring stack...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) -f devops/docker/docker-compose.monitoring.yml up -d
	@echo "$(GREEN)✅ Monitoring stack started!$(NC)"
	@echo "$(BLUE)Prometheus:$(NC) http://localhost:9090"
	@echo "$(BLUE)Grafana:$(NC) http://localhost:3002 (admin/admin123)"
	@echo "$(BLUE)cAdvisor:$(NC) http://localhost:8080"
	@echo "$(BLUE)Node Exporter:$(NC) http://localhost:9100"

.PHONY: monitoring-down
monitoring-down: ## Stop monitoring stack
	@echo "$(YELLOW)🛑 Stopping monitoring stack...$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) -f devops/docker/docker-compose.monitoring.yml down
	@echo "$(GREEN)✅ Monitoring stack stopped!$(NC)"

.PHONY: monitoring-logs
monitoring-logs: ## View monitoring logs
	@echo "$(BLUE)📋 Monitoring logs:$(NC)"
	@ENVIRONMENT=$(ENVIRONMENT) docker-compose -f $(COMPOSE_FILE) -f devops/docker/docker-compose.monitoring.yml logs -f

.PHONY: grafana
grafana: ## Open Grafana in browser
	@echo "$(BLUE)🌐 Opening Grafana...$(NC)"
	@xdg-open http://localhost:3002 2>/dev/null || open http://localhost:3002 2>/dev/null || echo "$(YELLOW)Please open: http://localhost:3002$(NC)"

.PHONY: prometheus
prometheus: ## Open Prometheus in browser
	@echo "$(BLUE)🌐 Opening Prometheus...$(NC)"
	@xdg-open http://localhost:9090 2>/dev/null || open http://localhost:9090 2>/dev/null || echo "$(YELLOW)Please open: http://localhost:9090$(NC)"

.PHONY: health-detailed
health-detailed: ## Detailed health check with resources
	@echo "$(BLUE)🏥 Detailed health check...$(NC)"
	@chmod +x devops/scripts/health-check.sh
	@./devops/scripts/health-check.sh
	@echo ""
	@echo "$(BLUE)📊 Resource Usage:$(NC)"
	@docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

.PHONY: health-chromadb
health-chromadb: ## Check ChromaDB health only
	@echo "$(BLUE)🔍 Checking ChromaDB health...$(NC)"
	@chmod +x devops/scripts/health-check.sh
	@./devops/scripts/health-check.sh chromadb

.PHONY: health-backend
health-backend: ## Check backend health only
	@echo "$(BLUE)🔍 Checking backend health...$(NC)"
	@chmod +x devops/scripts/health-check.sh
	@./devops/scripts/health-check.sh backend

.PHONY: health-frontend
health-frontend: ## Check frontend health only
	@echo "$(BLUE)🔍 Checking frontend health...$(NC)"
	@chmod +x devops/scripts/health-check.sh
	@./devops/scripts/health-check.sh frontend

# Network Commands
.PHONY: network-info
network-info: ## Show network information
	@echo "$(BLUE)🌐 Network information:$(NC)"
	@docker network ls | grep opc || echo "$(YELLOW)No OPC networks found$(NC)"
	@docker network inspect opc_network 2>/dev/null | jq '.[0] | {Name: .Name, Driver: .Driver, Subnet: .IPAM.Config[0].Subnet}' 2>/dev/null || echo "$(YELLOW)Network details not available$(NC)"

# Quick Start Commands
.PHONY: quick-start
quick-start: ## Quick start development environment
	@echo "$(GREEN)🚀 Quick starting development environment...$(NC)"
	@make dev
	@echo "$(YELLOW)⏳ Waiting for services to be ready...$(NC)"
	@sleep 15
	@make health

.PHONY: quick-stop
quick-stop: ## Quick stop all environments
	@echo "$(YELLOW)🛑 Quick stopping all environments...$(NC)"
	@make dev-down
	@make prod-down
	@echo "$(GREEN)✅ All environments stopped!$(NC)"

#!/usr/bin/env bash
# AI Team Runtime - One-Click Deploy Script
# Usage: ./scripts/deploy/deploy.sh [--mode production|development]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

MODE="${1:-production}"
PORT="${PORT:-3001}"
MCP_PORT="${MCP_PORT:-7331}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "=============================================="
echo "  AI Team Runtime - Deploy Script"
echo "=============================================="
echo ""

cd "$PROJECT_ROOT"

check_docker() {
    log_info "Checking Docker..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker first."
        exit 1
    fi
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose not found."
        exit 1
    fi
    log_success "Docker ready"
}

check_env() {
    log_info "Checking environment..."
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_warn ".env file not found"
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            log_info "Creating .env from example..."
            cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
            log_success "Created .env from .env.example"
            log_warn "Please edit .env and add your API keys!"
        fi
    fi
}

pull_image() {
    log_info "Pulling latest image..."
    if docker compose -f "$COMPOSE_FILE" pull 2>/dev/null; then
        log_success "Image pulled"
    else
        log_warn "Could not pull image, using local build"
    fi
}

build_image() {
    log_info "Building Docker image..."
    if docker compose -f "$COMPOSE_FILE" build --no-cache 2>&1; then
        log_success "Image built"
    else
        log_error "Build failed"
        exit 1
    fi
}

start_services() {
    log_info "Starting services (mode: $MODE)..."
    
    export NODE_ENV="$MODE"
    
    if docker compose -f "$COMPOSE_FILE" up -d; then
        log_success "Services started"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

wait_healthy() {
    log_info "Waiting for services to be healthy..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -fsS "http://localhost:$PORT/health" > /dev/null 2>&1; then
            log_success "Service is healthy!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo ""
    log_error "Service did not become healthy in time"
    return 1
}

show_status() {
    echo ""
    echo "=============================================="
    echo "  Deployment Complete!"
    echo "=============================================="
    echo ""
    echo -e "  ${GREEN}Dashboard:${NC}  http://localhost:$PORT"
    echo -e "  ${GREEN}MCP Server:${NC}  http://localhost:$MCP_PORT"
    echo -e "  ${GREEN}Mode:${NC}       $MODE"
    echo ""
    echo "  Useful commands:"
    echo "    docker compose logs -f     # View logs"
    echo "    docker compose down        # Stop services"
    echo "    docker compose restart     # Restart services"
    echo ""
}

main() {
    check_docker
    check_env
    
    case "$MODE" in
        production|dev|development)
            ;;
        *)
            log_error "Invalid mode: $MODE"
            log_info "Usage: $0 [production|development]"
            exit 1
            ;;
    esac
    
    pull_image || build_image
    start_services
    wait_healthy
    show_status
}

main "$@"

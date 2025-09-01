#!/bin/bash

# One-Place-Chat Health Check Script
# Usage: ./health-check.sh [service_name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICES=("chromadb" "backend" "frontend")
CHROMADB_URL="http://localhost:8000"
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    local endpoint=$3
    
    echo -n "🔍 Checking $service... "
    
    if curl -f -s "$url$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
        return 0
    else
        echo -e "${RED}❌ UNHEALTHY${NC}"
        return 1
    fi
}

# Function to check container status
check_container() {
    local service=$1
    
    echo -n "🐳 Checking $service container... "
    
    if docker ps --filter "name=opc-$service" --format "table {{.Status}}" | grep -q "Up"; then
        echo -e "${GREEN}✅ RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ NOT RUNNING${NC}"
        return 1
    fi
}

# Function to check resource usage
check_resources() {
    local service=$1
    
    echo -n "📊 Checking $service resources... "
    
    local container_id=$(docker ps --filter "name=opc-$service" --format "{{.ID}}")
    if [ -n "$container_id" ]; then
        local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" $container_id 2>/dev/null | tail -n 1)
        echo -e "${BLUE}📈 $stats${NC}"
    else
        echo -e "${RED}❌ Container not found${NC}"
    fi
}

# Main health check function
main() {
    echo -e "${BLUE}🏥 One-Place-Chat Health Check${NC}"
    echo "=================================="
    echo ""
    
    local overall_health=0
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running${NC}"
        exit 1
    fi
    
    # Check each service
    for service in "${SERVICES[@]}"; do
        echo -e "${YELLOW}📋 Service: $service${NC}"
        
        # Check container status
        if ! check_container $service; then
            overall_health=1
            continue
        fi
        
        # Check service health based on type
        case $service in
            "chromadb")
                if ! check_service $service $CHROMADB_URL "/api/v2/heartbeat"; then
                    overall_health=1
                fi
                ;;
            "backend")
                if ! check_service $service $BACKEND_URL "/api/health"; then
                    overall_health=1
                fi
                ;;
            "frontend")
                if ! check_service $service $FRONTEND_URL ""; then
                    overall_health=1
                fi
                ;;
        esac
        
        # Check resource usage
        check_resources $service
        echo ""
    done
    
    # Overall status
    echo "=================================="
    if [ $overall_health -eq 0 ]; then
        echo -e "${GREEN}🎉 All services are healthy!${NC}"
    else
        echo -e "${RED}⚠️  Some services are unhealthy${NC}"
    fi
    
    # Additional checks
    echo ""
    echo -e "${BLUE}🔍 Additional Checks:${NC}"
    
    # Check network connectivity
    echo -n "🌐 Network connectivity... "
    if docker network ls | grep -q "opc_network"; then
        echo -e "${GREEN}✅ Network exists${NC}"
    else
        echo -e "${RED}❌ Network missing${NC}"
    fi
    
    # Check volumes
    echo -n "💾 Volumes... "
    if docker volume ls | grep -q "opc_chromadb_data"; then
        echo -e "${GREEN}✅ Volumes exist${NC}"
    else
        echo -e "${RED}❌ Volumes missing${NC}"
    fi
    
    # Check logs for errors
    echo ""
    echo -e "${BLUE}📋 Recent Error Logs:${NC}"
    for service in "${SERVICES[@]}"; do
        echo -e "${YELLOW}$service errors:${NC}"
        docker logs --tail 5 opc-$service 2>&1 | grep -i "error\|exception\|failed" || echo "  No recent errors"
    done
    
    exit $overall_health
}

# Check specific service if provided
if [ $# -eq 1 ]; then
    case $1 in
        "chromadb"|"backend"|"frontend")
            echo -e "${BLUE}🔍 Checking specific service: $1${NC}"
            check_container $1
            case $1 in
                "chromadb")
                    check_service $1 $CHROMADB_URL "/api/v2/heartbeat"
                    ;;
                "backend")
                    check_service $1 $BACKEND_URL "/api/health"
                    ;;
                "frontend")
                    check_service $1 $FRONTEND_URL ""
                    ;;
            esac
            check_resources $1
            ;;
        *)
            echo "Usage: $0 [chromadb|backend|frontend]"
            echo "  No arguments: Check all services"
            echo "  Service name: Check specific service"
            exit 1
            ;;
    esac
else
    main
fi

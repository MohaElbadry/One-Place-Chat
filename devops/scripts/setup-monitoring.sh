#!/bin/bash

echo "📊 Setting up One-Place-Chat Monitoring Stack..."

# Navigate to project root
cd "$(dirname "$0")/../.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Create monitoring directories
echo -e "${BLUE}📁 Creating monitoring directories...${NC}"
mkdir -p devops/monitoring/alertmanager
mkdir -p devops/monitoring/grafana/provisioning/datasources
mkdir -p devops/monitoring/grafana/provisioning/dashboards
mkdir -p devops/monitoring/prometheus

# Set up environment variables
echo -e "${BLUE}🔧 Setting up environment variables...${NC}"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Creating .env file...${NC}"
    cat > .env << EOF
# Monitoring Configuration
ENVIRONMENT=development
GRAFANA_ADMIN_PASSWORD=admin123
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
PAGERDUTY_ROUTING_KEY=your_pagerduty_routing_key_here
EOF
    echo -e "${YELLOW}📝 Please edit .env file with your actual values${NC}"
fi

# Load environment variables
source .env

# Start monitoring stack
echo -e "${BLUE}🚀 Starting monitoring stack...${NC}"

# Start with monitoring
docker-compose -f devops/docker/docker-compose.yml -f devops/docker/docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

services=("prometheus:9090" "grafana:3002" "alertmanager:9093" "cadvisor:8080" "node-exporter:9100")

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    echo -n "Checking $name... "
    if curl -f -s "http://localhost:$port" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ UP${NC}"
    else
        echo -e "${RED}❌ DOWN${NC}"
    fi
done

# Display access information
echo ""
echo -e "${GREEN}🎉 Monitoring stack is ready!${NC}"
echo ""
echo -e "${BLUE}📊 Access URLs:${NC}"
echo -e "  Prometheus:    http://localhost:9090"
echo -e "  Grafana:       http://localhost:3002 (admin/${GRAFANA_ADMIN_PASSWORD:-admin123})"
echo -e "  Alertmanager:  http://localhost:9093"
echo -e "  cAdvisor:      http://localhost:8080"
echo -e "  Node Exporter: http://localhost:9100"
echo ""

# Display useful commands
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo -e "  View logs:     docker-compose -f devops/docker/docker-compose.yml -f devops/docker/docker-compose.monitoring.yml logs -f"
echo -e "  Stop stack:    docker-compose -f devops/docker/docker-compose.yml -f devops/docker/docker-compose.monitoring.yml down"
echo -e "  Restart:       docker-compose -f devops/docker/docker-compose.yml -f devops/docker/docker-compose.monitoring.yml restart"
echo ""

# Check if Grafana is ready and import dashboards
echo -e "${BLUE}📈 Setting up Grafana dashboards...${NC}"
sleep 10

if curl -f -s "http://localhost:3002/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Grafana is ready${NC}"
    echo -e "${YELLOW}📝 Please log in to Grafana and check if dashboards are imported${NC}"
else
    echo -e "${YELLOW}⚠️  Grafana is still starting up, please wait a moment${NC}"
fi

echo ""
echo -e "${GREEN}✅ Monitoring setup completed!${NC}"
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "  1. Configure Slack webhook in Alertmanager"
echo -e "  2. Set up PagerDuty integration (optional)"
echo -e "  3. Customize alert rules in prometheus/alerts.yml"
echo -e "  4. Import additional Grafana dashboards if needed"
echo ""
echo -e "${BLUE}🔗 Documentation:${NC}"
echo -e "  Prometheus: https://prometheus.io/docs/"
echo -e "  Grafana:    https://grafana.com/docs/"
echo -e "  Alertmanager: https://prometheus.io/docs/alerting/latest/alertmanager/"

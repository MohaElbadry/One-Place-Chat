#!/bin/bash

echo "🛑 Stopping One-Place-Chat DevOps Services..."

# Navigate to docker directory
cd "$(dirname "$0")/../docker"

# Stop all services
echo "📦 Stopping Docker services..."
docker-compose down

echo "✅ All services stopped successfully!"
echo ""
echo "💾 Data volumes are preserved"
echo "🗑️  To remove volumes: docker-compose down -v"

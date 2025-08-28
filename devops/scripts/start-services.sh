#!/bin/bash

echo "🚀 Starting One-Place-Chat DevOps Services..."

# Navigate to docker directory
cd "$(dirname "$0")/../docker"

# Start all services
echo "📦 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "🔍 Checking service status..."
docker-compose ps

echo "✅ All services started successfully!"
echo ""
echo "🌐 Service URLs:"
echo "   ChromaDB: http://localhost:8000"
echo "   Redis: localhost:6379"
echo "   PostgreSQL: localhost:5432"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"

#!/bin/bash

echo "🚀 Setting up One-Place-Chat Backend API Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Check if ChromaDB is running
echo "🔍 Checking ChromaDB status..."
if ! curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
    echo "⚠️  ChromaDB is not running. Starting ChromaDB..."
    docker-compose -f docker-compose.chromadb.yml up -d
    
    # Wait for ChromaDB to start
    echo "⏳ Waiting for ChromaDB to start..."
    sleep 10
    
    if ! curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
        echo "❌ Failed to start ChromaDB. Please check Docker and try again."
        exit 1
    fi
fi

echo "✅ ChromaDB is running"

# Start the API server
echo "🌐 Starting API server..."
echo "📚 API will be available at: http://localhost:3001"
echo "🔧 Tools endpoint: http://localhost:3001/api/tools"
echo "💬 Conversations endpoint: http://localhost:3001/api/conversations"
echo "❤️  Health check: http://localhost:3001/api/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run api:dev

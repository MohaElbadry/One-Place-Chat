#!/bin/bash

echo "🧹 Cleaning up One-Place-Chat project..."

# Navigate to project root
cd "$(dirname "$0")/../.."

# Remove unnecessary files
echo "🗑️  Removing unnecessary files..."

# Remove old docker files
rm -f backend/docker-compose.chromadb.yml

# Remove empty directories
find . -type d -empty -delete

# Remove temporary files
find . -name "*.tmp" -delete
find . -name "*.log" -delete
find . -name ".DS_Store" -delete

# Remove node_modules from root if exists
if [ -d "node_modules" ]; then
    echo "📦 Removing root node_modules..."
    rm -rf node_modules
fi

# Clean build artifacts
echo "🔨 Cleaning build artifacts..."
cd backend
npm run clean
cd ..

cd frontend
npm run build --silent
cd ..

echo "✅ Cleanup completed!"
echo ""
echo "📊 Project size after cleanup:"
du -sh . --exclude=node_modules --exclude=.git

echo ""
echo "🚀 Ready for optimization!"

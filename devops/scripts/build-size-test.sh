#!/bin/bash

echo "🐳 Docker Image Size Optimization Test"
echo "====================================="

# Navigate to project root
cd "$(dirname "$0")/../.."

# Function to build and measure image size
build_and_measure() {
    local dockerfile=$1
    local tag=$2
    local description=$3
    
    echo ""
    echo "🔨 Building $description..."
    echo "Dockerfile: $dockerfile"
    
    # Build the image
    if docker build -f "$dockerfile" -t "$tag" .; then
        # Get image size
        local size=$(docker images "$tag" --format "table {{.Size}}" | tail -n 1)
        echo "✅ Build successful!"
        echo "📏 Image size: $size"
        echo "🏷️  Tag: $tag"
    else
        echo "❌ Build failed!"
        return 1
    fi
}

# Function to clean up images
cleanup() {
    echo ""
    echo "🧹 Cleaning up test images..."
    docker rmi opc-backend-test opc-frontend-test 2>/dev/null || true
    docker rmi opc-backend-ultra opc-frontend-ultra 2>/dev/null || true
}

# Clean up any existing test images
cleanup

echo ""
echo "🚀 Starting size comparison test..."

# Test 1: Standard optimized builds
echo ""
echo "📊 Test 1: Standard Optimized Builds"
echo "------------------------------------"

build_and_measure "backend/Dockerfile" "opc-backend-test" "Backend (Alpine optimized)"
build_and_measure "frontend/Dockerfile" "opc-frontend-test" "Frontend (Alpine optimized)"

# Test 2: Ultra-minimal builds (if available)
echo ""
echo "📊 Test 2: Ultra-Minimal Builds"
echo "--------------------------------"

if [ -f "backend/Dockerfile.ultra-minimal" ]; then
    build_and_measure "backend/Dockerfile.ultra-minimal" "opc-backend-ultra" "Backend (Ultra-minimal)"
else
    echo "⚠️  Backend ultra-minimal Dockerfile not found"
fi

if [ -f "frontend/Dockerfile.ultra-minimal" ]; then
    build_and_measure "frontend/Dockerfile.ultra-minimal" "opc-frontend-ultra" "Frontend (Ultra-minimal)"
else
    echo "⚠️  Frontend ultra-minimal Dockerfile not found"
fi

# Show final comparison
echo ""
echo "📊 Final Size Comparison"
echo "========================"

echo ""
echo "Standard Optimized:"
docker images "opc-backend-test" --format "  Backend:  {{.Size}}" 2>/dev/null || echo "  Backend:  N/A"
docker images "opc-frontend-test" --format "  Frontend: {{.Size}}" 2>/dev/null || echo "  Frontend: N/A"

echo ""
echo "Ultra-Minimal:"
docker images "opc-backend-ultra" --format "  Backend:  {{.Size}}" 2>/dev/null || echo "  Backend:  N/A"
docker images "opc-frontend-ultra" --format "  Frontend: {{.Size}}" 2>/dev/null || echo "  Frontend: N/A"

echo ""
echo "🎯 Size Optimization Tips:"
echo "  • Alpine Linux: ~5-10x smaller than Debian/Ubuntu"
echo "  • Multi-stage builds: Remove build dependencies"
echo "  • Distroless images: Minimal runtime, no package manager"
echo "  • Aggressive .dockerignore: Exclude unnecessary files"
echo "  • Production-only dependencies: Skip dev dependencies"

echo ""
echo "✅ Size test completed!"
echo ""
echo "💡 To use the smallest images:"
echo "  • Standard: Use the main Dockerfiles"
echo "  • Ultra-minimal: Use Dockerfile.ultra-minimal files"
echo ""
echo "🔧 To clean up test images:"
echo "  docker rmi opc-backend-test opc-frontend-test"
echo "  docker rmi opc-backend-ultra opc-frontend-ultra"

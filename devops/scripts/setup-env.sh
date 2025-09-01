#!/bin/bash

echo "🔧 Setting up One-Place-Chat environment files..."

# Navigate to project root
cd "$(dirname "$0")/../.."

# Create environment files in backend
echo "📁 Setting up backend environment files..."
if [ ! -f "backend/.env.development" ]; then
    cp "devops/configs/backend.env.development" "backend/.env.development"
    echo "✅ Created backend/.env.development"
else
    echo "⚠️  backend/.env.development already exists"
fi

if [ ! -f "backend/.env.production" ]; then
    cp "devops/configs/backend.env.production" "backend/.env.production"
    echo "✅ Created backend/.env.production"
else
    echo "⚠️  backend/.env.production already exists"
fi

# Create environment files in frontend
echo "📁 Setting up frontend environment files..."
if [ ! -f "frontend/.env.development" ]; then
    cp "devops/configs/frontend.env.development" "frontend/.env.development"
    echo "✅ Created frontend/.env.development"
else
    echo "⚠️  frontend/.env.development already exists"
fi

if [ ! -f "frontend/.env.production" ]; then
    cp "devops/configs/frontend.env.production" "frontend/.env.production"
    echo "✅ Created frontend/.env.production"
else
    echo "⚠️  frontend/.env.production already exists"
fi

# Create .env.local files (git-ignored)
echo "📝 Creating .env.local files for local overrides..."
touch "backend/.env.local"
touch "frontend/.env.local"
echo "✅ Created .env.local files (git-ignored)"

echo ""
echo "🎉 Environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit backend/.env.development and add your API keys"
echo "2. Edit frontend/.env.development if needed"
echo "3. Run 'make dev' to start development environment"
echo ""
echo "🔒 Remember: .env.local files are git-ignored for personal overrides"

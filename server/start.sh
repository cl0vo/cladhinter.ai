#!/bin/bash

echo "🚀 Starting Cladhunter API Server..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚙️  Please edit server/.env and add your DATABASE_URL from Neon"
    echo "   Get it from: https://console.neon.tech"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL=postgresql://" .env; then
    echo "❌ DATABASE_URL not configured in .env"
    echo "   Please add your Neon connection string"
    echo ""
    exit 1
fi

echo "✅ Configuration looks good!"
echo ""
echo "🔄 Running migrations..."
npm run migrate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migrations completed!"
    echo ""
    echo "🚀 Starting server on port ${PORT:-3001}..."
    npm run dev
else
    echo ""
    echo "❌ Migration failed. Please check your DATABASE_URL"
    exit 1
fi

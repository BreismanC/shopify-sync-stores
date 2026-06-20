#!/bin/bash

set -e

echo "=== Shopify Sync - SAM Local Setup ==="

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI is not installed."
    echo "   Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "✅ SAM CLI installed: $(sam --version)"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "   Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker installed: $(docker --version)"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi

echo "✅ Docker is running"

# Check if PostgreSQL container is running
if docker ps --format '{{.Names}}' | grep -q "shopify-sync-db"; then
    echo "✅ PostgreSQL container 'shopify-sync-db' is running"
else
    echo "⚠️  PostgreSQL container not found."
    echo "   If using docker-compose, run: docker compose up -d db"
    echo "   Or start a PostgreSQL container manually."
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cat > .env << 'EOF'
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=shopify_sync
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# AWS
AWS_REGION=us-east-1
AWS_SAM_LOCAL=true

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_SANDBOX=true
MERCADOPAGO_WEBHOOK_SECRET=

# App
NODE_ENV=development
PORT=3001
SITE_URL=http://localhost:3000
EOF
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To build and run locally:"
echo "  1. Build the functions: pnpm run build --filter=@shopify-sync/functions"
echo "  2. Run with SAM local: sam local invoke CheckSubscriptionExpirations --event infra/sam/events/check-expirations.json --env-vars infra/sam/env.json"
echo ""
echo "To deploy to AWS:"
echo "  sam deploy --guided"
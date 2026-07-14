#!/bin/bash

# Metapharsic ERP - VPS Deployment Script
# Usage: chmod +x deploy.sh && ./deploy.sh

echo "🚀 Starting Deployment of Metapharsic ERP..."

# 1. Install Dependencies
echo "📦 Installing root dependencies..."
npm install --production=false

echo "📦 Installing server dependencies..."
cd server && npm install && cd ..

# 2. Build Frontend
echo "🏗️ Building frontend..."
chmod +x node_modules/.bin/vite
npm run build

# 3. Environment Check
if [ ! -f server/.env ]; then
    echo "⚠️  server/.env not found! Please create it before proceeding."
    exit 1
fi

# 4. Database Setup
echo "🗄️ Initializing production database..."
node server/scripts/setup-vps-db.js

# 5. Process Management
if command -v pm2 &> /dev/null
then
    echo "🔄 Restarting application with PM2..."
    pm2 delete metapharsic-erp 2>/dev/null || true
    pm2 start pm2.config.cjs
    pm2 save
else
    echo "⚠️  PM2 not found. Starting server with Node..."
    echo "💡 Recommendation: Install PM2 (npm install -g pm2) for better process management."
    NODE_ENV=production node server/index.js
fi

echo "✅ Deployment Complete!"

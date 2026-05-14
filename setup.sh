#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Dubyx Platform Setup             ║"
echo "║     B2B Retail Sales — Qatar         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Backend Setup
echo "📦 Setting up Backend..."
cd backend
npm install
echo "✅ Backend dependencies installed"

echo ""
echo "⚙️  Database Setup"
echo "  Make sure PostgreSQL is running and update .env with your DATABASE_URL"
echo "  Then run: npm run db:push && npm run db:seed"
echo ""

# Admin Portal Setup
echo "📦 Setting up Admin Portal..."
cd ../admin-portal
npm install
echo "✅ Admin Portal dependencies installed"

echo ""
echo "📱 Mobile App Setup"
echo "  cd mobile-app && flutter pub get"
echo ""

echo "══════════════════════════════════════════════════════"
echo "🔐 SUPER ADMIN CREDENTIALS"
echo "  Email:    superadmin@dubyx.qa"
echo "  Password: DubYx@2024!"
echo ""
echo "📧 ADMIN CREDENTIALS"
echo "  Email:    admin@dubyx.qa"
echo "  Password: DubYx@2024!"
echo ""
echo "👤 SAMPLE SALESMAN"
echo "  Email:    sales1@dubyx.qa"
echo "  Password: DubYx@2024!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "🚀 Start Commands:"
echo "  Backend:      cd backend && npm run dev"
echo "  Admin Portal: cd admin-portal && npm run dev"
echo "  Flutter App:  cd mobile-app && flutter run"
echo ""

#!/bin/bash

# ============================================================================
# APPLY VIEWER ROLE RESTRICTIONS - FIXED VERSION
# ============================================================================
# This script applies the fixed version of viewer role restrictions
# that addresses security warnings and ensures restrictions work correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step "🔧 Applying Viewer Role Restrictions - Fixed Version"
echo

# Check if we're in the correct directory
if [ ! -f "migrations/implement_viewer_role_restrictions_FIXED.sql" ]; then
    print_error "Migration file not found. Please run from project root."
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable not set."
    exit 1
fi

# Apply the migration
print_step "Applying migration..."
if psql "$DATABASE_URL" -f "migrations/implement_viewer_role_restrictions_FIXED.sql"; then
    print_step "✅ Migration applied successfully!"
else
    print_error "❌ Migration failed!"
    exit 1
fi

echo
print_step "🎯 ROLE RESTRICTIONS APPLIED:"
echo "✅ owners: Full access (SELECT, INSERT, UPDATE, DELETE)"
echo "✅ admin: Full access except DELETE (SELECT, INSERT, UPDATE)"
echo "✅ collaborator: Editor access (SELECT, INSERT, UPDATE)"
echo "❌ marketing: Viewer access only (SELECT only)"
echo

print_step "📋 To verify the status, run:"
echo "psql \"\$DATABASE_URL\" -c \"SELECT * FROM check_role_restrictions_status();\""
echo

print_step "🚀 Viewer role restrictions are now active!"
print_warning "Please test the restrictions in your development environment" 
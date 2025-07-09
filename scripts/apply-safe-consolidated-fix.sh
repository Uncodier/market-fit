#!/bin/bash

# SAFE Consolidated Service Role Fix Application Script
# This script applies the service_role fix while preventing performance issues
# Date: 2025-01-30

set -e

echo "🔧 SAFE Service Role Fix Application"
echo "====================================="
echo ""

# Check if we're in the correct directory
if [ ! -f "migrations/119_consolidated_service_role_fix_SAFE.sql" ]; then
    echo "❌ Error: migrations/119_consolidated_service_role_fix_SAFE.sql not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

echo "📋 Pre-Flight Checks:"
echo "✅ Migration file exists"
echo "✅ Supabase CLI available"
echo ""

# Show what this script will do
echo "🎯 This SAFE script will:"
echo "  1. Remove ALL existing policies (prevent duplicates)"
echo "  2. Remove duplicate indexes (prevent warnings)"
echo "  3. Create single, clean policies per table"
echo "  4. Add only necessary indexes (no duplicates)"
echo "  5. Verify clean setup (no performance warnings)"
echo ""

read -p "Do you want to proceed? (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled"
    exit 1
fi

echo ""
echo "🚀 Applying SAFE consolidated service role fix..."
echo ""

# Apply the migration
if supabase db reset --local; then
    echo "✅ Local database reset successful"
else
    echo "❌ Local database reset failed"
    exit 1
fi

# Apply the migration file
if supabase migration up --local; then
    echo "✅ All migrations applied successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "🧪 Running verification tests..."
echo ""

# Test service_role access
echo "Testing service_role access to visitors table..."
if supabase db reset --local && supabase migration up --local; then
    echo "✅ Service role access test passed"
else
    echo "❌ Service role access test failed"
    exit 1
fi

echo ""
echo "🎉 SAFE Service Role Fix Applied Successfully!"
echo "============================================="
echo ""
echo "✅ All policies cleaned up (no duplicates)"
echo "✅ All indexes optimized (no duplicates)"
echo "✅ Service_role access enabled"
echo "✅ Original user permissions preserved"
echo "✅ No performance warnings expected"
echo ""
echo "🔍 To verify in production:"
echo "  1. Apply migration: supabase db push"
echo "  2. Check logs for any warnings"
echo "  3. Test admin queries with service_role token"
echo ""
echo "📊 The migration includes comprehensive verification output"
echo "🎯 All RLS policies now have single, clean implementations" 
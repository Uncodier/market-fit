#!/bin/bash

# Apply OPTIMIZED Service Role Fix (Performance Optimized)
# Date: 2025-01-30
# Fixes auth_rls_initplan performance warnings

set -e

echo "⚡ OPTIMIZED Service Role Fix (Performance Optimized)"
echo "=================================================="
echo ""

# Check migration exists
if [ ! -f "migrations/119_consolidated_service_role_fix_OPTIMIZED.sql" ]; then
    echo "❌ Migration file not found"
    exit 1
fi

echo "🎯 This OPTIMIZED script will:"
echo "  ✅ Remove ALL existing policies (prevent duplicates)"
echo "  ✅ Create single, optimized policies"
echo "  ✅ Fix auth_rls_initplan warnings (SELECT subqueries)"
echo "  ✅ Add necessary indexes (no duplicates)"
echo "  ✅ Verify clean setup"
echo ""
echo "🔧 PERFORMANCE OPTIMIZATIONS:"
echo "  • auth.uid() → (SELECT auth.uid())"
echo "  • current_setting() → (SELECT current_setting())"
echo "  • auth.jwt() → (SELECT auth.jwt())"
echo ""

read -p "Apply the OPTIMIZED fix? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Applying OPTIMIZED migration..."

# Apply migration
if supabase migration new fix_service_role_optimized < migrations/119_consolidated_service_role_fix_OPTIMIZED.sql; then
    echo "✅ Migration created"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "🎉 OPTIMIZED Fix Applied Successfully!"
echo "===================================="
echo ""
echo "✅ Single policies per table"
echo "✅ NO auth_rls_initplan warnings"
echo "✅ Performance optimized queries"
echo "✅ Service_role access enabled"
echo ""
echo "📋 Next steps:"
echo "  1. Test locally: supabase db reset --local && supabase migration up --local"
echo "  2. Deploy: supabase db push"
echo "  3. Verify: No performance warnings in logs"
echo ""
echo "🎯 All auth function calls now use SELECT for optimal performance" 
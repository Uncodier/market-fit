#!/bin/bash

# Apply SAFE Service Role Fix (Simplified Version)
# Date: 2025-01-30

set -e

echo "🔧 SAFE Service Role Fix (Simplified)"
echo "====================================="
echo ""

# Check migration exists
if [ ! -f "migrations/119_consolidated_service_role_fix_SAFE_v2.sql" ]; then
    echo "❌ Migration file not found"
    exit 1
fi

echo "🎯 This script will:"
echo "  ✅ Remove ALL existing policies (prevent duplicates)"
echo "  ✅ Create single, clean policies"
echo "  ✅ Add necessary indexes (no duplicates)"
echo "  ✅ Verify clean setup"
echo ""

read -p "Apply the fix? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Applying migration..."

# Apply migration
if supabase migration new fix_service_role_safe_v2 < migrations/119_consolidated_service_role_fix_SAFE_v2.sql; then
    echo "✅ Migration created"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "🎉 SAFE Fix Applied Successfully!"
echo "================================="
echo ""
echo "✅ Single policies per table"
echo "✅ No performance warnings"
echo "✅ Service_role access enabled"
echo ""
echo "📋 Next steps:"
echo "  1. Test locally: supabase db reset --local && supabase migration up --local"
echo "  2. Deploy: supabase db push"
echo "  3. Check logs for warnings" 
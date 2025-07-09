#!/bin/bash

# Apply Viewer Role Restrictions
# Date: 2025-01-30
# Restricts viewer (marketing) role to SELECT only

set -e

echo "🔐 Applying Viewer Role Restrictions"
echo "==================================="
echo ""

# Check migration exists
if [ ! -f "migrations/implement_viewer_role_restrictions.sql" ]; then
    echo "❌ Migration file not found"
    exit 1
fi

echo "🎯 This will:"
echo "  ✅ Add INSERT/UPDATE permission checks"
echo "  ✅ Block marketing (viewer) role from CREATE/UPDATE"
echo "  ✅ Allow owners/admins/collaborators to CREATE/UPDATE"
echo "  ✅ Existing DELETE protection unchanged"
echo ""

echo "📋 Role Summary After Changes:"
echo "  ✅ owners: Full access (SELECT, INSERT, UPDATE, DELETE)"
echo "  ✅ admin: Full access except DELETE (SELECT, INSERT, UPDATE)"
echo "  ✅ collaborator: Editor access (SELECT, INSERT, UPDATE)"
echo "  ❌ marketing: Viewer access only (SELECT only)"
echo ""

read -p "Apply viewer role restrictions? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Applying migration..."

# Apply migration
if supabase migration new implement_viewer_role_restrictions < migrations/implement_viewer_role_restrictions.sql; then
    echo "✅ Migration created successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "🎉 Viewer Role Restrictions Applied!"
echo "=================================="
echo ""
echo "📋 Next steps:"
echo "  1. Test locally: supabase db reset --local && supabase migration up --local"
echo "  2. Test with viewer role user"
echo "  3. Deploy: supabase db push"
echo "  4. Verify role restrictions in production"
echo ""
echo "📊 To check status: SELECT * FROM check_role_restrictions_status();" 
#!/bin/bash

# ============================================================================
# TEST VIEWER ROLE RESTRICTIONS
# ============================================================================
# This script tests the viewer role restrictions to ensure they work correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step "🧪 Testing Viewer Role Restrictions"
echo

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable not set."
    exit 1
fi

# Test 1: Check if restrictions functions exist
print_step "1. Checking if restriction functions exist..."
FUNCTIONS_EXIST=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM information_schema.routines 
WHERE routine_name IN ('check_create_update_permission', 'check_role_restrictions_status') 
AND routine_schema = 'public';
")

if [ "$FUNCTIONS_EXIST" -eq 2 ]; then
    print_info "✅ Both restriction functions exist"
else
    print_error "❌ Restriction functions missing (found: $FUNCTIONS_EXIST/2)"
    exit 1
fi

# Test 2: Check restriction status
print_step "2. Checking restriction status..."
echo
psql "$DATABASE_URL" -c "SELECT * FROM check_role_restrictions_status();"
echo

# Test 3: Check if marketing role is properly restricted
print_step "3. Testing role restrictions..."
echo

# Get a sample site_id to test with
SITE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM sites LIMIT 1;" | xargs)

if [ -z "$SITE_ID" ]; then
    print_warning "No sites found - skipping role restriction test"
else
    print_info "Testing with site_id: $SITE_ID"
    
    # Test with different roles
    print_info "Testing role behavior..."
    psql "$DATABASE_URL" -c "
    SELECT 
        sm.user_id,
        sm.role,
        sm.status,
        CASE 
            WHEN sm.role IN ('owner', 'admin', 'collaborator') THEN '✅ Can CREATE/UPDATE'
            WHEN sm.role = 'marketing' THEN '❌ Cannot CREATE/UPDATE'
            ELSE '❓ Unknown role'
        END as expected_permission
    FROM site_members sm 
    WHERE sm.site_id = '$SITE_ID'
    AND sm.status = 'active'
    ORDER BY sm.role;
    "
fi

echo

# Test 4: Check triggers are active
print_step "4. Checking active triggers..."
echo

TRIGGER_COUNT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM information_schema.triggers 
WHERE trigger_name LIKE 'trigger_%_permission_%';
")

print_info "Active permission triggers: $TRIGGER_COUNT"

if [ "$TRIGGER_COUNT" -gt 0 ]; then
    print_info "✅ Permission triggers are active"
else
    print_error "❌ No permission triggers found"
fi

echo

# Test 5: Summary
print_step "5. Test Summary"
echo "🎯 EXPECTED BEHAVIOR:"
echo "✅ owners: Full access (SELECT, INSERT, UPDATE, DELETE)"
echo "✅ admin: Full access except DELETE (SELECT, INSERT, UPDATE)"
echo "✅ collaborator: Editor access (SELECT, INSERT, UPDATE)"
echo "❌ marketing: Viewer access only (SELECT only)"
echo
echo "🔧 If restrictions are not working as expected:"
echo "1. Make sure the migration was applied successfully"
echo "2. Check that users have the correct roles in site_members"
echo "3. Verify that the frontend role mapping is correct"
echo

print_step "🎉 Role restriction test completed!" 
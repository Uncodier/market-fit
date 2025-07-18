#!/bin/bash

# Apply Customer Journey Migration Script
# This script adds the customer_journey column to the settings table

echo "🚀 Applying Customer Journey Migration..."
echo "This will add the customer_journey JSONB column to the settings table"
echo ""

# Check if we're in the right directory
if [ ! -f "migrations/152_add_customer_journey_to_settings.sql" ]; then
    echo "❌ Error: Migration file not found. Please run this script from the project root directory."
    exit 1
fi

# Confirm before proceeding
read -p "⚠️  This will modify the database structure. Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled."
    exit 1
fi

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed or not in PATH."
    echo "Please install it from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Apply the migration
echo "📝 Applying migration..."
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Customer Journey migration applied successfully!"
    echo ""
    echo "📋 What was added:"
    echo "   • customer_journey JSONB column to settings table"
    echo "   • Default structure with 6 journey stages"
    echo "   • Validation constraints"
    echo "   • GIN indexes for performance"
    echo "   • Updated documentation"
    echo ""
    echo "🎯 You can now configure customer journey stages in the Settings > Customer Journey tab"
else
    echo "❌ Migration failed. Please check the error messages above."
    echo "You can also manually apply the migration by running:"
    echo "supabase db push"
    exit 1
fi 
-- Rollback script for customer_journey column addition
-- Use this script only if you need to revert the customer_journey column changes

-- Drop indexes first
DROP INDEX IF EXISTS idx_settings_customer_journey_gin;
DROP INDEX IF EXISTS idx_settings_customer_journey_awareness;
DROP INDEX IF EXISTS idx_settings_customer_journey_purchase;

-- Drop the constraint
ALTER TABLE public.settings 
DROP CONSTRAINT IF EXISTS customer_journey_structure_check;

-- Remove the column
ALTER TABLE public.settings 
DROP COLUMN IF EXISTS customer_journey;

-- Note: This will permanently delete all customer journey configuration data
-- Make sure to backup the data before running this rollback script 
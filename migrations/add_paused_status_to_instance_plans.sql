-- Migration: Add 'paused' status to instance_plans status constraint
-- Date: 2025-01-06
-- Description: Adds 'paused' as a valid status value for instance_plans table

BEGIN;

-- Drop the existing constraint
ALTER TABLE public.instance_plans 
DROP CONSTRAINT IF EXISTS instance_plans_status_check;

-- Add the new constraint with 'paused' included
ALTER TABLE public.instance_plans 
ADD CONSTRAINT instance_plans_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'in_progress'::text, 
  'paused'::text,
  'completed'::text, 
  'failed'::text, 
  'cancelled'::text, 
  'blocked'::text
]));

-- Add comment to document the change
COMMENT ON CONSTRAINT instance_plans_status_check ON public.instance_plans IS 
'Valid status values: pending, in_progress, paused, completed, failed, cancelled, blocked';

COMMIT;

-- Verification query (uncomment to run manually)
/*
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'instance_plans_status_check';
*/

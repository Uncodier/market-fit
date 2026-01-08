-- Migration script to add 'cold' and 'not_qualified' statuses to leads table
-- This updates the CHECK constraint to allow the new status values

-- Drop the existing constraint
ALTER TABLE public.leads 
DROP CONSTRAINT IF EXISTS leads_status_check;

-- Add the new constraint with all statuses including 'cold' and 'not_qualified'
ALTER TABLE public.leads
ADD CONSTRAINT leads_status_check 
CHECK (status = ANY (ARRAY[
  'new'::text, 
  'contacted'::text, 
  'qualified'::text, 
  'cold'::text,
  'converted'::text, 
  'lost'::text,
  'not_qualified'::text
]));

-- Add comment to document the status values
COMMENT ON COLUMN public.leads.status IS 'Lead status: new, contacted, qualified, cold, converted, lost, not_qualified';



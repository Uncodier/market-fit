-- Fix task status constraint to match TypeScript types
-- The main issue: database constraint doesn't include 'canceled' status

-- Update the CHECK constraint to include 'canceled' status
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'canceled'));

-- Update any existing 'cancelled' records to 'canceled' (if any)
UPDATE public.tasks 
SET status = 'canceled' 
WHERE status = 'cancelled';

COMMENT ON CONSTRAINT tasks_status_check ON public.tasks IS 'Updated to include canceled status to match TypeScript types';

-- Update the requirements table status constraint to include all needed statuses
ALTER TABLE public.requirements 
  DROP CONSTRAINT IF EXISTS requirements_status_check;

ALTER TABLE public.requirements
  ADD CONSTRAINT requirements_status_check 
  CHECK (status IN ('validated', 'in-progress', 'on-review', 'done', 'backlog', 'canceled'));

-- Update the requirements schema to reflect current usage
COMMENT ON TABLE public.requirements IS 'Stores product requirements with various statuses and priorities'; 
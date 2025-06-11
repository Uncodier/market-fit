-- Migration to add type field to requirements table
-- Add type column to requirements table
ALTER TABLE public.requirements
ADD COLUMN type TEXT CHECK (type IN ('content', 'design', 'research', 'follow_up', 'task', 'develop', 'analytics', 'testing', 'approval', 'coordination', 'strategy', 'optimization', 'automation', 'integration', 'planning', 'payment'));

-- Set default value for existing records
UPDATE public.requirements 
SET type = 'task' 
WHERE type IS NULL;

-- Make type NOT NULL after setting default values
ALTER TABLE public.requirements
ALTER COLUMN type SET NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_requirements_type ON public.requirements(type); 
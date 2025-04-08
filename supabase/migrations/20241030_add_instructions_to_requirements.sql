-- Add instructions column to requirements table
ALTER TABLE public.requirements ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Comment on the column
COMMENT ON COLUMN public.requirements.instructions IS 'Markdown formatted instructions for the requirement'; 
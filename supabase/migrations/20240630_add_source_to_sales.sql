-- Add source field to sales table
ALTER TABLE IF EXISTS public.sales
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'online' CHECK (source IN ('retail', 'online'));

-- Update existing sales to have a source value based on their channel
-- If there's already a channel field, we'll convert it to source
UPDATE public.sales
SET source = channel
WHERE channel IS NOT NULL AND source IS NULL;

-- Set default source for records that don't have one
UPDATE public.sales
SET source = 'online'
WHERE source IS NULL; 
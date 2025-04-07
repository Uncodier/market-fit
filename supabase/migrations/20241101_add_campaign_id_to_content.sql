-- Add campaign_id column to content table
ALTER TABLE IF EXISTS public.content 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_content_campaign_id ON public.content(campaign_id);

-- Update RLS policies if they exist
-- (RLS policies don't need to be updated for this column, as existing content 
-- policies already handle access control at the table level) 
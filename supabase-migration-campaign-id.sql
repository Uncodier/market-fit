-- Migration script to add campaign_id to content table

-- First, check if the column exists and add it if it doesn't
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content' 
    AND column_name = 'campaign_id'
  ) THEN
    -- Add campaign_id column with foreign key reference
    ALTER TABLE public.content 
    ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
    
    -- Create an index for better query performance
    CREATE INDEX IF NOT EXISTS idx_content_campaign_id ON public.content(campaign_id);
    
    -- Log the change
    RAISE NOTICE 'Added campaign_id column to content table';
  ELSE
    RAISE NOTICE 'campaign_id column already exists in content table';
  END IF;
END $$;

-- Update the Content Type definition if needed
-- This isn't strictly necessary but helps with documentation
COMMENT ON TABLE public.content IS 'Content items such as blog posts, videos, podcasts, etc. associated with campaigns and segments';
COMMENT ON COLUMN public.content.campaign_id IS 'Foreign key to campaigns table, associating content with marketing campaigns';

-- Let users know how to use this script
SELECT 'Migration completed. The content table now has a campaign_id column referencing campaigns.' as result; 
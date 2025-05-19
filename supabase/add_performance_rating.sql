-- Add performance_rating field to content table
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS performance_rating SMALLINT;

-- Add constraint to ensure the rating is between 1 and 5
ALTER TABLE public.content ADD CONSTRAINT performance_rating_range CHECK (performance_rating IS NULL OR (performance_rating >= 1 AND performance_rating <= 5));

-- Comment on the field
COMMENT ON COLUMN public.content.performance_rating IS 'Content performance rating on a scale of 1-5 stars'; 
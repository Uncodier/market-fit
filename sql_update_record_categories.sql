ALTER TABLE public.record_categories 
ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.record_categories(id) ON DELETE SET NULL;
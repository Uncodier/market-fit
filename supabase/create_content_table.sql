CREATE TABLE IF NOT EXISTS public.content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('blog_post', 'video', 'podcast', 'social_post', 'newsletter', 'case_study', 'whitepaper', 'infographic', 'webinar', 'ebook', 'ad', 'landing_page')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  segment_id UUID REFERENCES public.segments(id),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  estimated_reading_time INTEGER,
  word_count INTEGER,
  seo_score INTEGER
);

-- Add RLS policies
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- Policy for select: users can read content for sites they have access to
CREATE POLICY content_select_policy ON public.content
  FOR SELECT USING (
    site_id IN (
      SELECT site_id FROM public.site_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy for insert: users can insert content for sites they have access to
CREATE POLICY content_insert_policy ON public.content
  FOR INSERT WITH CHECK (
    site_id IN (
      SELECT site_id FROM public.site_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy for update: users can update content for sites they have access to
CREATE POLICY content_update_policy ON public.content
  FOR UPDATE USING (
    site_id IN (
      SELECT site_id FROM public.site_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy for delete: users can delete content for sites they have access to
CREATE POLICY content_delete_policy ON public.content
  FOR DELETE USING (
    site_id IN (
      SELECT site_id FROM public.site_users
      WHERE user_id = auth.uid()
    )
  ); 
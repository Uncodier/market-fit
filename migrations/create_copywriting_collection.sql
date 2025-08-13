-- Create copywriting collection for sites
-- Date: 2024-12-19
-- Description: Create table and policies for copywriting content management

-- ================================
-- CREATE COPYWRITING TABLE
-- ================================

CREATE TABLE IF NOT EXISTS public.copywriting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content fields
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  copy_type TEXT NOT NULL CHECK (copy_type IN (
    'tweet', 'pitch', 'blurb', 'cold_email', 'cold_call', 
    'social_post', 'ad_copy', 'landing_page', 'email_subject',
    'product_description', 'tagline', 'call_to_action', 'other'
  )),
  
  -- Metadata
  target_audience TEXT,
  use_case TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Status and workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT copywriting_site_user_title_unique UNIQUE (site_id, user_id, title)
);

-- ================================
-- CREATE INDEXES
-- ================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_copywriting_site_id ON public.copywriting(site_id);
CREATE INDEX IF NOT EXISTS idx_copywriting_user_id ON public.copywriting(user_id);
CREATE INDEX IF NOT EXISTS idx_copywriting_copy_type ON public.copywriting(copy_type);
CREATE INDEX IF NOT EXISTS idx_copywriting_status ON public.copywriting(status);
CREATE INDEX IF NOT EXISTS idx_copywriting_created_at ON public.copywriting(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copywriting_tags ON public.copywriting USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_copywriting_site_type_status ON public.copywriting(site_id, copy_type, status);
CREATE INDEX IF NOT EXISTS idx_copywriting_user_type_created ON public.copywriting(user_id, copy_type, created_at DESC);

-- ================================
-- ENABLE ROW LEVEL SECURITY
-- ================================

ALTER TABLE public.copywriting ENABLE ROW LEVEL SECURITY;

-- ================================
-- CREATE RLS POLICIES
-- ================================

-- Drop any existing policies first
DROP POLICY IF EXISTS "copywriting_site_access_policy" ON public.copywriting;

-- Create unified policy for site owners and members
CREATE POLICY "copywriting_site_access_policy" ON public.copywriting
FOR ALL
TO authenticated
USING (
  -- Users can access copywriting from sites they own or are active members of
  site_id IN (
    -- Site owners
    SELECT id FROM public.sites WHERE user_id = (SELECT auth.uid())
    UNION
    -- Active site members
    SELECT site_id FROM public.site_members 
    WHERE user_id = (SELECT auth.uid()) AND status = 'active'
  )
)
WITH CHECK (
  -- Users can modify copywriting for sites they own or are active members of
  site_id IN (
    -- Site owners
    SELECT id FROM public.sites WHERE user_id = (SELECT auth.uid())
    UNION
    -- Active site members
    SELECT site_id FROM public.site_members 
    WHERE user_id = (SELECT auth.uid()) AND status = 'active'
  )
);

-- ================================
-- GRANT PERMISSIONS
-- ================================

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.copywriting TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ================================
-- CREATE UPDATE TRIGGER
-- ================================

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION public.update_copywriting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_copywriting_updated_at ON public.copywriting;
CREATE TRIGGER trigger_update_copywriting_updated_at
  BEFORE UPDATE ON public.copywriting
  FOR EACH ROW
  EXECUTE FUNCTION public.update_copywriting_updated_at();

-- ================================
-- VERIFY SETUP
-- ================================

-- Verify table was created
SELECT 
  '✅ COPYWRITING TABLE CREATED' as status,
  count(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'copywriting';

-- Verify RLS is enabled
SELECT 
  '✅ RLS STATUS' as status,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname = 'copywriting' 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Verify policies exist
SELECT 
  '✅ POLICIES CREATED' as status,
  count(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'copywriting';

-- Verify indexes exist
SELECT 
  '✅ INDEXES CREATED' as status,
  count(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'copywriting';

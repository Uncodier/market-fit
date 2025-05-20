-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create relation table between tasks and categories
CREATE TABLE IF NOT EXISTS public.task_categories (
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, category_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_categories_site_id ON public.categories(site_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);

-- Create indexes for the relation table
CREATE INDEX IF NOT EXISTS idx_task_categories_task_id ON public.task_categories(task_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_category_id ON public.task_categories(category_id);

-- Add RLS policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
CREATE POLICY "Users can view their own site's categories"
  ON public.categories
  FOR SELECT
  USING (auth.uid() = user_id OR site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create categories for their sites"
  ON public.categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own categories"
  ON public.categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON public.categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for task_categories
CREATE POLICY "Users can view their own task categories"
  ON public.task_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.categories c ON c.id = category_id
      WHERE t.id = task_id AND (t.user_id = auth.uid() OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage their own task categories"
  ON public.task_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.categories c ON c.id = category_id
      WHERE t.id = task_id AND (t.user_id = auth.uid() OR c.user_id = auth.uid())
    )
  ); 
-- Create site_members table for access control
CREATE TABLE IF NOT EXISTS public.site_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'marketing', 'collaborator')),
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT NOT NULL,
  name TEXT,
  position TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  UNIQUE(site_id, user_id),
  UNIQUE(site_id, email)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_members_site_id ON public.site_members(site_id);
CREATE INDEX IF NOT EXISTS idx_site_members_user_id ON public.site_members(user_id);
CREATE INDEX IF NOT EXISTS idx_site_members_email ON public.site_members(email);
CREATE INDEX IF NOT EXISTS idx_site_members_role ON public.site_members(role);

-- Trigger to update updated_at timestamp automatically
CREATE TRIGGER update_site_members_updated_at
BEFORE UPDATE ON public.site_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on site_members table
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for site_members

-- Site owners can view site members for their sites
CREATE POLICY "Site owners can view site members"
ON public.site_members
FOR SELECT
USING (
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Site owners and admins can add site members
CREATE POLICY "Site owners and admins can add site members"
ON public.site_members
FOR INSERT
WITH CHECK (
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Site owners and admins can update site members
CREATE POLICY "Site owners and admins can update site members"
ON public.site_members
FOR UPDATE
USING (
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Site owners and admins can delete site members
CREATE POLICY "Site owners and admins can delete site members"
ON public.site_members
FOR DELETE
USING (
  site_id IN (
    SELECT id FROM public.sites WHERE user_id = auth.uid()
  )
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Function to create site_members from settings.team_members
CREATE OR REPLACE FUNCTION migrate_team_members_to_site_members()
RETURNS void AS $$
BEGIN
  -- For each site with team members in settings
  INSERT INTO public.site_members (site_id, user_id, role, email, name, position, added_by, status)
  SELECT 
    s.id AS site_id,
    (SELECT id FROM auth.users WHERE email = tm.email LIMIT 1) AS user_id,
    CASE 
      WHEN tm.role = 'admin' THEN 'admin'
      WHEN tm.role = 'delete' THEN 'marketing'
      WHEN tm.role = 'create' THEN 'marketing'
      WHEN tm.role = 'view' THEN 'collaborator'
      ELSE 'collaborator' 
    END AS role,
    tm.email,
    tm.name,
    tm.position,
    s.user_id AS added_by,
    CASE
      WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = tm.email) THEN 'active'
      ELSE 'pending'
    END AS status
  FROM public.sites s
  CROSS JOIN LATERAL jsonb_to_recordset(
    COALESCE(
      (SELECT team_members FROM public.settings WHERE site_id = s.id),
      '[]'::jsonb
    )
  ) AS tm(email text, role text, name text, position text)
  WHERE tm.email IS NOT NULL AND tm.email != ''
  -- Don't duplicate entries
  ON CONFLICT (site_id, email) DO NOTHING;
  
  -- Set the creator of each site as the owner in site_members if not already
  INSERT INTO public.site_members (site_id, user_id, role, email, name, position, status)
  SELECT 
    s.id AS site_id,
    s.user_id AS user_id,
    'owner' AS role,
    u.email,
    p.name,
    '' AS position,
    'active' AS status
  FROM public.sites s
  JOIN auth.users u ON s.user_id = u.id
  LEFT JOIN public.profiles p ON s.user_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.site_members 
    WHERE site_id = s.id AND user_id = s.user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function
SELECT migrate_team_members_to_site_members();

-- Update RLS policies on all site-related tables to include site_members access

-- Update sites table policies
DROP POLICY IF EXISTS "Site owners can view their sites" ON public.sites;
CREATE POLICY "Site owners and members can view sites"
ON public.sites
FOR SELECT
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Update existing RLS policies for content tables to include site_members access
-- Segments
DROP POLICY IF EXISTS "Users can view segments for their sites" ON public.segments;
CREATE POLICY "Users can view segments for their sites" ON public.segments
  FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
    OR
    site_id IN (
      SELECT site_id FROM public.site_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can create segments for their sites" ON public.segments;
CREATE POLICY "Users can create segments for their sites" ON public.segments
  FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
    OR
    site_id IN (
      SELECT site_id FROM public.site_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update segments for their sites" ON public.segments;
CREATE POLICY "Users can update segments for their sites" ON public.segments
  FOR UPDATE
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
    OR
    site_id IN (
      SELECT site_id FROM public.site_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete segments for their sites" ON public.segments;
CREATE POLICY "Users can delete segments for their sites" ON public.segments
  FOR DELETE
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
    OR
    site_id IN (
      SELECT site_id FROM public.site_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Similarly update policies for other tables like experiments, leads, requirements, kpis, etc.
-- Here's an example for settings table:

DROP POLICY IF EXISTS "Users can view settings for their sites" ON public.settings;
CREATE POLICY "Users can view settings for their sites" ON public.settings
  FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
    OR
    site_id IN (
      SELECT site_id FROM public.site_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update settings for their sites" ON public.settings;
CREATE POLICY "Users can update settings for their sites" ON public.settings
  FOR UPDATE
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
    )
    OR
    site_id IN (
      SELECT site_id FROM public.site_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Create function to sync team_members in settings with site_members
CREATE OR REPLACE FUNCTION sync_site_members_to_team_members()
RETURNS TRIGGER AS $$
DECLARE
  team_members_json JSONB;
BEGIN
  -- Get all site members for this site and convert to team_members format
  SELECT json_agg(json_build_object(
    'email', email,
    'role', 
    CASE 
      WHEN role = 'admin' THEN 'admin'
      WHEN role = 'marketing' THEN 'create'
      WHEN role = 'collaborator' THEN 'view'
      WHEN role = 'owner' THEN 'admin'
    END,
    'name', name,
    'position', position
  ))
  INTO team_members_json
  FROM public.site_members
  WHERE site_id = NEW.site_id AND status = 'active' AND role != 'owner';
  
  -- Only include non-null values
  team_members_json = COALESCE(team_members_json, '[]'::jsonb);
  
  -- Update the settings table
  UPDATE public.settings
  SET team_members = team_members_json
  WHERE site_id = NEW.site_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync site_members to team_members in settings
CREATE TRIGGER sync_site_members_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.site_members
FOR EACH ROW
EXECUTE FUNCTION sync_site_members_to_team_members();

-- Add function to handle site member invitations
CREATE OR REPLACE FUNCTION handle_site_member_invitation()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new user registers, check if they have pending invitations
  IF TG_OP = 'INSERT' THEN
    -- Update site_members status where email matches the new user
    UPDATE public.site_members
    SET 
      user_id = NEW.id,
      status = 'active'
    WHERE email = NEW.email AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users to handle invitations when new users register
CREATE TRIGGER handle_site_member_invitation_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_site_member_invitation(); 
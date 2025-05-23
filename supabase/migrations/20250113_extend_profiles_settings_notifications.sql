-- Migration to extend profiles table with profile settings and notifications
-- Created: 2024-01-13

-- Add new columns to profiles table for profile settings and notifications
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('Product Manager', 'Designer', 'Developer', 'Marketing', 'Sales', 'CEO', 'Other')),
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en', 'fr', 'de')),
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Mexico_City',
ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{"email": true, "push": true}',
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_language ON public.profiles(language);
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON public.profiles(timezone);

-- Add GIN index for JSONB fields for better querying
CREATE INDEX IF NOT EXISTS idx_profiles_notifications ON public.profiles USING GIN (notifications);
CREATE INDEX IF NOT EXISTS idx_profiles_settings ON public.profiles USING GIN (settings);

-- Update the trigger to handle the new columns (trigger already exists for updated_at)
-- No need to recreate since it already handles all columns

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.bio IS 'User biography or description';
COMMENT ON COLUMN public.profiles.role IS 'User role in the organization';
COMMENT ON COLUMN public.profiles.language IS 'Preferred language for the user interface';
COMMENT ON COLUMN public.profiles.timezone IS 'User timezone for proper date/time display';
COMMENT ON COLUMN public.profiles.notifications IS 'User notification preferences as JSON';
COMMENT ON COLUMN public.profiles.settings IS 'Additional profile settings as JSON';

-- Optional: Create a function to validate notification structure
CREATE OR REPLACE FUNCTION validate_notifications(notifications JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if notifications has the required structure
  RETURN (
    notifications ? 'email' AND
    notifications ? 'push' AND
    (notifications->>'email')::boolean IS NOT NULL AND
    (notifications->>'push')::boolean IS NOT NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint to ensure notifications have proper structure
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_notifications 
CHECK (validate_notifications(notifications));

-- Create a helper function to get user profile with all settings
CREATE OR REPLACE FUNCTION get_user_profile_complete(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT,
  language TEXT,
  timezone TEXT,
  notifications JSONB,
  settings JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.name,
    p.avatar_url,
    p.bio,
    p.role,
    p.language,
    p.timezone,
    p.notifications,
    p.settings,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profile_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_notifications(JSONB) TO authenticated; 
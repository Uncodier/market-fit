# SQL Script to Fix Content Table and RLS Policies

Copy this SQL script to your Supabase SQL Editor to properly configure your content table and RLS policies:

```sql
-- 1. Add the missing user_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content' AND column_name = 'user_id') THEN
    ALTER TABLE content ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- 2. Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON content;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON content;
DROP POLICY IF EXISTS "Enable update for content owners" ON content;
DROP POLICY IF EXISTS "Enable delete for content owners" ON content;

-- 3. Enable Row Level Security
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- 4. Create a policy allowing users to read ANY content for sites they have access to
CREATE POLICY "Enable read access for authenticated users" 
ON content FOR SELECT 
USING (
  site_id IN (
    SELECT site_id FROM site_permissions
    WHERE user_id = auth.uid()
  )
);

-- 5. Create a policy allowing users to insert content for sites they have access to
CREATE POLICY "Enable insert for authenticated users" 
ON content FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND
  site_id IN (
    SELECT site_id FROM site_permissions
    WHERE user_id = auth.uid()
  )
);

-- 6. Create a policy allowing users to update content for sites they have access to
CREATE POLICY "Enable update for content owners" 
ON content FOR UPDATE 
USING (
  site_id IN (
    SELECT site_id FROM site_permissions
    WHERE user_id = auth.uid()
  )
);

-- 7. Create a policy allowing users to delete content for sites they have access to
CREATE POLICY "Enable delete for content owners" 
ON content FOR DELETE 
USING (
  site_id IN (
    SELECT site_id FROM site_permissions
    WHERE user_id = auth.uid()
  )
);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS content_site_id_idx ON content(site_id);
CREATE INDEX IF NOT EXISTS content_segment_id_idx ON content(segment_id);
CREATE INDEX IF NOT EXISTS content_status_idx ON content(status);
CREATE INDEX IF NOT EXISTS content_user_id_idx ON content(user_id);

-- 9. Make sure all site admins have permissions in site_permissions
-- This ensures site owners can see all content for their sites
INSERT INTO site_permissions (user_id, site_id, role)
SELECT u.id, s.id, 'admin'
FROM auth.users u
JOIN sites s ON s.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM site_permissions sp 
  WHERE sp.user_id = u.id AND sp.site_id = s.id
);
```

Después de ejecutar este script, necesitamos asegurarnos de que cada contenido tenga un user_id válido:

```sql
-- Update existing content to set user_id equal to author_id if user_id is NULL
UPDATE content
SET user_id = author_id
WHERE user_id IS NULL AND author_id IS NOT NULL;
``` 
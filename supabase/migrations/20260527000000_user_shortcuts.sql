CREATE TABLE IF NOT EXISTS user_shortcuts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcuts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_shortcuts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own shortcuts" ON user_shortcuts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shortcuts" ON user_shortcuts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shortcuts" ON user_shortcuts
  FOR UPDATE USING (auth.uid() = user_id);

-- Add to publication for realtime if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_shortcuts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_shortcuts;
  END IF;
END
$$;

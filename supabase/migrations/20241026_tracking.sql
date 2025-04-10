-- Add tracking field to sites table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'tracking'
  ) THEN
    ALTER TABLE public.sites ADD COLUMN tracking JSONB DEFAULT '{"track_visitors": false, "track_actions": false, "record_screen": false}';
  END IF;
END
$$; 
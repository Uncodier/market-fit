-- Add calendars column to settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS calendars jsonb DEFAULT '[]'::jsonb;

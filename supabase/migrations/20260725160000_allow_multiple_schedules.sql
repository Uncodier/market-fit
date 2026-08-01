-- Drop the UNIQUE constraint on catalog_item_id so multiple schedules can be created per item
ALTER TABLE public.reservation_schedules DROP CONSTRAINT IF EXISTS reservation_schedules_catalog_item_id_key;

-- Add name field to distinguish between schedules
ALTER TABLE public.reservation_schedules ADD COLUMN IF NOT EXISTS name text;
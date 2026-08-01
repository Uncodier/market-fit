-- Add shop settings column to settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS shop jsonb DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.settings.shop IS 'Shop storefront settings including hero, trust badges, payment and delivery policies';

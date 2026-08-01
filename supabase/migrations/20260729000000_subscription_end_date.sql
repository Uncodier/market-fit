-- Add end_date to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS end_date timestamp with time zone;

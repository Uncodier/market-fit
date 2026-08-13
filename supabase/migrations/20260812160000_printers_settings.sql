-- Printer settings: logical devices and module routing (per site)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS printers jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.settings.printers IS 'Thermal printer registry: devices, paper width, module routing and auto-print flags';

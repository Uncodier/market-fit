-- Link sales and transactions (expenses) to inventory locations
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_location_id ON public.sales (location_id);
CREATE INDEX IF NOT EXISTS idx_transactions_location_id ON public.transactions (location_id);

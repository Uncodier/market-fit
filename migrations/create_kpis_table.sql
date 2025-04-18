-- Create KPIs table
CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL,
  previous_value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  type TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  segment_id UUID REFERENCES public.segments(id),
  is_highlighted BOOLEAN DEFAULT false,
  target_value NUMERIC,
  metadata JSONB,
  site_id UUID NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  trend NUMERIC NOT NULL,
  benchmark NUMERIC
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kpis_type_site ON public.kpis(type, site_id);
CREATE INDEX IF NOT EXISTS idx_kpis_segment ON public.kpis(segment_id);
CREATE INDEX IF NOT EXISTS idx_kpis_period ON public.kpis(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpis_highlighted ON public.kpis(is_highlighted);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_kpis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at timestamp
CREATE TRIGGER kpis_updated_at
BEFORE UPDATE ON public.kpis
FOR EACH ROW
EXECUTE FUNCTION update_kpis_updated_at(); 
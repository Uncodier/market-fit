-- Update agents table to add new fields
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS tools JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS activities JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS integrations JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS supervisor UUID REFERENCES public.agents(id);

-- Create junction table for many-to-many relationship between agents and assets
CREATE TABLE IF NOT EXISTS public.agent_assets (
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, asset_id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_agent_assets_agent_id ON public.agent_assets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_assets_asset_id ON public.agent_assets(asset_id);

-- RLS Policy for agent_assets
CREATE POLICY "Permitir a los usuarios gestionar relaciones entre agentes y assets"
  ON public.agent_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE id = agent_id AND user_id = auth.uid()
    )
  );

-- Enable RLS on the new table
ALTER TABLE public.agent_assets ENABLE ROW LEVEL SECURITY; 
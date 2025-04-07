-- Asegurar que existe la tabla de relación entre campañas y requisitos
CREATE TABLE IF NOT EXISTS public.campaign_requirements (
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, requirement_id)
);

-- Crear una vista para poder usar requirement_campaigns (para compatibilidad con ambos nombres)
CREATE OR REPLACE VIEW public.requirement_campaigns AS
  SELECT requirement_id, campaign_id
  FROM public.campaign_requirements;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_campaign_requirements_campaign_id ON public.campaign_requirements(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_requirements_requirement_id ON public.campaign_requirements(requirement_id); 
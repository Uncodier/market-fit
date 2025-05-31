-- Crear extensión pgcrypto si no existe (para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Crear tabla companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT CHECK (industry IN (
    'technology', 'finance', 'healthcare', 'education', 'retail', 
    'manufacturing', 'services', 'hospitality', 'media', 'real_estate', 
    'logistics', 'nonprofit', 'other'
  )),
  size TEXT CHECK (size IN (
    '1-10', '11-50', '51-200', '201-500', '501-1000', 
    '1001-5000', '5001-10000', '10001+'
  )),
  annual_revenue TEXT CHECK (annual_revenue IN (
    '<1M', '1M-10M', '10M-50M', '50M-100M', '100M-500M', 
    '500M-1B', '>1B'
  )),
  founded TEXT,
  description TEXT,
  address JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON public.companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_size ON public.companies(size);

-- Crear trigger para updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Migrar datos existentes de leads a companies
-- Primero, insertar empresas únicas desde la tabla leads (extraer name del JSON)
INSERT INTO public.companies (name, created_at, updated_at)
SELECT DISTINCT 
  company->>'name' as name,
  NOW() as created_at,
  NOW() as updated_at
FROM public.leads 
WHERE company IS NOT NULL 
  AND company->>'name' IS NOT NULL 
  AND company->>'name' != ''
ON CONFLICT DO NOTHING;

-- Agregar columna company_id a la tabla leads
ALTER TABLE public.leads ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Crear índice para company_id
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);

-- Actualizar leads con los company_id correspondientes
UPDATE public.leads 
SET company_id = companies.id
FROM public.companies
WHERE leads.company->>'name' = companies.name 
  AND leads.company IS NOT NULL 
  AND leads.company->>'name' IS NOT NULL
  AND leads.company->>'name' != '';

-- Opcional: Mantener el campo company por compatibilidad temporalmente
-- Puedes eliminar esta línea si quieres remover el campo company inmediatamente
-- ALTER TABLE public.leads DROP COLUMN company;

-- Comentar la línea de arriba y mantener ambos campos durante la transición
-- para asegurar compatibilidad con el código existente 
-- Agregar campos legales y fiscales a la tabla companies
ALTER TABLE public.companies 
ADD COLUMN legal_name TEXT,
ADD COLUMN tax_id TEXT,
ADD COLUMN tax_country TEXT,
ADD COLUMN registration_number TEXT,
ADD COLUMN vat_number TEXT,
ADD COLUMN legal_structure TEXT CHECK (legal_structure IN (
  'sole_proprietorship', 'partnership', 'llc', 'corporation', 
  'nonprofit', 'cooperative', 's_corp', 'c_corp', 'lp', 'llp',
  'sa', 'srl', 'gmbh', 'ltd', 'plc', 'bv', 'nv', 'other'
)),
ADD COLUMN phone TEXT,
ADD COLUMN email TEXT,
ADD COLUMN linkedin_url TEXT,
ADD COLUMN employees_count INTEGER,
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN stock_symbol TEXT,
ADD COLUMN parent_company_id UUID REFERENCES public.companies(id);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_companies_tax_id ON public.companies(tax_id);
CREATE INDEX IF NOT EXISTS idx_companies_registration_number ON public.companies(registration_number);
CREATE INDEX IF NOT EXISTS idx_companies_vat_number ON public.companies(vat_number);
CREATE INDEX IF NOT EXISTS idx_companies_tax_country ON public.companies(tax_country);
CREATE INDEX IF NOT EXISTS idx_companies_legal_structure ON public.companies(legal_structure);
CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_public ON public.companies(is_public);
CREATE INDEX IF NOT EXISTS idx_companies_employees_count ON public.companies(employees_count);

-- Comentarios para documentar los campos
COMMENT ON COLUMN public.companies.legal_name IS 'Official legal name of the company';
COMMENT ON COLUMN public.companies.tax_id IS 'Tax identification number (EIN, RFC, etc.)';
COMMENT ON COLUMN public.companies.tax_country IS 'Country where the company pays taxes';
COMMENT ON COLUMN public.companies.registration_number IS 'Business registration number';
COMMENT ON COLUMN public.companies.vat_number IS 'VAT/GST registration number';
COMMENT ON COLUMN public.companies.legal_structure IS 'Legal structure type of the company';
COMMENT ON COLUMN public.companies.phone IS 'Primary company phone number';
COMMENT ON COLUMN public.companies.email IS 'Primary company email address';
COMMENT ON COLUMN public.companies.linkedin_url IS 'Company LinkedIn profile URL';
COMMENT ON COLUMN public.companies.employees_count IS 'Exact number of employees';
COMMENT ON COLUMN public.companies.is_public IS 'Whether the company is publicly traded';
COMMENT ON COLUMN public.companies.stock_symbol IS 'Stock ticker symbol if publicly traded';
COMMENT ON COLUMN public.companies.parent_company_id IS 'Reference to parent company if subsidiary'; 
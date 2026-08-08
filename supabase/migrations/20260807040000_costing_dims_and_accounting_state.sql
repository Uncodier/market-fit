-- 1. Transactions table
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_category_id UUID REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_state TEXT NOT NULL DEFAULT 'pending' CHECK (accounting_state IN ('pending', 'posted', 'unpublished'));

-- 2. Sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_state TEXT NOT NULL DEFAULT 'pending' CHECK (accounting_state IN ('pending', 'posted', 'unpublished'));

-- 3. Journal Lines table
ALTER TABLE public.journal_lines
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_category_id UUID REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 4. Catalog Categories table
ALTER TABLE public.catalog_categories
  ADD COLUMN IF NOT EXISTS income_account_key TEXT,
  ADD COLUMN IF NOT EXISTS cogs_account_key TEXT;

-- 5. Backfill posted state
UPDATE public.sales s
SET accounting_state = 'posted'
FROM public.journal_entries je
WHERE je.source_id = s.id AND je.source_type = 'sale';

UPDATE public.transactions t
SET accounting_state = 'posted'
FROM public.journal_entries je
WHERE je.source_id = t.id AND je.source_type = 'expense';

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_lead ON public.transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_transactions_catalog_item ON public.transactions(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_catalog_category ON public.transactions(catalog_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_segment ON public.transactions(segment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_accounting_state ON public.transactions(site_id, accounting_state);

CREATE INDEX IF NOT EXISTS idx_sales_company ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_accounting_state ON public.sales(site_id, accounting_state);

CREATE INDEX IF NOT EXISTS idx_journal_lines_lead ON public.journal_lines(lead_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_campaign ON public.journal_lines(campaign_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_catalog_item ON public.journal_lines(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_catalog_category ON public.journal_lines(catalog_category_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_company ON public.journal_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_segment ON public.journal_lines(segment_id);

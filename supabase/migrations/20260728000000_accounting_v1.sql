-- Accounting V1 Schema

CREATE TABLE public.accounting_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    key TEXT,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    label TEXT NOT NULL,
    system BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(site_id, code)
);
CREATE UNIQUE INDEX accounting_accounts_site_key_idx ON public.accounting_accounts(site_id, key) WHERE key IS NOT NULL;

CREATE TABLE public.journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    entry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    memo TEXT,
    status TEXT NOT NULL DEFAULT 'posted',
    source_type TEXT NOT NULL CHECK (source_type IN ('sale', 'expense', 'opening', 'manual')),
    source_id UUID,
    idempotency_key TEXT NOT NULL,
    source_hash TEXT,
    currency TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(site_id, idempotency_key)
);

CREATE TABLE public.journal_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    debit NUMERIC NOT NULL DEFAULT 0,
    credit NUMERIC NOT NULL DEFAULT 0,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their site's accounts" ON public.accounting_accounts
    FOR ALL USING (site_id IN (SELECT site_id FROM public.site_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their site's journal entries" ON public.journal_entries
    FOR ALL USING (site_id IN (SELECT site_id FROM public.site_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their site's journal lines" ON public.journal_lines
    FOR ALL USING (entry_id IN (SELECT id FROM public.journal_entries WHERE site_id IN (SELECT site_id FROM public.site_members WHERE user_id = auth.uid())));

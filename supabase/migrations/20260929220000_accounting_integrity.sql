-- No ledger backfill. Invalid historical rows remain visible for explicit review.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.accounting_accounts WHERE key IS NOT NULL
    GROUP BY site_id, key HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Accounting migration blocked: duplicate site/account keys require review'
      USING HINT = 'SELECT site_id, key, count(*) FROM public.accounting_accounts WHERE key IS NOT NULL GROUP BY site_id, key HAVING count(*) > 1';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.journal_entries e LEFT JOIN public.journal_lines l ON l.entry_id = e.id
    GROUP BY e.id HAVING count(l.id) < 2 OR sum(l.debit) IS DISTINCT FROM sum(l.credit)
      OR coalesce(sum(l.debit), 0) <= 0
  ) THEN
    RAISE WARNING 'Historical journals require review; this migration does not repair or repost them';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS accounting_accounts_site_key_unique
  ON public.accounting_accounts(site_id, key) WHERE key IS NOT NULL;
CREATE INDEX IF NOT EXISTS journal_entries_source_lookup
  ON public.journal_entries(site_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS journal_lines_entry_account_lookup
  ON public.journal_lines(entry_id, account_code);

-- NOT VALID avoids rewriting/rejecting old ledgers while enforcing every new write.
ALTER TABLE public.journal_lines ADD CONSTRAINT accounting_line_amounts_valid CHECK (
  debit IS NOT NULL AND credit IS NOT NULL
  AND debit BETWEEN 0 AND 1000000000000 AND credit BETWEEN 0 AND 1000000000000
  AND debit = trunc(debit, 2) AND credit = trunc(credit, 2)
  AND ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
) NOT VALID;
ALTER TABLE public.journal_entries ADD CONSTRAINT accounting_entry_currency_valid CHECK (
  currency IS NOT NULL AND currency ~ '^[A-Z]{3}$'
) NOT VALID;
ALTER TABLE public.journal_entries ADD CONSTRAINT accounting_entry_date_valid CHECK (
  entry_date IS NOT NULL AND isfinite(entry_date)
) NOT VALID;

ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE policy_row record; table_name text; columns_list text;
BEGIN
  -- Broad historical ALL policies must not remain alongside restrictive policies.
  FOR policy_row IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('accounting_accounts', 'journal_entries', 'journal_lines')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['accounting_accounts', 'journal_entries', 'journal_lines'] LOOP
    SELECT string_agg(quote_ident(attname), ',') INTO columns_list FROM pg_attribute
      WHERE attrelid = format('public.%I', table_name)::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON public.%I FROM PUBLIC, anon, authenticated, service_role',
      columns_list, table_name);
  END LOOP;
END;
$$;
REVOKE ALL ON public.journal_entries, public.journal_lines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.journal_entries, public.journal_lines TO authenticated, service_role;
REVOKE ALL ON public.accounting_accounts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_accounts TO authenticated, service_role;

CREATE POLICY accounting_accounts_select ON public.accounting_accounts FOR SELECT TO authenticated
  USING (public.user_can(site_id, 'select'));
CREATE POLICY accounting_accounts_insert ON public.accounting_accounts FOR INSERT TO authenticated
  WITH CHECK (public.user_can(site_id, 'insert'));
CREATE POLICY accounting_accounts_update ON public.accounting_accounts FOR UPDATE TO authenticated
  USING (public.user_can(site_id, 'update')) WITH CHECK (public.user_can(site_id, 'update'));
CREATE POLICY accounting_accounts_delete ON public.accounting_accounts FOR DELETE TO authenticated
  USING (public.user_can(site_id, 'delete'));
CREATE POLICY journal_entries_select ON public.journal_entries FOR SELECT TO authenticated
  USING (public.user_can(site_id, 'select'));
CREATE POLICY journal_lines_select ON public.journal_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries e
    WHERE e.id = entry_id AND public.user_can(e.site_id, 'select')));

CREATE OR REPLACE FUNCTION public.accounting_guard_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE referenced boolean; required_type text; required_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT EXISTS (SELECT 1 FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id
      WHERE e.site_id = OLD.site_id AND l.account_code = OLD.code) INTO referenced;
    IF TG_OP = 'DELETE' THEN
      -- A site deletion may cascade; an individual referenced/system account may not.
      IF (OLD.system OR referenced) AND EXISTS (SELECT 1 FROM public.sites WHERE id = OLD.site_id) THEN
        RAISE EXCEPTION 'System or referenced accounts cannot be deleted' USING ERRCODE = '23514';
      END IF;
      RETURN OLD;
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id
      OR NEW.system IS DISTINCT FROM OLD.system THEN
      RAISE EXCEPTION 'Account identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF (OLD.system OR referenced) AND (
      NEW.code IS DISTINCT FROM OLD.code OR NEW.type IS DISTINCT FROM OLD.type
      OR (NEW.key IS DISTINCT FROM OLD.key AND NOT (
        OLD.key IS NULL AND NEW.key IS NOT NULL AND auth.role() = 'service_role'))
    ) THEN
      RAISE EXCEPTION 'System or referenced account classification is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.system AND NEW.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'System accounts must remain active' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.code IS NULL OR NEW.code !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$'
    OR NEW.label IS NULL OR length(btrim(NEW.label)) NOT BETWEEN 1 AND 200
    OR NEW.type IS NULL OR NEW.type NOT IN ('asset', 'liability', 'equity', 'income', 'expense')
    OR (NEW.key IS NOT NULL AND NEW.key !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$')
    OR NEW.active IS NULL OR NEW.system IS NULL THEN
    RAISE EXCEPTION 'Invalid accounting account' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.code IS DISTINCT FROM OLD.code OR NEW.key IS DISTINCT FROM OLD.key THEN
    required_type := CASE WHEN NEW.code IN ('1000','1100','1200','1300') THEN 'asset'
      WHEN NEW.code IN ('2100','2200','2300') THEN 'liability' WHEN NEW.code = '3000' THEN 'equity'
      WHEN NEW.code = '4000' THEN 'income' WHEN NEW.code IN ('5000','5600') THEN 'expense' END;
    required_key := CASE NEW.code WHEN '4000' THEN 'revenue' WHEN '5000' THEN 'cogs'
      WHEN '5600' THEN 'operating' END;
    IF required_type IS NOT NULL AND (NEW.type <> required_type OR NOT NEW.system
      OR NOT NEW.active OR NEW.key IS DISTINCT FROM required_key) THEN
      RAISE EXCEPTION 'Reserved system account does not match the chart' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_guard_account() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER accounting_account_integrity BEFORE INSERT OR UPDATE OR DELETE ON public.accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_account();

COMMIT;
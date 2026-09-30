BEGIN;

-- Private validator; all amounts are checked as numeric before a table typmod can round them.
CREATE OR REPLACE FUNCTION public.accounting_validate_journal_lines(
  p_site_id uuid, p_lines jsonb, p_existing_id uuid, p_allow_dimensions boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  line jsonb; debit_amount numeric; credit_amount numeric; debit_total numeric := 0;
  credit_total numeric := 0; account_row public.accounting_accounts%ROWTYPE;
  dimension text; dimension_table text; dimension_id uuid; matched uuid;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Journal lines must be an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_lines) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'A journal requires 2 to 500 lines' USING ERRCODE = '22023';
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF jsonb_typeof(line) IS DISTINCT FROM 'object'
      OR jsonb_typeof(line->'debit') IS DISTINCT FROM 'number'
      OR jsonb_typeof(line->'credit') IS DISTINCT FROM 'number'
      OR jsonb_typeof(line->'account_code') IS DISTINCT FROM 'string'
      OR (line->>'account_code') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$' THEN
      RAISE EXCEPTION 'Invalid journal line' USING ERRCODE = '22023';
    END IF;
    debit_amount := (line->>'debit')::numeric;
    credit_amount := (line->>'credit')::numeric;
    IF debit_amount NOT BETWEEN 0 AND 1000000000000 OR credit_amount NOT BETWEEN 0 AND 1000000000000
      OR debit_amount <> trunc(debit_amount, 2) OR credit_amount <> trunc(credit_amount, 2)
      OR NOT ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)) THEN
      RAISE EXCEPTION 'Each line requires exactly one positive two-decimal amount' USING ERRCODE = '22023';
    END IF;
    debit_total := debit_total + debit_amount;
    credit_total := credit_total + credit_amount;
    SELECT * INTO account_row FROM public.accounting_accounts
      WHERE site_id = p_site_id AND code = line->>'account_code' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Journal account not found in this site' USING ERRCODE = '23514';
    END IF;
    IF account_row.active IS DISTINCT FROM true AND (
      p_existing_id IS NULL OR EXISTS (
        (SELECT l.debit, l.credit FROM public.journal_lines l
          WHERE l.entry_id = p_existing_id AND l.account_code = account_row.code
         EXCEPT ALL
         SELECT (j->>'debit')::numeric, (j->>'credit')::numeric
          FROM jsonb_array_elements(p_lines) j WHERE j->>'account_code' = account_row.code)
        UNION ALL
        (SELECT (j->>'debit')::numeric, (j->>'credit')::numeric
          FROM jsonb_array_elements(p_lines) j WHERE j->>'account_code' = account_row.code
         EXCEPT ALL
         SELECT l.debit, l.credit FROM public.journal_lines l
          WHERE l.entry_id = p_existing_id AND l.account_code = account_row.code)
      )
    ) THEN
      RAISE EXCEPTION 'Inactive account amounts cannot be added or changed' USING ERRCODE = '23514';
    END IF;
    FOREACH dimension IN ARRAY ARRAY['location_id','lead_id','campaign_id','segment_id',
      'catalog_item_id','catalog_category_id','company_id'] LOOP
      IF line->>dimension IS NULL THEN CONTINUE; END IF;
      IF NOT p_allow_dimensions THEN
        RAISE EXCEPTION 'Manual and opening journals do not accept dimensions' USING ERRCODE = '22023';
      END IF;
      dimension_id := (line->>dimension)::uuid;
      dimension_table := CASE dimension WHEN 'location_id' THEN 'locations' WHEN 'lead_id' THEN 'leads'
        WHEN 'campaign_id' THEN 'campaigns' WHEN 'segment_id' THEN 'segments'
        WHEN 'catalog_item_id' THEN 'catalog_items' WHEN 'catalog_category_id' THEN 'catalog_categories'
        WHEN 'company_id' THEN 'companies' END;
      matched := NULL;
      -- Companies are a global registry, not tenant-owned. The source RPC checks
      -- their identity against the locked source; standalone journals forbid dimensions.
      IF dimension = 'company_id' THEN
        SELECT id INTO matched FROM public.companies WHERE id = dimension_id FOR SHARE;
      ELSE
        EXECUTE format('SELECT id FROM public.%I WHERE id = $1 AND site_id = $2 FOR SHARE', dimension_table)
          INTO matched USING dimension_id, p_site_id;
      END IF;
      IF matched IS NULL THEN
        RAISE EXCEPTION 'Invalid journal dimension for this site' USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END LOOP;
  IF p_existing_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.journal_lines l JOIN public.accounting_accounts a
      ON a.site_id = p_site_id AND a.code = l.account_code
    WHERE l.entry_id = p_existing_id AND a.active IS DISTINCT FROM true
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) j WHERE j->>'account_code' = a.code)
  ) THEN
    RAISE EXCEPTION 'Inactive account amounts cannot be removed' USING ERRCODE = '23514';
  END IF;
  IF debit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Journal debits and credits must balance exactly' USING ERRCODE = '23514';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_validate_journal_lines(uuid, jsonb, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accounting_save_journal_internal(
  p_site_id uuid, p_entry jsonb, p_lines jsonb, p_entry_id uuid,
  p_expected_hash text, p_check_version boolean, p_allow_source boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  existing public.journal_entries%ROWTYPE; entry_id uuid; source_kind text;
  source_id uuid; entry_key text; entry_currency text; entry_hash text; entry_day timestamptz;
  is_service boolean := coalesce(auth.role() = 'service_role', false); line jsonb;
BEGIN
  IF p_site_id IS NULL OR (NOT is_service AND (auth.uid() IS NULL OR NOT (
    public.user_can(p_site_id, 'insert') OR public.user_can(p_site_id, 'update')))) THEN
    RAISE EXCEPTION 'Accounting write is not authorized' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_entry) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid journal header' USING ERRCODE = '22023';
  END IF;
  source_kind := p_entry->>'source_type';
  source_id := (p_entry->>'source_id')::uuid;
  entry_key := p_entry->>'idempotency_key';
  entry_currency := p_entry->>'currency';
  entry_hash := p_entry->>'source_hash';
  IF source_kind IS NULL OR source_kind NOT IN ('manual','opening','sale','expense','purchase')
    OR (source_kind IN ('sale','expense','purchase') AND NOT (p_allow_source AND is_service))
    OR (source_kind IN ('manual','opening') AND source_id IS NOT NULL)
    OR (source_kind IN ('sale','expense','purchase') AND source_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid or unauthorized journal source' USING ERRCODE = '42501';
  END IF;
  IF entry_key IS NULL OR length(entry_key) NOT BETWEEN 1 AND 300
    OR (source_kind = 'manual' AND entry_key !~ '^manual:[0-9a-fA-F-]{36}$')
    OR (source_kind = 'opening' AND entry_key <> 'opening:' || p_site_id::text)
    OR entry_currency IS NULL OR entry_currency !~ '^[A-Z]{3}$'
    OR entry_hash IS NULL OR entry_hash !~ '^[0-9a-f]{64}$'
    OR coalesce(length(p_entry->>'memo'), 0) > 2000
    OR (p_entry ? 'site_id' AND p_entry->>'site_id' IS DISTINCT FROM p_site_id::text)
    OR (p_entry->>'entry_date') IS NULL
    OR (p_entry->>'entry_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00([.]0{1,6})?Z$' THEN
    RAISE EXCEPTION 'Invalid journal header fields' USING ERRCODE = '22023';
  END IF;
  entry_day := (p_entry->>'entry_date')::timestamptz;
  IF NOT isfinite(entry_day) THEN
    RAISE EXCEPTION 'Invalid journal date' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('accounting:journal:' || p_site_id::text || ':' || entry_key, 0));
  IF p_entry_id IS NULL THEN
    SELECT * INTO existing FROM public.journal_entries
      WHERE site_id = p_site_id AND idempotency_key = entry_key FOR UPDATE;
  ELSE
    SELECT * INTO existing FROM public.journal_entries WHERE site_id = p_site_id AND id = p_entry_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Journal not found in this site' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  IF NOT is_service AND NOT public.user_can(p_site_id, CASE WHEN existing.id IS NULL THEN 'insert' ELSE 'update' END) THEN
    RAISE EXCEPTION 'Accounting operation is not authorized' USING ERRCODE = '42501';
  END IF;
  IF existing.id IS NOT NULL AND (existing.source_type IS DISTINCT FROM source_kind
    OR existing.source_id IS DISTINCT FROM source_id OR existing.idempotency_key IS DISTINCT FROM entry_key) THEN
    RAISE EXCEPTION 'Journal identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF existing.id IS NOT NULL AND source_kind IN ('manual','opening')
    AND existing.currency IS NOT NULL AND existing.currency <> entry_currency THEN
    RAISE EXCEPTION 'Existing journal currency cannot change; use a correcting entry' USING ERRCODE = '23514';
  END IF;
  IF (p_check_version AND existing.source_hash IS DISTINCT FROM p_expected_hash)
    OR (NOT is_service AND existing.id IS NOT NULL AND NOT coalesce(p_check_version, false)) THEN
    RAISE EXCEPTION 'Journal changed; reload before saving' USING ERRCODE = '40001';
  END IF;
  PERFORM public.accounting_validate_journal_lines(p_site_id, p_lines, existing.id, p_allow_source AND is_service);
  -- A hash alone is not proof of equal content. Check all persisted fields and the
  -- complete line multiset before skipping an idempotent replay.
  IF existing.id IS NOT NULL AND existing.source_hash = entry_hash AND existing.entry_date = entry_day
    AND existing.memo IS NOT DISTINCT FROM (p_entry->>'memo') AND existing.currency = entry_currency
    AND existing.status = 'posted' AND NOT EXISTS (
      (SELECT to_jsonb(l) - ARRAY['id','entry_id','created_at','updated_at'] FROM public.journal_lines l
        WHERE l.entry_id = existing.id EXCEPT ALL
       SELECT jsonb_build_object('account_code', j->>'account_code', 'debit', (j->>'debit')::numeric,
         'credit', (j->>'credit')::numeric, 'location_id', j->'location_id', 'lead_id', j->'lead_id',
         'campaign_id', j->'campaign_id', 'segment_id', j->'segment_id', 'catalog_item_id', j->'catalog_item_id',
         'catalog_category_id', j->'catalog_category_id', 'company_id', j->'company_id') FROM jsonb_array_elements(p_lines) j)
      UNION ALL
      (SELECT jsonb_build_object('account_code', j->>'account_code', 'debit', (j->>'debit')::numeric,
         'credit', (j->>'credit')::numeric, 'location_id', j->'location_id', 'lead_id', j->'lead_id',
         'campaign_id', j->'campaign_id', 'segment_id', j->'segment_id', 'catalog_item_id', j->'catalog_item_id',
         'catalog_category_id', j->'catalog_category_id', 'company_id', j->'company_id') FROM jsonb_array_elements(p_lines) j
       EXCEPT ALL SELECT to_jsonb(l) - ARRAY['id','entry_id','created_at','updated_at'] FROM public.journal_lines l
        WHERE l.entry_id = existing.id)
    ) THEN RETURN existing.id;
  END IF;
  IF existing.id IS NULL THEN
    INSERT INTO public.journal_entries(site_id, entry_date, memo, source_type, source_id,
      idempotency_key, source_hash, currency, status)
    VALUES (p_site_id, entry_day, p_entry->>'memo', source_kind, source_id, entry_key, entry_hash, entry_currency, 'posted')
    RETURNING id INTO entry_id;
  ELSE
    entry_id := existing.id;
    UPDATE public.journal_entries SET entry_date = entry_day, memo = p_entry->>'memo',
      source_hash = entry_hash, currency = entry_currency, status = 'posted', updated_at = clock_timestamp()
      WHERE id = entry_id AND site_id = p_site_id;
    DELETE FROM public.journal_lines WHERE journal_lines.entry_id = existing.id;
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_lines(entry_id, account_code, debit, credit, location_id, lead_id,
      campaign_id, segment_id, catalog_item_id, catalog_category_id, company_id)
    VALUES (entry_id, line->>'account_code', (line->>'debit')::numeric, (line->>'credit')::numeric,
      (line->>'location_id')::uuid, (line->>'lead_id')::uuid, (line->>'campaign_id')::uuid,
      (line->>'segment_id')::uuid, (line->>'catalog_item_id')::uuid, (line->>'catalog_category_id')::uuid,
      (line->>'company_id')::uuid);
  END LOOP;
  RETURN entry_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_save_journal_internal(uuid, jsonb, jsonb, uuid, text, boolean, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
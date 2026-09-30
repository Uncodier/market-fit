BEGIN;

CREATE OR REPLACE FUNCTION public.accounting_save_journal(
  p_site_id uuid, p_entry jsonb, p_lines jsonb, p_entry_id uuid DEFAULT NULL,
  p_expected_hash text DEFAULT NULL, p_check_version boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Even service callers must use the source-locked RPC for generated postings.
  IF coalesce(p_entry->>'source_type', '') NOT IN ('manual', 'opening') THEN
    RAISE EXCEPTION 'Standalone journals must be manual or opening entries' USING ERRCODE = '42501';
  END IF;
  RETURN public.accounting_save_journal_internal(p_site_id, p_entry, p_lines, p_entry_id,
    p_expected_hash, p_check_version, false);
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_save_journal(uuid, jsonb, jsonb, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_save_journal(uuid, jsonb, jsonb, uuid, text, boolean)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accounting_delete_manual_journal(p_site_id uuid, p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE entry_key text; source_kind text;
BEGIN
  IF p_site_id IS NULL OR p_entry_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT public.user_can(p_site_id, 'delete'))) THEN
    RAISE EXCEPTION 'Journal deletion is not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT idempotency_key INTO entry_key FROM public.journal_entries WHERE id = p_entry_id AND site_id = p_site_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('accounting:journal:' || p_site_id::text || ':' || entry_key, 0));
  SELECT source_type INTO source_kind FROM public.journal_entries
    WHERE id = p_entry_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal not found' USING ERRCODE = 'P0002'; END IF;
  IF source_kind <> 'manual' THEN
    RAISE EXCEPTION 'Only manual journals can be deleted here' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.journal_lines WHERE entry_id = p_entry_id;
  DELETE FROM public.journal_entries WHERE id = p_entry_id AND site_id = p_site_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_delete_manual_journal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_delete_manual_journal(uuid, uuid) TO authenticated, service_role;

-- Drafts are built only by trusted server code, after authorizing the exact source.
-- Authenticated callers cannot submit invented source amounts, refunds, or states.
CREATE OR REPLACE FUNCTION public.accounting_replace_source_journals(
  p_site_id uuid, p_source_type text, p_source_id uuid, p_entries jsonb,
  p_source_updated_at timestamptz, p_state text DEFAULT 'posted'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  source_table text; source_row jsonb; source_version timestamptz; source_company uuid;
  draft jsonb; line jsonb; entry_key text; key_prefix text; kept_ids uuid[] := ARRAY[]::uuid[];
  seen_keys text[] := ARRAY[]::text[]; saved_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Source journals require a trusted service caller' USING ERRCODE = '42501';
  END IF;
  source_table := CASE p_source_type WHEN 'sale' THEN 'sales' WHEN 'expense' THEN 'transactions'
    WHEN 'purchase' THEN 'purchases' END;
  IF source_table IS NULL OR p_site_id IS NULL OR p_source_id IS NULL OR p_source_updated_at IS NULL
    OR NOT isfinite(p_source_updated_at) OR p_state IS NULL OR p_state NOT IN ('posted','unpublished')
    OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid source journal request' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_entries) > 5000
    OR (p_state = 'unpublished' AND jsonb_array_length(p_entries) <> 0) THEN
    RAISE EXCEPTION 'Invalid source journal count or unpublished payload' USING ERRCODE = '22023';
  END IF;
  key_prefix := p_source_type || ':' || p_source_id::text;
  PERFORM pg_advisory_xact_lock(hashtextextended('accounting:source:' || p_site_id::text || ':' || key_prefix, 0));
  EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE id = $1 AND site_id = $2 FOR UPDATE', source_table)
    INTO source_row USING p_source_id, p_site_id;
  IF source_row IS NULL THEN
    RAISE EXCEPTION 'Accounting source not found in this site' USING ERRCODE = 'P0002';
  END IF;
  source_version := (source_row->>'updated_at')::timestamptz;
  IF source_version IS DISTINCT FROM p_source_updated_at THEN
    RAISE EXCEPTION 'Accounting source changed; reload before posting' USING ERRCODE = '40001';
  END IF;
  source_company := (source_row->>CASE WHEN p_source_type = 'purchase'
    THEN 'vendor_company_id' ELSE 'company_id' END)::uuid;
  FOR draft IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    IF jsonb_typeof(draft) IS DISTINCT FROM 'object' OR jsonb_typeof(draft->'entry') IS DISTINCT FROM 'object'
      OR jsonb_typeof(draft->'lines') IS DISTINCT FROM 'array'
      OR (draft->'entry'->>'source_type') IS DISTINCT FROM p_source_type
      OR (draft->'entry'->>'source_id')::uuid IS DISTINCT FROM p_source_id THEN
      RAISE EXCEPTION 'Journal does not belong to this source' USING ERRCODE = '22023';
    END IF;
    entry_key := draft->'entry'->>'idempotency_key';
    IF entry_key IS NULL OR NOT (entry_key = key_prefix OR starts_with(entry_key, key_prefix || ':'))
      OR entry_key = ANY(seen_keys) THEN
      RAISE EXCEPTION 'Invalid or duplicate source idempotency key' USING ERRCODE = '22023';
    END IF;
    seen_keys := array_append(seen_keys, entry_key);
    FOR line IN SELECT value FROM jsonb_array_elements(draft->'lines') LOOP
      IF line->>'company_id' IS NOT NULL AND (line->>'company_id')::uuid IS DISTINCT FROM source_company THEN
        RAISE EXCEPTION 'Company dimension must match the accounting source' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    saved_id := public.accounting_save_journal_internal(p_site_id, draft->'entry', draft->'lines',
      NULL, NULL, false, true);
    kept_ids := array_append(kept_ids, saved_id);
  END LOOP;
  -- Reconciliation and state change share this transaction; never delete headers
  -- that matched a draft, and never touch a different site's or source's journals.
  DELETE FROM public.journal_lines l USING public.journal_entries e
    WHERE l.entry_id = e.id AND e.site_id = p_site_id AND e.source_type = p_source_type
      AND e.source_id = p_source_id AND NOT (e.id = ANY(kept_ids));
  DELETE FROM public.journal_entries WHERE site_id = p_site_id AND source_type = p_source_type
    AND source_id = p_source_id AND NOT (id = ANY(kept_ids));
  EXECUTE format('UPDATE public.%I SET accounting_state = $1 WHERE id = $2 AND site_id = $3 AND accounting_state IS DISTINCT FROM $1', source_table)
    USING p_state, p_source_id, p_site_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_replace_source_journals(uuid, text, uuid, jsonb, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_replace_source_journals(uuid, text, uuid, jsonb, timestamptz, text)
  TO service_role;

-- Source data changes invalidate posted snapshots even in legacy callers that do
-- not set updated_at. Explicitly unpublished sources remain unpublished.
CREATE OR REPLACE FUNCTION public.accounting_touch_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['updated_at','accounting_state'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at','accounting_state']) THEN
    NEW.accounting_state := CASE WHEN OLD.accounting_state = 'unpublished'
      OR NEW.accounting_state = 'unpublished' THEN 'unpublished' ELSE 'pending' END;
  END IF;
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_touch_source() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER accounting_sales_freshness BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source();
CREATE TRIGGER accounting_transactions_freshness BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source();
CREATE TRIGGER accounting_purchases_freshness BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source();

NOTIFY pgrst, 'reload schema';
COMMIT;
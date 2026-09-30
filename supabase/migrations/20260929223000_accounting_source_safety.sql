BEGIN;

CREATE OR REPLACE FUNCTION public.accounting_delete_source(
  p_site_id uuid, p_source_type text, p_source_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE source_table text; source_row jsonb;
BEGIN
  IF p_site_id IS NULL OR p_source_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT public.user_can(p_site_id, 'delete'))) THEN
    RAISE EXCEPTION 'Accounting source deletion is not authorized' USING ERRCODE = '42501';
  END IF;
  source_table := CASE p_source_type WHEN 'sale' THEN 'sales' WHEN 'expense' THEN 'transactions'
    WHEN 'purchase' THEN 'purchases' END;
  IF source_table IS NULL THEN RAISE EXCEPTION 'Invalid source type' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('accounting:source:' || p_site_id::text || ':' || p_source_type || ':' || p_source_id::text, 0));
  EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE id=$1 AND site_id=$2 FOR UPDATE', source_table)
    INTO source_row USING p_source_id, p_site_id;
  IF source_row IS NULL THEN RAISE EXCEPTION 'Accounting source not found' USING ERRCODE = 'P0002'; END IF;
  IF p_source_type = 'sale' AND EXISTS (SELECT 1 FROM public.accounting_sale_refunds WHERE sale_id = p_source_id) THEN
    RAISE EXCEPTION 'Refunded sales must be retained for audit' USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.journal_lines l USING public.journal_entries e
    WHERE l.entry_id=e.id AND e.site_id=p_site_id AND e.source_type=p_source_type AND e.source_id=p_source_id;
  DELETE FROM public.journal_entries WHERE site_id=p_site_id AND source_type=p_source_type AND source_id=p_source_id;
  -- Any FK, permission trigger or other delete failure rolls back the journal deletes too.
  EXECUTE format('DELETE FROM public.%I WHERE id=$1 AND site_id=$2', source_table) USING p_source_id, p_site_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_delete_source(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_delete_source(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accounting_guard_purchase_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'draft' AND OLD.status IS DISTINCT FROM 'draft' AND (
    OLD.accounting_state IN ('posted','unpublished') OR coalesce(OLD.amount,0) > coalesce(OLD.amount_due,0)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.payments)='array' THEN OLD.payments ELSE '[]'::jsonb END) p
      WHERE coalesce(p->>'amount','0') <> '0')
    OR EXISTS (SELECT 1 FROM public.journal_entries WHERE site_id=OLD.site_id AND source_type='purchase' AND source_id=OLD.id)
  ) THEN
    RAISE EXCEPTION 'A paid or previously posted purchase cannot return to draft' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_guard_purchase_draft() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER accounting_purchase_draft_guard BEFORE UPDATE OF status ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_purchase_draft();

NOTIFY pgrst, 'reload schema';
COMMIT;
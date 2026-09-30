BEGIN;

-- Child changes participate in the same source lock/version protocol as posting.
-- A committed child edit can never leave a stale ledger falsely marked posted.
CREATE OR REPLACE FUNCTION public.accounting_touch_source_from_child()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE child_row jsonb; versions jsonb[]; source_id uuid; source_site uuid; order_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NEW; END IF;
  versions := CASE TG_OP WHEN 'INSERT' THEN ARRAY[to_jsonb(NEW)] WHEN 'DELETE' THEN ARRAY[to_jsonb(OLD)]
    ELSE ARRAY[to_jsonb(OLD), to_jsonb(NEW)] END;
  FOREACH child_row IN ARRAY versions LOOP
    source_site := (child_row->>'site_id')::uuid;
    IF TG_TABLE_NAME = 'purchase_items' THEN
      source_id := (child_row->>'purchase_id')::uuid;
      UPDATE public.purchases SET updated_at = clock_timestamp(),
        accounting_state = CASE WHEN accounting_state = 'unpublished' THEN 'unpublished' ELSE 'pending' END
        WHERE id = source_id AND site_id = source_site;
    ELSE
      IF TG_TABLE_NAME = 'sale_orders' THEN
        source_id := (child_row->>'sale_id')::uuid;
      ELSE
        order_id := (child_row->>'sale_order_id')::uuid;
        SELECT sale_id INTO source_id FROM public.sale_orders WHERE id = order_id AND site_id = source_site;
      END IF;
      UPDATE public.sales SET updated_at = clock_timestamp(),
        accounting_state = CASE WHEN accounting_state = 'unpublished' THEN 'unpublished' ELSE 'pending' END
        WHERE id = source_id AND site_id = source_site;
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_touch_source_from_child() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER accounting_sale_order_freshness AFTER INSERT OR UPDATE OR DELETE ON public.sale_orders
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source_from_child();
CREATE TRIGGER accounting_sale_item_freshness AFTER INSERT OR UPDATE OR DELETE ON public.sale_order_items
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source_from_child();
CREATE TRIGGER accounting_purchase_item_freshness AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source_from_child();

COMMIT;
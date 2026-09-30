BEGIN;

CREATE OR REPLACE FUNCTION public.accounting_preserve_legacy_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE old_row jsonb := to_jsonb(OLD); new_row jsonb := to_jsonb(NEW);
  recorded numeric; inferred numeric; origin text; receipt_id text; currency text; payment jsonb;
BEGIN
  IF new_row->'payments' IS NOT DISTINCT FROM old_row->'payments' THEN RETURN NEW; END IF;
  old_row := jsonb_set(old_row, '{payments}', coalesce(nullif(old_row->'payments','null'::jsonb),'[]'));
  IF jsonb_typeof(old_row->'payments') <> 'array'
    OR jsonb_typeof(new_row->'payments') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Payment history requires review before adding a receipt' USING ERRCODE='23514';
  END IF;
  recorded := 0;
  FOR payment IN SELECT value FROM jsonb_array_elements(coalesce(old_row->'payments','[]')) LOOP
    IF coalesce(payment->>'amount','') !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Payment history contains an invalid amount' USING ERRCODE='23514';
    END IF;
    recorded := recorded + (payment->>'amount')::numeric;
    IF payment->>'legacy_inferred'='true' THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.payments) p WHERE p->>'id'=payment->>'id' AND p IS DISTINCT FROM payment) THEN
        RAISE EXCEPTION 'Legacy inferred balances cannot be modified as receipts' USING ERRCODE='23514';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.payments) p WHERE p->>'id'=payment->>'id') THEN
        NEW.payments := jsonb_build_array(payment) || NEW.payments;
      END IF;
    END IF;
  END LOOP;
  inferred := greatest(0, OLD.amount - OLD.amount_due - recorded);
  IF inferred <= 0 THEN RETURN NEW; END IF;
  origin := old_row->>CASE WHEN TG_TABLE_NAME='sales' THEN 'sale_date' ELSE 'purchase_date' END;
  currency := old_row->>'currency';
  IF origin IS NULL OR currency IS NULL OR currency !~ '^[A-Z]{3}$'
    OR inferred <> trunc(inferred,2) THEN
    RAISE EXCEPTION 'Legacy payment date, amount or currency requires review' USING ERRCODE='23514';
  END IF;
  receipt_id := 'legacy:' || TG_TABLE_NAME || ':' || OLD.id::text;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.payments) p WHERE p->>'id'=receipt_id) THEN
    RAISE EXCEPTION 'Legacy receipt identifiers are server managed' USING ERRCODE='23514';
  END IF;
  -- Preserve the pre-existing compatibility balance, explicitly NOT a bank receipt.
  NEW.payments := jsonb_build_array(jsonb_build_object('id',receipt_id,'amount',inferred,
    'date',origin,'currency',currency,'method','legacy_balance','legacy_inferred',true)) || NEW.payments;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_preserve_legacy_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER accounting_00_sales_legacy_receipt BEFORE UPDATE OF payments ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.accounting_preserve_legacy_receipt();
CREATE TRIGGER accounting_00_purchases_legacy_receipt BEFORE UPDATE OF payments ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.accounting_preserve_legacy_receipt();

CREATE OR REPLACE FUNCTION public.accounting_touch_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE old_data jsonb := to_jsonb(OLD); new_data jsonb := to_jsonb(NEW); field text; changed boolean := false;
BEGIN
  FOREACH field IN ARRAY ARRAY['site_id','amount','amount_due','currency','payments','status','sale_date','purchase_date','date',
    'category','location_id','lead_id','campaign_id','segment_id','catalog_item_id','catalog_category_id',
    'company_id','vendor_company_id','sale_order_id','title','product_name','invoice_number','reference_code','description','notes'] LOOP
    changed := changed OR new_data->field IS DISTINCT FROM old_data->field;
  END LOOP;
  IF changed THEN
    NEW.accounting_state := CASE WHEN OLD.accounting_state='unpublished' OR NEW.accounting_state='unpublished'
      THEN 'unpublished' ELSE 'pending' END;
  END IF;
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_touch_source() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.accounting_touch_source_from_child()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE child_row jsonb; versions jsonb[]; source_id uuid; source_site uuid; field text;
  relevant text[]; changed boolean := false;
BEGIN
  relevant := CASE TG_TABLE_NAME WHEN 'sale_orders' THEN ARRAY['sale_id','site_id','tax_total']
    WHEN 'sale_order_items' THEN ARRAY['sale_order_id','site_id','catalog_item_id']
    ELSE ARRAY['purchase_id','site_id','catalog_item_id','quantity','unit_cost','subtotal'] END;
  IF TG_OP='UPDATE' THEN
    FOREACH field IN ARRAY relevant LOOP
      changed := changed OR (to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field);
    END LOOP;
    IF NOT changed THEN RETURN NEW; END IF;
  END IF;
  versions := CASE TG_OP WHEN 'INSERT' THEN ARRAY[to_jsonb(NEW)] WHEN 'DELETE' THEN ARRAY[to_jsonb(OLD)]
    ELSE ARRAY[to_jsonb(OLD),to_jsonb(NEW)] END;
  FOREACH child_row IN ARRAY versions LOOP
    source_site := (child_row->>'site_id')::uuid;
    IF TG_TABLE_NAME='purchase_items' THEN
      UPDATE public.purchases SET updated_at=clock_timestamp(),
        accounting_state=CASE WHEN accounting_state='unpublished' THEN 'unpublished' ELSE 'pending' END
        WHERE id=(child_row->>'purchase_id')::uuid AND site_id=source_site;
    ELSE
      IF TG_TABLE_NAME='sale_orders' THEN source_id := (child_row->>'sale_id')::uuid;
      ELSE SELECT sale_id INTO source_id FROM public.sale_orders WHERE id=(child_row->>'sale_order_id')::uuid AND site_id=source_site;
      END IF;
      UPDATE public.sales SET updated_at=clock_timestamp(),
        accounting_state=CASE WHEN accounting_state='unpublished' THEN 'unpublished' ELSE 'pending' END
        WHERE id=source_id AND site_id=source_site;
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_touch_source_from_child() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
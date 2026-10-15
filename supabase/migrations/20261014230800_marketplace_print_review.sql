BEGIN;
CREATE OR REPLACE FUNCTION public.guard_marketplace_native_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE row_data jsonb; protected boolean := false;
BEGIN
  IF public.marketplace_is_backend() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- The printer owns only its local bounded acknowledgement. No provider state,
  -- quantities, prices, modifiers or other metadata may change in this exception.
  IF TG_TABLE_NAME = 'sale_order_items' AND TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW)-'metadata') = (to_jsonb(OLD)-'metadata')
      AND (coalesce(to_jsonb(NEW)->'metadata','{}'::jsonb)-'printed_quantity')
        = (coalesce(to_jsonb(OLD)->'metadata','{}'::jsonb)-'printed_quantity')
      AND jsonb_typeof(to_jsonb(NEW)#>'{metadata,printed_quantity}') = 'number'
      AND (to_jsonb(NEW)#>>'{metadata,printed_quantity}')::numeric BETWEEN 0 AND (to_jsonb(NEW)->>'quantity')::numeric
      AND public.user_can((to_jsonb(NEW)->>'site_id')::uuid,'update')
      AND EXISTS (SELECT 1 FROM public.sale_orders WHERE id = (to_jsonb(NEW)->>'sale_order_id')::uuid
        AND marketplace_integration_id IS NOT NULL AND (metadata#>>'{marketplace,state}' IN ('accepted','ready','completed')
          OR (metadata#>>'{marketplace,state}' = 'cancelled' AND (to_jsonb(NEW)#>>'{metadata,printed_quantity}')::numeric = 0))
        AND metadata#>>'{marketplace,sync_status}' = 'confirmed'
        AND coalesce(metadata#>>'{marketplace,operation,status}','confirmed') NOT IN ('pending','unknown')) THEN
      RETURN NEW;
    END IF;
  END IF;
  -- Check both images: unlinking/reparenting must not bypass provider ownership.
  FOR row_data IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE '{}'::jsonb END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END
  )) LOOP
    protected := protected OR row_data->>'marketplace_integration_id' IS NOT NULL
      OR row_data#>'{metadata,marketplace}' IS NOT NULL
      OR row_data#>'{payment_details,marketplace}' IS NOT NULL;
    IF TG_TABLE_NAME = 'site_secrets' THEN
      protected := protected OR coalesce(row_data->>'use_case','') LIKE 'marketplace:%'
        OR coalesce(row_data->>'provider','') IN ('uber_eats','rappi');
    END IF;
    IF row_data->>'sale_order_id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.sale_orders
        WHERE id = (row_data->>'sale_order_id')::uuid AND marketplace_integration_id IS NOT NULL);
    END IF;
    IF row_data->>'sale_order_item_id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.sale_order_items i
        JOIN public.sale_orders o ON o.id = i.sale_order_id
        WHERE i.id = (row_data->>'sale_order_item_id')::uuid AND o.marketplace_integration_id IS NOT NULL);
    END IF;
    IF TG_TABLE_NAME = 'sales' AND row_data->>'id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.sale_orders
        WHERE sale_id = (row_data->>'id')::uuid AND marketplace_integration_id IS NOT NULL);
    END IF;
    IF row_data->>'shipment_id' IS NOT NULL THEN
      protected := protected OR EXISTS (SELECT 1 FROM public.shipments
        WHERE id = (row_data->>'shipment_id')::uuid AND marketplace_integration_id IS NOT NULL);
    END IF;
  END LOOP;
  IF protected THEN RAISE EXCEPTION 'Marketplace records are provider-owned' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_marketplace_native_write() FROM PUBLIC, anon, authenticated;
COMMIT;

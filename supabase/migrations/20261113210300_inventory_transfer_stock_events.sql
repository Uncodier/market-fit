BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.inventory_transfer_stock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL, order_id uuid NOT NULL,
  line_id uuid NOT NULL REFERENCES public.inventory_transfer_lines(id),
  request_id uuid NOT NULL, actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('dispatch','receive','return','writeoff')),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id), item_name text NOT NULL,
  location_id uuid REFERENCES public.locations(id), location_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity<>0 AND abs(quantity)<=1000000000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(site_id,order_id) REFERENCES public.inventory_transfer_orders(site_id,id),
  UNIQUE(site_id,request_id,line_id,action),
  CHECK ((action IN ('dispatch','writeoff') AND quantity<0) OR (action IN ('receive','return') AND quantity>0)),
  CHECK ((action='writeoff' AND location_id IS NULL AND location_name='In transit')
    OR (action<>'writeoff' AND location_id IS NOT NULL))
);
CREATE INDEX inventory_transfer_stock_events_site_created ON public.inventory_transfer_stock_events(site_id,created_at DESC);
CREATE INDEX inventory_transfer_stock_events_order ON public.inventory_transfer_stock_events(order_id);
ALTER TABLE public.inventory_transfer_stock_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_transfer_stock_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.inventory_transfer_stock_events TO authenticated;
CREATE POLICY inventory_transfer_stock_events_read ON public.inventory_transfer_stock_events FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.inventory_transfer_orders o WHERE o.id=order_id AND o.site_id=inventory_transfer_stock_events.site_id));
CREATE TRIGGER inventory_transfer_stock_events_immutable BEFORE UPDATE OR DELETE ON public.inventory_transfer_stock_events
  FOR EACH ROW EXECUTE FUNCTION public.inventory_transfer_event_immutable();

-- Projection only: stock was already atomically changed by the lifecycle RPC.
-- Use the immutable event snapshot, not mutable current names or quantities.
CREATE FUNCTION public.inventory_transfer_project_stock_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE entry jsonb; item jsonb; doc jsonb; effect record;
BEGIN
  IF NEW.action NOT IN ('dispatch','receive','reconcile') THEN RETURN NEW; END IF;
  doc := NEW.snapshot->'order';
  FOR entry IN SELECT value FROM jsonb_array_elements(NEW.payload->'lines') LOOP
    SELECT value INTO STRICT item FROM jsonb_array_elements(NEW.snapshot->'lines') WHERE value->>'id'=entry->>'lineId';
    FOR effect IN
      SELECT 'dispatch'::text AS action,-(entry->>'quantity')::numeric AS quantity,
        (doc->>'from_location_id')::uuid AS location_id,doc->>'from_location_name' AS location_name WHERE NEW.action='dispatch'
      UNION ALL SELECT 'receive',(entry->>'quantity')::numeric,(doc->>'to_location_id')::uuid,doc->>'to_location_name' WHERE NEW.action='receive'
      UNION ALL SELECT 'return',coalesce((entry->>'returnedQuantity')::numeric,0),(doc->>'from_location_id')::uuid,
        doc->>'from_location_name' WHERE NEW.action='reconcile'
      UNION ALL SELECT 'writeoff',-coalesce((entry->>'writtenOffQuantity')::numeric,0),NULL::uuid,'In transit' WHERE NEW.action='reconcile'
    LOOP
      IF effect.quantity<>0 THEN
        INSERT INTO public.inventory_transfer_stock_events(site_id,order_id,line_id,request_id,actor_id,action,
          catalog_item_id,item_name,location_id,location_name,quantity,created_at)
          VALUES(NEW.site_id,NEW.order_id,(item->>'id')::uuid,NEW.request_id,NEW.actor_id,effect.action,
            (item->>'catalog_item_id')::uuid,item->>'item_name',effect.location_id,effect.location_name,effect.quantity,NEW.created_at);
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_project_stock_event() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inventory_transfer_project_stock_event AFTER INSERT ON public.inventory_transfer_events
  FOR EACH ROW EXECUTE FUNCTION public.inventory_transfer_project_stock_event();
COMMIT;
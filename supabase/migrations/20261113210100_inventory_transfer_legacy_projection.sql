BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.inventory_transfer_orders ADD COLUMN legacy_request_id uuid;
ALTER TABLE public.inventory_movements ADD COLUMN transfer_order_id uuid REFERENCES public.inventory_transfer_orders(id);
-- A legacy request can contain several routes and receiving responsibilities.
-- Keep each coherent document separate rather than discard those snapshots.
CREATE UNIQUE INDEX inventory_transfer_legacy_group ON public.inventory_transfer_orders
  (site_id,legacy_request_id,from_location_id,to_location_id,receiving_user_id) NULLS NOT DISTINCT
  WHERE legacy_request_id IS NOT NULL;

CREATE FUNCTION public.inventory_transfer_project_legacy(p_movement_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE movement public.inventory_movements%ROWTYPE; projected uuid;
BEGIN
  SELECT * INTO movement FROM public.inventory_movements WHERE id=p_movement_id;
  IF NOT FOUND OR movement.kind<>'transfer' THEN RETURN NULL; END IF;
  IF movement.transfer_order_id IS NOT NULL THEN RETURN movement.transfer_order_id; END IF;
  INSERT INTO public.inventory_transfer_orders(site_id,status,from_location_id,to_location_id,from_location_name,to_location_name,
    requested_by,receiving_user_id,receiving_user_name,notes,created_at,updated_at,requested_at,approved_at,dispatched_at,received_at,legacy_request_id)
    VALUES(movement.site_id,'received',movement.from_location_id,movement.to_location_id,movement.from_location_name,movement.to_location_name,
      movement.actor_id,movement.receiving_user_id,movement.receiving_user_name,movement.notes,movement.created_at,movement.created_at,
      movement.created_at,movement.created_at,movement.created_at,movement.created_at,movement.request_id)
    ON CONFLICT (site_id,legacy_request_id,from_location_id,to_location_id,receiving_user_id)
      WHERE legacy_request_id IS NOT NULL DO NOTHING;
  SELECT id INTO projected FROM public.inventory_transfer_orders WHERE site_id=movement.site_id
    AND legacy_request_id=movement.request_id AND from_location_id=movement.from_location_id AND to_location_id=movement.to_location_id
    AND receiving_user_id IS NOT DISTINCT FROM movement.receiving_user_id FOR UPDATE;
  -- One line per movement preserves the original positive quantity bounds,
  -- names and individual notes without aggregating away legacy history.
  INSERT INTO public.inventory_transfer_lines(order_id,site_id,catalog_item_id,item_name,requested_quantity,
    dispatched_quantity,received_quantity,discrepancy_notes,created_at,updated_at)
    VALUES(projected,movement.site_id,movement.catalog_item_id,movement.item_name,movement.quantity,
      movement.quantity,movement.quantity,movement.notes,movement.created_at,movement.created_at);
  UPDATE public.inventory_movements SET transfer_order_id=projected WHERE id=movement.id;
  INSERT INTO public.inventory_transfer_events(site_id,order_id,request_id,actor_id,action,payload,snapshot,created_at)
    SELECT movement.site_id,projected,movement.request_id,movement.actor_id,'legacy_transfer',to_jsonb(movement),
      jsonb_build_object('order',to_jsonb(o),'lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
        FROM public.inventory_transfer_lines l WHERE l.order_id=projected)),movement.created_at
    FROM public.inventory_transfer_orders o WHERE id=projected;
  RETURN projected;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_project_legacy(uuid) FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE movement_id uuid;
BEGIN
  FOR movement_id IN SELECT id FROM public.inventory_movements WHERE kind='transfer' ORDER BY created_at,id LOOP
    PERFORM public.inventory_transfer_project_legacy(movement_id);
  END LOOP;
END;
$$;
CREATE FUNCTION public.inventory_transfer_legacy_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF NEW.kind='transfer' THEN PERFORM public.inventory_transfer_project_legacy(NEW.id); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_legacy_insert() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inventory_transfer_legacy_insert AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.inventory_transfer_legacy_insert();
COMMIT;
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.inventory_transfer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  status text NOT NULL CHECK (status IN ('draft','requested','approved','in_transit','partially_received','received','cancelled')),
  from_location_id uuid NOT NULL REFERENCES public.locations(id),
  to_location_id uuid NOT NULL REFERENCES public.locations(id),
  from_location_name text NOT NULL,
  to_location_name text NOT NULL,
  requested_by uuid NOT NULL,
  receiving_user_id uuid,
  receiving_user_name text,
  notes text CHECK (length(notes)<=1000),
  revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  requested_at timestamptz, approved_at timestamptz, dispatched_at timestamptz,
  received_at timestamptz, cancelled_at timestamptz,
  UNIQUE(site_id,id), CHECK (from_location_id<>to_location_id)
);
CREATE TABLE public.inventory_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id),
  item_name text NOT NULL,
  requested_quantity numeric NOT NULL CHECK (requested_quantity>0 AND requested_quantity<=1000000000),
  dispatched_quantity numeric NOT NULL DEFAULT 0 CHECK (dispatched_quantity>=0),
  received_quantity numeric NOT NULL DEFAULT 0 CHECK (received_quantity>=0),
  returned_quantity numeric NOT NULL DEFAULT 0 CHECK (returned_quantity>=0),
  written_off_quantity numeric NOT NULL DEFAULT 0 CHECK (written_off_quantity>=0),
  discrepancy_notes text CHECK (length(discrepancy_notes)<=1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(site_id,order_id) REFERENCES public.inventory_transfer_orders(site_id,id),
  CHECK (received_quantity+returned_quantity+written_off_quantity<=dispatched_quantity
    AND dispatched_quantity<=requested_quantity),
  CHECK (requested_quantity::text NOT IN ('NaN','Infinity','-Infinity'))
);
CREATE TABLE public.inventory_transfer_requests (
  site_id uuid NOT NULL REFERENCES public.sites(id), request_id uuid NOT NULL,
  actor_id uuid NOT NULL, payload jsonb NOT NULL, result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(site_id,request_id)
);
CREATE TABLE public.inventory_transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL, order_id uuid NOT NULL,
  request_id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL,
  payload jsonb NOT NULL, snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(site_id,order_id) REFERENCES public.inventory_transfer_orders(site_id,id)
);
CREATE INDEX inventory_transfer_orders_site_created ON public.inventory_transfer_orders(site_id,created_at DESC);
CREATE INDEX inventory_transfer_lines_order ON public.inventory_transfer_lines(order_id);
CREATE INDEX inventory_transfer_events_order ON public.inventory_transfer_events(order_id,created_at);
ALTER TABLE public.inventory_transfer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_transfer_orders,public.inventory_transfer_lines,
  public.inventory_transfer_requests,public.inventory_transfer_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.inventory_transfer_orders,public.inventory_transfer_lines,public.inventory_transfer_events TO authenticated;
CREATE POLICY inventory_transfer_orders_read ON public.inventory_transfer_orders FOR SELECT TO authenticated
  USING (coalesce(public.user_can(site_id,'select'),false)
    AND coalesce(public.user_can_access_location(site_id,from_location_id),false)
    AND coalesce(public.user_can_access_location(site_id,to_location_id),false));
CREATE POLICY inventory_transfer_lines_read ON public.inventory_transfer_lines FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.inventory_transfer_orders o WHERE o.id=order_id AND o.site_id=inventory_transfer_lines.site_id));
CREATE POLICY inventory_transfer_events_read ON public.inventory_transfer_events FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.inventory_transfer_orders o WHERE o.id=order_id AND o.site_id=inventory_transfer_events.site_id));

CREATE FUNCTION public.inventory_transfer_event_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'Transfer history is immutable' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER inventory_transfer_events_immutable BEFORE UPDATE OR DELETE ON public.inventory_transfer_events
  FOR EACH ROW EXECUTE FUNCTION public.inventory_transfer_event_immutable();
REVOKE ALL ON FUNCTION public.inventory_transfer_event_immutable() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.inventory_transfer_line_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF ROW(NEW.id,NEW.order_id,NEW.site_id,NEW.catalog_item_id,NEW.item_name,NEW.requested_quantity)
      IS DISTINCT FROM ROW(OLD.id,OLD.order_id,OLD.site_id,OLD.catalog_item_id,OLD.item_name,OLD.requested_quantity)
    OR NEW.received_quantity<OLD.received_quantity OR NEW.returned_quantity<OLD.returned_quantity
    OR NEW.written_off_quantity<OLD.written_off_quantity
    OR (OLD.dispatched_quantity>0 AND NEW.dispatched_quantity<>OLD.dispatched_quantity) THEN
    RAISE EXCEPTION 'Transfer line history is immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_transfer_line_guard BEFORE UPDATE ON public.inventory_transfer_lines
  FOR EACH ROW EXECUTE FUNCTION public.inventory_transfer_line_guard();
REVOKE ALL ON FUNCTION public.inventory_transfer_line_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.inventory_transfer_manager(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS(SELECT 1 FROM public.sites WHERE id=p_site_id AND user_id=auth.uid() AND archived_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.site_members WHERE site_id=p_site_id AND user_id=auth.uid()
      AND status='active' AND role IN ('owner','admin')
      AND NOT coalesce(license_suspended,false) AND NOT coalesce(manually_disabled,false));
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_manager(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Run after all waiting locks: no pre-wait permission snapshot authorizes writes.
CREATE FUNCTION public.inventory_transfer_authorize(p_site_id uuid,p_from uuid,p_to uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL OR current_setting('role',true) IS DISTINCT FROM 'authenticated'
    OR NOT coalesce(public.user_can(p_site_id,'update'),false)
    OR NOT coalesce(public.user_can_access_location(p_site_id,p_from),false)
    OR NOT coalesce(public.user_can_access_location(p_site_id,p_to),false) THEN
    RAISE EXCEPTION 'Transfer access denied' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_authorize(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.inventory_transfer_record(p_site_id uuid,p_order_id uuid,p_request_id uuid,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE response jsonb;
BEGIN
  INSERT INTO public.inventory_transfer_events(site_id,order_id,request_id,actor_id,action,payload,snapshot)
    SELECT p_site_id,p_order_id,p_request_id,auth.uid(),p_action,p_input,
      jsonb_build_object('order',to_jsonb(o),'lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
        FROM public.inventory_transfer_lines l WHERE l.order_id=o.id))
    FROM public.inventory_transfer_orders o WHERE o.id=p_order_id AND o.site_id=p_site_id;
  response := jsonb_build_object('success',true,'orderId',p_order_id,'requestId',p_request_id,'alreadyApplied',false);
  UPDATE public.inventory_transfer_requests SET result=response WHERE site_id=p_site_id AND request_id=p_request_id;
  RETURN response;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_record(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.create_inventory_transfer_order(p_site_id uuid,p_request_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE prior public.inventory_transfer_requests%ROWTYPE; new_order_id uuid := gen_random_uuid();
  source_id uuid; target_id uuid; receiver uuid; receiver_name text; source_name text; target_name text;
  item jsonb; item_id uuid; item_label text; qty numeric; payload jsonb;
BEGIN
  IF p_site_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR p_input - ARRAY['items','fromLocationId','toLocationId','receivingUserId','notes','status'] <> '{}'::jsonb
    OR jsonb_typeof(p_input->'items') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_input->'fromLocationId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'toLocationId') IS DISTINCT FROM 'string'
    OR p_input->>'status' IS NULL OR p_input->>'status' NOT IN ('draft','requested')
    OR (p_input ? 'notes' AND (jsonb_typeof(p_input->'notes') IS DISTINCT FROM 'string' OR length(p_input->>'notes')>1000))
    OR (p_input ? 'receivingUserId' AND jsonb_typeof(p_input->'receivingUserId') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Invalid transfer input' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_input->'items') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid transfer items' USING ERRCODE='22023';
  END IF;
  source_id := (p_input->>'fromLocationId')::uuid; target_id := (p_input->>'toLocationId')::uuid;
  receiver := (p_input->>'receivingUserId')::uuid;
  PERFORM public.lock_site_license(p_site_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('transfer:'||p_site_id||':'||p_request_id,0));
  PERFORM public.inventory_transfer_authorize(p_site_id,source_id,target_id);
  payload := jsonb_build_object('operation','create','input',p_input);
  SELECT * INTO prior FROM public.inventory_transfer_requests WHERE site_id=p_site_id AND request_id=p_request_id;
  IF FOUND THEN
    IF prior.actor_id<>auth.uid() OR prior.payload<>payload THEN RAISE EXCEPTION 'Request ID conflict' USING ERRCODE='23505'; END IF;
    RETURN prior.result || jsonb_build_object('alreadyApplied',true);
  END IF;
  SELECT name INTO source_name FROM public.locations WHERE id=source_id AND site_id=p_site_id AND is_active FOR SHARE;
  SELECT name INTO target_name FROM public.locations WHERE id=target_id AND site_id=p_site_id AND is_active FOR SHARE;
  IF source_name IS NULL OR target_name IS NULL OR source_id=target_id THEN
    RAISE EXCEPTION 'Invalid transfer locations' USING ERRCODE='22023';
  END IF;
  receiver_name := public.inventory_receiver_name(p_site_id,receiver,target_id);
  INSERT INTO public.inventory_transfer_requests(site_id,request_id,actor_id,payload) VALUES(p_site_id,p_request_id,auth.uid(),payload);
  INSERT INTO public.inventory_transfer_orders(id,site_id,status,from_location_id,to_location_id,from_location_name,to_location_name,
    requested_by,receiving_user_id,receiving_user_name,notes,requested_at)
    VALUES(new_order_id,p_site_id,p_input->>'status',source_id,target_id,source_name,target_name,auth.uid(),receiver,receiver_name,
      p_input->>'notes',CASE WHEN p_input->>'status'='requested' THEN clock_timestamp() END);
  FOR item IN SELECT value FROM jsonb_array_elements(p_input->'items') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR item - ARRAY['catalogItemId','quantity'] <> '{}'::jsonb
      OR jsonb_typeof(item->'catalogItemId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Invalid transfer item' USING ERRCODE='22023';
    END IF;
    item_id := (item->>'catalogItemId')::uuid; qty := (item->>'quantity')::numeric;
    IF qty<=0 OR qty>1000000000 THEN RAISE EXCEPTION 'Invalid transfer quantity' USING ERRCODE='22023'; END IF;
    SELECT name INTO item_label FROM public.catalog_items WHERE id=item_id AND site_id=p_site_id AND kind='product' FOR SHARE;
    IF item_label IS NULL THEN RAISE EXCEPTION 'Invalid transfer product' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.inventory_transfer_lines WHERE order_id=new_order_id
      AND catalog_item_id=item_id) THEN RAISE EXCEPTION 'Duplicate transfer product' USING ERRCODE='22023'; END IF;
    INSERT INTO public.inventory_transfer_lines(order_id,site_id,catalog_item_id,item_name,requested_quantity)
      VALUES(new_order_id,p_site_id,item_id,item_label,qty);
  END LOOP;
  RETURN public.inventory_transfer_record(p_site_id,new_order_id,p_request_id,'create',p_input);
END;
$$;
REVOKE ALL ON FUNCTION public.create_inventory_transfer_order(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_inventory_transfer_order(uuid,uuid,jsonb) TO authenticated;

CREATE FUNCTION public.transition_inventory_transfer_order(p_site_id uuid,p_order_id uuid,p_request_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE doc public.inventory_transfer_orders%ROWTYPE; prior public.inventory_transfer_requests%ROWTYPE;
  line public.inventory_transfer_lines%ROWTYPE; entry jsonb; act text; payload jsonb; next_status text;
  qty numeric; returned numeric; written_off numeric; seen uuid[] := ARRAY[]::uuid[]; manager boolean;
BEGIN
  IF p_site_id IS NULL OR p_order_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR p_input - ARRAY['action','revision','lines','notes'] <> '{}'::jsonb
    OR jsonb_typeof(p_input->'action') IS DISTINCT FROM 'string'
    OR p_input->>'action' NOT IN ('request','approve','cancel','dispatch','receive','reconcile')
    OR jsonb_typeof(p_input->'revision') IS DISTINCT FROM 'number'
    OR (p_input->>'revision') !~ '^[0-9]+$'
    OR (p_input ? 'notes' AND (jsonb_typeof(p_input->'notes') IS DISTINCT FROM 'string' OR length(p_input->>'notes')>1000)) THEN
    RAISE EXCEPTION 'Invalid transfer transition' USING ERRCODE='22023';
  END IF;
  act := p_input->>'action';
  PERFORM public.lock_site_license(p_site_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('transfer:'||p_site_id||':'||p_request_id,0));
  SELECT * INTO doc FROM public.inventory_transfer_orders WHERE id=p_order_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer access denied' USING ERRCODE='42501'; END IF;
  PERFORM public.inventory_transfer_authorize(p_site_id,doc.from_location_id,doc.to_location_id);
  manager := public.inventory_transfer_manager(p_site_id);
  IF (act IN ('approve','reconcile') AND NOT manager)
    OR (act='receive' AND NOT manager AND doc.receiving_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Transfer responsibility denied' USING ERRCODE='42501';
  END IF;
  payload := jsonb_build_object('operation','transition','orderId',p_order_id,'input',p_input);
  SELECT * INTO prior FROM public.inventory_transfer_requests WHERE site_id=p_site_id AND request_id=p_request_id;
  IF FOUND THEN
    IF prior.actor_id<>auth.uid() OR prior.payload<>payload THEN RAISE EXCEPTION 'Request ID conflict' USING ERRCODE='23505'; END IF;
    RETURN prior.result || jsonb_build_object('alreadyApplied',true);
  END IF;
  IF doc.revision<>(p_input->>'revision')::integer THEN RAISE EXCEPTION 'Transfer revision conflict' USING ERRCODE='40001'; END IF;
  IF (act='request' AND doc.status<>'draft') OR (act='approve' AND doc.status<>'requested')
    OR (act='cancel' AND doc.status NOT IN ('draft','requested','approved'))
    OR (act='dispatch' AND doc.status<>'approved')
    OR (act IN ('receive','reconcile') AND doc.status NOT IN ('in_transit','partially_received')) THEN
    RAISE EXCEPTION 'Invalid transfer state' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.inventory_transfer_requests(site_id,request_id,actor_id,payload) VALUES(p_site_id,p_request_id,auth.uid(),payload);
  IF act IN ('dispatch','receive','reconcile') THEN
    IF jsonb_typeof(p_input->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Transfer lines required' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(p_input->'lines') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid transfer lines' USING ERRCODE='22023'; END IF;
    -- Share the sorted product locking order with legacy batches and commerce.
    PERFORM 1 FROM public.catalog_items WHERE site_id=p_site_id AND id IN (
      SELECT catalog_item_id FROM public.inventory_transfer_lines WHERE order_id=p_order_id) ORDER BY id FOR UPDATE;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_input->'lines') LOOP
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'lineId') IS DISTINCT FROM 'string'
        OR entry - ARRAY['lineId','quantity','returnedQuantity','writtenOffQuantity','notes'] <> '{}'::jsonb
        OR (entry ? 'notes' AND (jsonb_typeof(entry->'notes') IS DISTINCT FROM 'string' OR length(entry->>'notes')>1000)) THEN
        RAISE EXCEPTION 'Invalid transfer line' USING ERRCODE='22023';
      END IF;
      SELECT * INTO line FROM public.inventory_transfer_lines WHERE id=(entry->>'lineId')::uuid AND order_id=p_order_id FOR UPDATE;
      IF NOT FOUND OR line.id=ANY(seen) THEN RAISE EXCEPTION 'Invalid or duplicate transfer line' USING ERRCODE='22023'; END IF;
      seen := array_append(seen,line.id);
      IF act IN ('dispatch','receive') THEN
        IF jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number' OR entry ?| ARRAY['returnedQuantity','writtenOffQuantity']
          OR entry ? 'notes' THEN RAISE EXCEPTION 'Invalid transfer quantity' USING ERRCODE='22023'; END IF;
        qty := (entry->>'quantity')::numeric;
        IF qty<=0 OR qty>1000000000 THEN RAISE EXCEPTION 'Invalid transfer quantity' USING ERRCODE='22023'; END IF;
        IF act='dispatch' THEN
          IF qty>line.requested_quantity THEN RAISE EXCEPTION 'Dispatch exceeds request' USING ERRCODE='22023'; END IF;
          PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.from_location_id,-qty,false);
          UPDATE public.inventory_transfer_lines SET dispatched_quantity=qty,updated_at=clock_timestamp() WHERE id=line.id;
        ELSE
          IF qty>line.dispatched_quantity-line.received_quantity-line.returned_quantity-line.written_off_quantity THEN
            RAISE EXCEPTION 'Receipt exceeds remaining quantity' USING ERRCODE='22023';
          END IF;
          PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.to_location_id,qty,false);
          UPDATE public.inventory_transfer_lines SET received_quantity=received_quantity+qty,updated_at=clock_timestamp() WHERE id=line.id;
        END IF;
      ELSE
        IF entry ? 'quantity' OR (entry ? 'returnedQuantity' AND jsonb_typeof(entry->'returnedQuantity') IS DISTINCT FROM 'number')
          OR (entry ? 'writtenOffQuantity' AND jsonb_typeof(entry->'writtenOffQuantity') IS DISTINCT FROM 'number') THEN
          RAISE EXCEPTION 'Invalid reconciliation quantity' USING ERRCODE='22023';
        END IF;
        returned := coalesce((entry->>'returnedQuantity')::numeric,0); written_off := coalesce((entry->>'writtenOffQuantity')::numeric,0);
        IF returned<0 OR written_off<0 OR returned+written_off<=0
          OR returned+written_off>line.dispatched_quantity-line.received_quantity-line.returned_quantity-line.written_off_quantity
          OR coalesce(length(trim(coalesce(entry->>'notes',p_input->>'notes'))),0)=0 THEN
          RAISE EXCEPTION 'Invalid reconciliation or missing writeoff notes' USING ERRCODE='22023';
        END IF;
        IF returned>0 THEN PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.from_location_id,returned,false); END IF;
        UPDATE public.inventory_transfer_lines SET returned_quantity=returned_quantity+returned,
          written_off_quantity=written_off_quantity+written_off,
          discrepancy_notes=coalesce(entry->>'notes',p_input->>'notes',discrepancy_notes),updated_at=clock_timestamp() WHERE id=line.id;
      END IF;
    END LOOP;
    IF act='dispatch' AND cardinality(seen)<>(SELECT count(*) FROM public.inventory_transfer_lines WHERE order_id=p_order_id) THEN
      RAISE EXCEPTION 'Dispatch must include every line' USING ERRCODE='22023';
    END IF;
    next_status := CASE WHEN act='dispatch' THEN 'in_transit'
      WHEN NOT EXISTS(SELECT 1 FROM public.inventory_transfer_lines WHERE order_id=p_order_id
        AND received_quantity+returned_quantity+written_off_quantity<dispatched_quantity) THEN 'received'
      WHEN EXISTS(SELECT 1 FROM public.inventory_transfer_lines WHERE order_id=p_order_id
        AND received_quantity+returned_quantity+written_off_quantity>0) THEN 'partially_received' ELSE 'in_transit' END;
  ELSE
    IF p_input ? 'lines' THEN RAISE EXCEPTION 'Unexpected transfer lines' USING ERRCODE='22023'; END IF;
    next_status := CASE act WHEN 'request' THEN 'requested' WHEN 'approve' THEN 'approved' WHEN 'cancel' THEN 'cancelled' END;
  END IF;
  UPDATE public.inventory_transfer_orders SET status=next_status,revision=revision+1,updated_at=clock_timestamp(),
    notes=coalesce(p_input->>'notes',notes),
    requested_at=CASE WHEN act='request' THEN clock_timestamp() ELSE requested_at END,
    approved_at=CASE WHEN act='approve' THEN clock_timestamp() ELSE approved_at END,
    dispatched_at=CASE WHEN act='dispatch' THEN clock_timestamp() ELSE dispatched_at END,
    received_at=CASE WHEN next_status='received' THEN clock_timestamp() ELSE received_at END,
    cancelled_at=CASE WHEN act='cancel' THEN clock_timestamp() ELSE cancelled_at END
    WHERE id=p_order_id AND site_id=p_site_id;
  RETURN public.inventory_transfer_record(p_site_id,p_order_id,p_request_id,act,p_input);
END;
$$;
REVOKE ALL ON FUNCTION public.transition_inventory_transfer_order(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_inventory_transfer_order(uuid,uuid,uuid,jsonb) TO authenticated;
COMMIT;
BEGIN;

CREATE TABLE public.procurement_replenishment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  minimum numeric NOT NULL CHECK (minimum BETWEEN 0 AND 1000000),
  target numeric NOT NULL CHECK (target > minimum AND target <= 1000000),
  minimum_order integer NOT NULL CHECK (minimum_order BETWEEN 1 AND 1000000),
  order_multiple integer NOT NULL CHECK (order_multiple BETWEEN 1 AND 1000000),
  action text NOT NULL CHECK (action IN ('alert','draft')),
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL, updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(site_id,catalog_item_id,location_id), UNIQUE(site_id,id)
);

-- An incident is also the immutable provenance of its generated requisition.
-- Closing an incident never approves, cancels, orders or pays that requisition.
CREATE TABLE public.procurement_replenishment_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL,
  rule_id uuid NOT NULL, rule_version integer NOT NULL CHECK(rule_version > 0),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  request_id uuid UNIQUE,
  observed_quantity numeric NOT NULL CHECK(observed_quantity > '-Infinity'::numeric AND observed_quantity < 'Infinity'::numeric),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  action text NOT NULL CHECK(action IN ('alert','draft')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_by uuid, closed_at timestamptz, close_reason text,
  FOREIGN KEY(site_id,rule_id) REFERENCES public.procurement_replenishment_rules(site_id,id),
  FOREIGN KEY(site_id,request_id) REFERENCES public.procurement_requests(site_id,id),
  CHECK ((action='draft') = (request_id IS NOT NULL)),
  CHECK ((status='open' AND closed_by IS NULL AND closed_at IS NULL AND close_reason IS NULL)
    OR (status='closed' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND length(btrim(close_reason)) BETWEEN 1 AND 2000))
);
CREATE UNIQUE INDEX procurement_replenishment_open_case
  ON public.procurement_replenishment_cases(site_id,catalog_item_id,location_id) WHERE status='open';
CREATE INDEX procurement_replenishment_cases_history
  ON public.procurement_replenishment_cases(site_id,created_at DESC,id);

ALTER TABLE public.procurement_replenishment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_replenishment_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_replenishment_rules,public.procurement_replenishment_cases FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_replenishment_rules,public.procurement_replenishment_cases TO authenticated;
CREATE POLICY replenishment_rule_read ON public.procurement_replenishment_rules FOR SELECT TO authenticated
  USING(public.procurement_request_access(site_id) AND public.user_can(site_id,'select'));
CREATE POLICY replenishment_case_read ON public.procurement_replenishment_cases FOR SELECT TO authenticated
  USING(public.procurement_request_access(site_id) AND public.user_can(site_id,'select'));

-- The existing manual save RPC participates in duplicate serialization too.
-- Taking this lock before its header insert covers its later line inserts.
CREATE FUNCTION public.lock_procurement_replenishment_supply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_replenishment:'||NEW.site_id::text,0));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_procurement_replenishment_supply() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER replenishment_request_supply_lock BEFORE INSERT ON public.procurement_requests
  FOR EACH ROW EXECUTE FUNCTION public.lock_procurement_replenishment_supply();
-- Orders are optional in older installations; apply the same lock when present.
DO $$ BEGIN
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    CREATE TRIGGER replenishment_order_supply_lock BEFORE INSERT ON public.purchase_orders
      FOR EACH ROW EXECUTE FUNCTION public.lock_procurement_replenishment_supply();
  END IF;
END $$;

CREATE FUNCTION public.save_procurement_replenishment_rule(p_site uuid,p_id uuid,p_version integer,p_document jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.procurement_replenishment_rules; item uuid; location uuid;
  v_minimum numeric; v_target numeric; min_order numeric; multiple numeric;
BEGIN
  IF public.procurement_request_access(p_site) IS NOT TRUE OR public.user_can(p_site,'update') IS NOT TRUE THEN
    RAISE EXCEPTION 'Replenishment access denied' USING ERRCODE='42501'; END IF;
  IF p_document IS NULL OR jsonb_typeof(p_document)<>'object'
    OR p_document - ARRAY['name','catalog_item_id','location_id','minimum','target','minimum_order','order_multiple','action','enabled'] <> '{}'
    OR NOT p_document ?& ARRAY['name','catalog_item_id','location_id','minimum','target','minimum_order','order_multiple','action','enabled']
    OR jsonb_typeof(p_document->'name') IS DISTINCT FROM 'string'
    OR COALESCE(length(btrim(p_document->>'name')) NOT BETWEEN 1 AND 200,true)
    OR jsonb_typeof(p_document->'minimum') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'target') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'minimum_order') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'order_multiple') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_document->'enabled') IS DISTINCT FROM 'boolean'
    OR COALESCE(p_document->>'action' NOT IN ('alert','draft'),true)
  THEN RAISE EXCEPTION 'Invalid replenishment rule' USING ERRCODE='22023'; END IF;
  item := (p_document->>'catalog_item_id')::uuid; location := (p_document->>'location_id')::uuid;
  v_minimum := (p_document->>'minimum')::numeric; v_target := (p_document->>'target')::numeric;
  min_order := (p_document->>'minimum_order')::numeric; multiple := (p_document->>'order_multiple')::numeric;
  IF v_minimum NOT BETWEEN 0 AND 1000000 OR v_target <= v_minimum OR v_target > 1000000
    OR min_order NOT BETWEEN 1 AND 1000000 OR multiple NOT BETWEEN 1 AND 1000000
    OR trunc(min_order)<>min_order OR trunc(multiple)<>multiple THEN
    RAISE EXCEPTION 'Invalid replenishment quantities' USING ERRCODE='22023'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO r FROM public.procurement_replenishment_rules WHERE site_id=p_site AND id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rule not found' USING ERRCODE='42501'; END IF;
    IF r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='40001'; END IF;
    IF r.catalog_item_id IS DISTINCT FROM item OR r.location_id IS DISTINCT FROM location THEN
      RAISE EXCEPTION 'Rule item and location are immutable' USING ERRCODE='22023'; END IF;
  ELSIF p_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='40001'; END IF;
  PERFORM 1 FROM public.catalog_items WHERE id=item AND site_id=p_site
    AND status='active' AND procurement_enabled AND track_inventory FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item unavailable' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.locations WHERE id=location AND site_id=p_site AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location unavailable' USING ERRCODE='22023'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.procurement_replenishment_rules(site_id,name,catalog_item_id,location_id,minimum,target,
      minimum_order,order_multiple,action,enabled,created_by,updated_by)
    VALUES(p_site,btrim(p_document->>'name'),item,location,v_minimum,v_target,min_order,multiple,p_document->>'action',(p_document->>'enabled')::boolean,auth.uid(),auth.uid())
    RETURNING id INTO p_id;
  ELSE
    UPDATE public.procurement_replenishment_rules SET name=btrim(p_document->>'name'),minimum=v_minimum,target=v_target,minimum_order=min_order,
      order_multiple=multiple,action=p_document->>'action',enabled=(p_document->>'enabled')::boolean,
      version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=p_id;
  END IF;
  RETURN p_id;
END $$;

CREATE FUNCTION public.close_procurement_replenishment_case(p_site uuid,p_case uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.procurement_replenishment_cases;
BEGIN
  IF public.procurement_request_access(p_site) IS NOT TRUE OR public.user_can(p_site,'update') IS NOT TRUE THEN
    RAISE EXCEPTION 'Replenishment access denied' USING ERRCODE='42501'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Resolution reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO c FROM public.procurement_replenishment_cases WHERE site_id=p_site AND id=p_case;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.procurement_replenishment_rules WHERE id=c.rule_id FOR UPDATE;
  UPDATE public.procurement_replenishment_cases SET status='closed',closed_by=auth.uid(),closed_at=clock_timestamp(),close_reason=btrim(p_reason)
    WHERE id=c.id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Case already closed' USING ERRCODE='40001'; END IF;
  RETURN c.id;
END $$;

CREATE FUNCTION public.evaluate_procurement_replenishment_rule(p_site uuid,p_rule uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.procurement_replenishment_rules; c public.procurement_replenishment_cases;
  stock public.inventory_levels; product record; amount numeric; request uuid; has_orders boolean;
BEGIN
  IF public.procurement_request_access(p_site) IS NOT TRUE OR public.user_can(p_site,'update') IS NOT TRUE THEN
    RAISE EXCEPTION 'Replenishment access denied' USING ERRCODE='42501'; END IF;
  -- Site-level serialization prevents cross-location evaluations racing unallocated supply.
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_replenishment:'||p_site::text,0));
  SELECT * INTO r FROM public.procurement_replenishment_rules WHERE site_id=p_site AND id=p_rule FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rule not found' USING ERRCODE='42501'; END IF;
  IF NOT r.enabled THEN RETURN jsonb_build_object('status','blocked','message','Rule is disabled'); END IF;
  SELECT id,name,currency INTO product FROM public.catalog_items WHERE id=r.catalog_item_id AND site_id=p_site
    AND status='active' AND procurement_enabled AND track_inventory FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','blocked','message','Inventory item unavailable'); END IF;
  PERFORM 1 FROM public.locations WHERE id=r.location_id AND site_id=p_site AND is_active FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','blocked','message','Location unavailable'); END IF;
  -- No reservation/incoming schema exists. Never fabricate a zero for an absent row.
  BEGIN
    SELECT * INTO STRICT stock FROM public.inventory_levels WHERE site_id=p_site
      AND catalog_item_id=r.catalog_item_id AND location_id=r.location_id FOR UPDATE;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RETURN jsonb_build_object('status','blocked','message','Inventory level is missing or ambiguous');
  END;
  IF stock.quantity IS NULL OR stock.quantity::text IN ('NaN','Infinity','-Infinity') THEN
    RETURN jsonb_build_object('status','blocked','message','Inventory quantity unavailable'); END IF;
  IF stock.quantity >= r.target THEN
    -- Recovered stock resolves alerts, not an outstanding purchase requisition:
    -- that stock may have arrived independently of the generated demand.
    UPDATE public.procurement_replenishment_cases SET status='closed',closed_by=auth.uid(),closed_at=clock_timestamp(),close_reason='Stock reached target'
      WHERE site_id=p_site AND catalog_item_id=r.catalog_item_id AND location_id=r.location_id AND status='open' AND action='alert';
  END IF;
  IF stock.quantity > r.minimum THEN
    RETURN jsonb_build_object('status','above_minimum','on_hand',stock.quantity); END IF;
  SELECT * INTO c FROM public.procurement_replenishment_cases WHERE site_id=p_site
    AND catalog_item_id=r.catalog_item_id AND location_id=r.location_id AND status='open';
  IF FOUND THEN RETURN jsonb_strip_nulls(jsonb_build_object('status',CASE WHEN c.action='alert' THEN 'alert' ELSE 'covered' END,
    'request_id',c.request_id,'quantity',c.quantity,'on_hand',stock.quantity,'message','An unresolved replenishment case already exists')); END IF;
  amount := ceil(greatest(r.target-stock.quantity,r.minimum_order::numeric)/r.order_multiple)*r.order_multiple;
  IF amount NOT BETWEEN 1 AND 1000000 THEN
    RETURN jsonb_build_object('status','blocked','on_hand',stock.quantity,'message','Required quantity exceeds the requisition limit'); END IF;
  -- Current revisions only. Requests have no location allocation: conservatively
  -- block any same-SKU supply not explicitly resolved by a replenishment manager.
  IF EXISTS(SELECT 1 FROM public.procurement_requests q JOIN public.procurement_request_items i
      ON i.request_id=q.id AND i.revision=q.revision
    WHERE q.site_id=p_site AND i.catalog_item_id=r.catalog_item_id AND q.status IN ('draft','submitted','returned','approved')
      AND NOT EXISTS(SELECT 1 FROM public.procurement_replenishment_cases resolved WHERE resolved.request_id=q.id AND resolved.status='closed')) THEN
    RETURN jsonb_build_object('status','covered','on_hand',stock.quantity,'message','An open requisition for this item has no resolved location allocation'); END IF;
  -- Procurement order/receipt relations may not be installed yet. Only known
  -- non-stock acceptances count here; they are never assigned to this location.
  IF to_regclass('public.purchase_orders') IS NOT NULL AND to_regclass('public.purchase_order_items') IS NOT NULL THEN
    IF to_regclass('public.procurement_receipt_items') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.purchase_orders o JOIN public.purchase_order_items i ON i.order_id=o.id
        WHERE o.site_id=$1 AND i.catalog_item_id=$2 AND i.quantity > COALESCE((SELECT sum(ri.quantity)
          FROM public.procurement_receipt_items ri WHERE ri.order_item_id=i.id),0))' INTO has_orders USING p_site,r.catalog_item_id;
    ELSE
      EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.purchase_orders o JOIN public.purchase_order_items i ON i.order_id=o.id
        WHERE o.site_id=$1 AND i.catalog_item_id=$2 AND i.quantity>0)' INTO has_orders USING p_site,r.catalog_item_id;
    END IF;
    IF has_orders THEN RETURN jsonb_build_object('status','covered','on_hand',stock.quantity,'message','An outstanding purchase order has no location allocation'); END IF;
  END IF;
  IF r.action='draft' THEN
    request := public.save_procurement_request(p_site,NULL,0,jsonb_build_object(
      'title',left('Replenishment: '||product.name,200),'description','Inventory replenishment. Review and submit through the normal approval workflow.',
      'currency',product.currency,'lines',jsonb_build_array(jsonb_build_object('catalog_item_id',r.catalog_item_id,'description','', 'quantity',amount::integer))));
  END IF;
  INSERT INTO public.procurement_replenishment_cases(site_id,rule_id,rule_version,catalog_item_id,location_id,request_id,observed_quantity,quantity,action,created_by)
    VALUES(p_site,r.id,r.version,r.catalog_item_id,r.location_id,request,stock.quantity,amount::integer,r.action,auth.uid());
  RETURN jsonb_strip_nulls(jsonb_build_object('status',CASE WHEN r.action='draft' THEN 'draft_created' ELSE 'alert' END,
    'request_id',request,'quantity',amount,'on_hand',stock.quantity));
END $$;

REVOKE ALL ON FUNCTION public.save_procurement_replenishment_rule(uuid,uuid,integer,jsonb),
  public.evaluate_procurement_replenishment_rule(uuid,uuid),public.close_procurement_replenishment_case(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_procurement_replenishment_rule(uuid,uuid,integer,jsonb),
  public.evaluate_procurement_replenishment_rule(uuid,uuid),public.close_procurement_replenishment_case(uuid,uuid,text) TO authenticated;

COMMIT;
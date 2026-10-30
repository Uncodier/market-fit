BEGIN;

-- Transactional outbox only: inventory writes never execute procurement work.
CREATE TABLE public.procurement_replenishment_queue (
  rule_id uuid PRIMARY KEY REFERENCES public.procurement_replenishment_rules(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  generation bigint NOT NULL DEFAULT 1 CHECK(generation>0),
  evaluated_generation bigint NOT NULL DEFAULT 0 CHECK(evaluated_generation>=0 AND evaluated_generation<=generation),
  last_result jsonb, last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), evaluated_at timestamptz
);
CREATE INDEX procurement_replenishment_queue_pending ON public.procurement_replenishment_queue(updated_at,rule_id)
  WHERE generation>evaluated_generation;
ALTER TABLE public.procurement_replenishment_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_replenishment_queue FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_replenishment_queue TO authenticated;
CREATE POLICY replenishment_queue_read ON public.procurement_replenishment_queue FOR SELECT TO authenticated
  USING(public.procurement_request_access(site_id) AND public.user_can(site_id,'select'));

CREATE FUNCTION public.enqueue_procurement_replenishment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME='procurement_replenishment_rules' THEN
    INSERT INTO public.procurement_replenishment_queue(rule_id,site_id) VALUES(NEW.id,NEW.site_id)
      ON CONFLICT(rule_id) DO UPDATE SET generation=procurement_replenishment_queue.generation+1,updated_at=clock_timestamp();
  ELSE
    IF TG_OP IN ('UPDATE','DELETE') THEN
      INSERT INTO public.procurement_replenishment_queue(rule_id,site_id)
        SELECT id,site_id FROM public.procurement_replenishment_rules WHERE enabled AND site_id=OLD.site_id
          AND catalog_item_id=OLD.catalog_item_id AND location_id=OLD.location_id
        ON CONFLICT(rule_id) DO UPDATE SET generation=procurement_replenishment_queue.generation+1,updated_at=clock_timestamp();
    END IF;
    IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND (NEW.site_id,NEW.catalog_item_id,NEW.location_id)
        IS DISTINCT FROM (OLD.site_id,OLD.catalog_item_id,OLD.location_id)) THEN
      INSERT INTO public.procurement_replenishment_queue(rule_id,site_id)
        SELECT id,site_id FROM public.procurement_replenishment_rules WHERE enabled AND site_id=NEW.site_id
          AND catalog_item_id=NEW.catalog_item_id AND location_id=NEW.location_id
        ON CONFLICT(rule_id) DO UPDATE SET generation=procurement_replenishment_queue.generation+1,updated_at=clock_timestamp();
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_procurement_replenishment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER replenishment_rule_enqueue AFTER INSERT OR UPDATE ON public.procurement_replenishment_rules
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_procurement_replenishment();
CREATE TRIGGER replenishment_inventory_enqueue AFTER INSERT OR DELETE OR UPDATE OF quantity,site_id,catalog_item_id,location_id
  ON public.inventory_levels FOR EACH ROW EXECUTE FUNCTION public.enqueue_procurement_replenishment();

CREATE FUNCTION public.process_procurement_replenishment(p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job record; actor uuid; result jsonb; claims text; processed integer:=0; failed integer:=0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Worker limit must be between 1 and 100' USING ERRCODE='22023'; END IF;
  -- Never lock queue rows while waiting on inventory: sales already hold inventory
  -- locks when enqueuing. A worker advisory lock avoids that inverse lock order.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('procurement_replenishment_worker',0)) THEN
    RETURN jsonb_build_object('processed',0,'failed',0,'busy',true); END IF;
  claims:=current_setting('request.jwt.claims',true);
  FOR job IN SELECT rule_id,site_id,generation FROM public.procurement_replenishment_queue
    WHERE generation>evaluated_generation ORDER BY updated_at,rule_id LIMIT p_limit LOOP
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended('procurement_replenishment:'||job.site_id::text,0));
      SELECT updated_by INTO STRICT actor FROM public.procurement_replenishment_rules WHERE id=job.rule_id FOR UPDATE;
      -- The original manager delegated only this saved rule, never arbitrary user
      -- actions. The evaluator rechecks current role, license, scope and user_can.
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
      result:=public.evaluate_procurement_replenishment_rule(job.site_id,job.rule_id);
      UPDATE public.procurement_replenishment_queue SET evaluated_generation=job.generation,
        last_result=result,last_error=NULL,evaluated_at=clock_timestamp() WHERE rule_id=job.rule_id;
      processed:=processed+1;
    EXCEPTION WHEN OTHERS THEN
      -- Consume this generation; a later stock/rule change re-enqueues. Persist
      -- failure without exposing raw database diagnostics or spinning forever.
      UPDATE public.procurement_replenishment_queue SET evaluated_generation=job.generation,last_result=NULL,
        last_error=CASE WHEN SQLSTATE='42501' THEN 'Rule manager is no longer authorized'
          ELSE 'Evaluation failed; review rule, stock and catalog before retrying' END,
        evaluated_at=clock_timestamp() WHERE rule_id=job.rule_id;
      failed:=failed+1;
    END;
    PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
  END LOOP;
  RETURN jsonb_build_object('processed',processed,'failed',failed,'busy',false);
END $$;
REVOKE ALL ON FUNCTION public.process_procurement_replenishment(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.process_procurement_replenishment(integer) TO service_role;

-- Existing enabled rules become pending when the worker is first installed.
INSERT INTO public.procurement_replenishment_queue(rule_id,site_id)
  SELECT id,site_id FROM public.procurement_replenishment_rules WHERE enabled;

COMMIT;
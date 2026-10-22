BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.is_self_service_order_items(p_items jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(p_items @> '[{"metadata":{"self_service":true}}]'::jsonb, false)
$$;

CREATE OR REPLACE FUNCTION public.guard_self_service_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE marked boolean; paid boolean;
BEGIN
  marked := public.is_self_service_order_items(NEW.items);
  IF TG_OP='UPDATE' AND marked AND NOT public.is_self_service_order_items(OLD.items) THEN
    RAISE EXCEPTION 'Existing orders cannot acquire a self-service marker' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_self_service_order_items(OLD.items) THEN
    IF NOT marked OR ROW(NEW.site_id,NEW.sale_id,NEW.origin_location_id)
      IS DISTINCT FROM ROW(OLD.site_id,OLD.sale_id,OLD.origin_location_id) THEN
      RAISE EXCEPTION 'Self-service marker and scope are immutable' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NOT marked THEN RETURN NEW; END IF;
  SELECT status = 'completed' AND amount_due >= 0 AND amount_due <= 0.009
    INTO paid FROM public.sales WHERE id=NEW.sale_id AND site_id=NEW.site_id FOR UPDATE;
  IF NEW.status NOT IN ('draft','pending','cancelled') AND paid IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Self-service order requires full payment' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_self_service_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE parent_order public.sale_orders%ROWTYPE; paid boolean;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.sale_order_id,NEW.site_id) IS DISTINCT FROM ROW(OLD.sale_order_id,OLD.site_id) THEN
    IF coalesce(OLD.metadata->'self_service','false') = 'true'::jsonb OR EXISTS (
      SELECT 1 FROM public.sale_orders WHERE id=OLD.sale_order_id AND public.is_self_service_order_items(items)
    ) THEN RAISE EXCEPTION 'Self-service line scope is immutable' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO parent_order FROM public.sale_orders WHERE id=NEW.sale_order_id FOR UPDATE;
  IF NOT public.is_self_service_order_items(parent_order.items) THEN RETURN NEW; END IF;
  IF NEW.status IS NULL THEN RAISE EXCEPTION 'Self-service line status is required' USING ERRCODE='22023'; END IF;
  IF NEW.site_id IS DISTINCT FROM parent_order.site_id THEN
    RAISE EXCEPTION 'Self-service line site mismatch' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND coalesce(OLD.metadata->'self_service','false')='true'::jsonb
    AND (NEW.metadata->'self_service' IS DISTINCT FROM 'true'::jsonb
      OR NEW.metadata->'self_service_location_id' IS DISTINCT FROM OLD.metadata->'self_service_location_id') THEN
    RAISE EXCEPTION 'Self-service line marker is immutable' USING ERRCODE='42501';
  END IF;
  NEW.metadata := coalesce(NEW.metadata,'{}') || jsonb_build_object(
    'self_service',true,'self_service_location_id',parent_order.origin_location_id);
  SELECT status='completed' AND amount_due >= 0 AND amount_due <= 0.009
    INTO paid FROM public.sales WHERE id=parent_order.sale_id AND site_id=parent_order.site_id FOR UPDATE;
  IF NEW.status NOT IN ('draft','cancelled') OR (NEW.sent_at IS NOT NULL AND NEW.status <> 'cancelled') THEN
    IF parent_order.status='cancelled' OR paid IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Self-service line requires full payment' USING ERRCODE='42501';
    END IF;
    NEW.sent_at := coalesce(NEW.sent_at,now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_self_service_unit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE line public.sale_order_items%ROWTYPE; parent_order public.sale_orders%ROWTYPE; paid boolean;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.sale_order_item_id,NEW.site_id) IS DISTINCT FROM ROW(OLD.sale_order_item_id,OLD.site_id) THEN
    IF EXISTS(SELECT 1 FROM public.sale_order_items i JOIN public.sale_orders o ON o.id=i.sale_order_id
      WHERE i.id=OLD.sale_order_item_id AND public.is_self_service_order_items(o.items)) THEN
      RAISE EXCEPTION 'Self-service unit scope is immutable' USING ERRCODE='42501';
    END IF;
  END IF;
  SELECT * INTO line FROM public.sale_order_items WHERE id=NEW.sale_order_item_id;
  SELECT * INTO parent_order FROM public.sale_orders WHERE id=line.sale_order_id FOR UPDATE;
  IF NOT public.is_self_service_order_items(parent_order.items) THEN RETURN NEW; END IF;
  IF NEW.site_id IS DISTINCT FROM parent_order.site_id THEN
    RAISE EXCEPTION 'Self-service unit site mismatch' USING ERRCODE='42501';
  END IF;
  IF NEW.status NOT IN ('draft','cancelled') THEN
    SELECT status='completed' AND amount_due >= 0 AND amount_due <= 0.009
      INTO paid FROM public.sales WHERE id=parent_order.sale_id AND site_id=parent_order.site_id FOR UPDATE;
    IF paid IS DISTINCT FROM true OR parent_order.status='cancelled' THEN
      RAISE EXCEPTION 'Self-service unit requires full payment' USING ERRCODE='42501';
    END IF;
    IF line.status IN ('draft','cancelled') OR line.sent_at IS NULL THEN
      RAISE EXCEPTION 'Self-service line must be released before unit preparation' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS self_service_order_guard ON public.sale_orders;
CREATE TRIGGER self_service_order_guard BEFORE INSERT OR UPDATE ON public.sale_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_service_order();
DROP TRIGGER IF EXISTS self_service_line_guard ON public.sale_order_items;
CREATE TRIGGER self_service_line_guard BEFORE INSERT OR UPDATE ON public.sale_order_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_service_line();
DROP TRIGGER IF EXISTS self_service_unit_guard ON public.sale_order_item_units;
CREATE TRIGGER self_service_unit_guard BEFORE INSERT OR UPDATE ON public.sale_order_item_units
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_service_unit();

REVOKE ALL ON FUNCTION public.guard_self_service_order(),public.guard_self_service_line(),
  public.guard_self_service_unit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.is_self_service_order_items(jsonb) FROM PUBLIC,anon,authenticated;

-- Stripe settlement changes an order to in_progress. This payment transition
-- must not prepare kitchen work or bypass the claimed inventory/release effect.
CREATE OR REPLACE FUNCTION public.sync_order_lines_from_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE line_status text;
BEGIN
  IF public.is_self_service_order_items(NEW.items) AND NEW.status IN ('pending','in_progress') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('pending','in_progress','completed','cancelled') THEN
    line_status := CASE NEW.status WHEN 'pending' THEN 'new' WHEN 'in_progress' THEN 'preparing' ELSE NEW.status END;
    UPDATE public.sale_order_items SET status=line_status
      WHERE site_id=NEW.site_id AND sale_order_id=NEW.id AND status IS DISTINCT FROM line_status;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_order_lines_from_order_status() FROM PUBLIC,anon,authenticated;

COMMIT;
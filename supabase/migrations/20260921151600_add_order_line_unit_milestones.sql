BEGIN;

ALTER TABLE public.sale_order_item_units
  ADD COLUMN IF NOT EXISTS in_progress_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

UPDATE public.sale_order_item_units
SET
  in_progress_at = CASE
    WHEN status IN (
      'preparing',
      'in_progress',
      'completed',
      'ready',
      'returned'
    ) THEN COALESCE(in_progress_at, started_at)
    ELSE in_progress_at
  END,
  ready_at = CASE
    WHEN status IN ('completed', 'ready', 'returned')
      THEN COALESCE(ready_at, completed_at, updated_at)
    ELSE ready_at
  END,
  completed_at = CASE
    WHEN status IN ('completed', 'ready', 'returned')
      THEN COALESCE(completed_at, ready_at, updated_at)
    ELSE completed_at
  END;

UPDATE public.sale_order_item_units AS unit
SET delivered_at = shipment.delivered_at
FROM public.shipments AS shipment
WHERE shipment.id = unit.shipment_id
  AND shipment.delivered_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_sale_order_item_unit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('draft', 'new', 'pending') THEN
      NEW.in_progress_at := NULL;
      NEW.ready_at := NULL;
      NEW.completed_at := NULL;
      NEW.delivered_at := NULL;
    ELSIF NEW.status IN ('preparing', 'in_progress') THEN
      NEW.in_progress_at := COALESCE(NEW.in_progress_at, now());
      NEW.ready_at := NULL;
      NEW.completed_at := NULL;
      NEW.delivered_at := NULL;
    ELSIF NEW.status IN ('completed', 'ready') THEN
      NEW.in_progress_at := COALESCE(NEW.in_progress_at, NEW.started_at);
      NEW.ready_at := COALESCE(NEW.ready_at, NEW.completed_at, now());
      NEW.completed_at := NEW.ready_at;
    ELSIF NEW.status = 'returned' THEN
      NEW.in_progress_at := COALESCE(NEW.in_progress_at, NEW.started_at);
      NEW.ready_at := COALESCE(NEW.ready_at, NEW.completed_at, now());
      NEW.completed_at := NEW.ready_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_sale_order_item_unit()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_sale_order_item_units_from_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  unit_count integer;
  unit_quantity numeric;
  status_changed boolean := true;
  shipment_delivered_at timestamptz;
BEGIN
  IF NEW.parent_sale_order_item_id IS NOT NULL OR NEW.quantity <= 0 THEN
    DELETE FROM public.sale_order_item_units
    WHERE sale_order_item_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    status_changed := NEW.status IS DISTINCT FROM OLD.status;
  END IF;

  IF NEW.shipment_id IS NOT NULL THEN
    SELECT delivered_at
    INTO shipment_delivered_at
    FROM public.shipments
    WHERE id = NEW.shipment_id;
  END IF;

  unit_count := CASE
    WHEN NEW.quantity = trunc(NEW.quantity)
      THEN GREATEST(1, NEW.quantity::integer)
    ELSE 1
  END;
  unit_quantity := CASE WHEN unit_count = 1 THEN NEW.quantity ELSE 1 END;

  INSERT INTO public.sale_order_item_units (
    site_id,
    sale_order_item_id,
    unit_index,
    quantity,
    status,
    shipment_id,
    started_at,
    in_progress_at,
    ready_at,
    completed_at,
    delivered_at,
    created_at,
    updated_at
  )
  SELECT
    NEW.site_id,
    NEW.id,
    generated_index,
    unit_quantity,
    NEW.status,
    NEW.shipment_id,
    COALESCE(NEW.sent_at, NEW.created_at),
    CASE
      WHEN NEW.status IN (
        'preparing',
        'in_progress',
        'completed',
        'ready',
        'returned'
      ) THEN COALESCE(NEW.sent_at, NEW.created_at)
      ELSE NULL
    END,
    CASE
      WHEN NEW.status IN ('completed', 'ready', 'returned') THEN now()
      ELSE NULL
    END,
    CASE
      WHEN NEW.status IN ('completed', 'ready', 'returned') THEN now()
      ELSE NULL
    END,
    shipment_delivered_at,
    NEW.created_at,
    now()
  FROM generate_series(1, unit_count) AS generated_index
  ON CONFLICT (sale_order_item_id, unit_index) DO NOTHING;

  UPDATE public.sale_order_item_units
  SET
    site_id = NEW.site_id,
    quantity = unit_quantity,
    shipment_id = NEW.shipment_id,
    delivered_at = shipment_delivered_at,
    started_at = COALESCE(NEW.sent_at, started_at, NEW.created_at),
    status = CASE WHEN status_changed THEN NEW.status ELSE status END
  WHERE sale_order_item_id = NEW.id
    AND unit_index <= unit_count;

  DELETE FROM public.sale_order_item_units
  WHERE sale_order_item_id = NEW.id
    AND unit_index > unit_count;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sale_order_item_units_from_line()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_sale_order_item_units_after_update
  ON public.sale_order_items;
CREATE TRIGGER sync_sale_order_item_units_after_update
AFTER UPDATE OF site_id, quantity, status, shipment_id, sent_at
ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_order_item_units_from_line();

CREATE OR REPLACE FUNCTION public.sync_order_line_unit_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.sale_order_item_units
  SET delivered_at = CASE
    WHEN NEW.status = 'delivered'
      THEN COALESCE(NEW.delivered_at, now())
    ELSE NEW.delivered_at
  END
  WHERE shipment_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_line_unit_delivery()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_order_line_unit_delivery_after_update
  ON public.shipments;
CREATE TRIGGER sync_order_line_unit_delivery_after_update
AFTER UPDATE OF status, delivered_at
ON public.shipments
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.delivered_at IS DISTINCT FROM NEW.delivered_at
)
EXECUTE FUNCTION public.sync_order_line_unit_delivery();

CREATE OR REPLACE FUNCTION public.sync_order_lines_from_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('completed', 'cancelled')
  THEN
    UPDATE public.sale_order_items
    SET status = NEW.status
    WHERE site_id = NEW.site_id
      AND sale_order_id = NEW.id
      AND status IS DISTINCT FROM NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_lines_from_order_status()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_order_lines_from_order_status_after_update
  ON public.sale_orders;
CREATE TRIGGER sync_order_lines_from_order_status_after_update
AFTER UPDATE OF status ON public.sale_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_lines_from_order_status();

COMMENT ON COLUMN public.sale_order_item_units.in_progress_at IS
  'When work began for this individual unit.';
COMMENT ON COLUMN public.sale_order_item_units.ready_at IS
  'When this individual unit became ready.';
COMMENT ON COLUMN public.sale_order_item_units.delivered_at IS
  'When the linked shipment delivered this individual unit.';

NOTIFY pgrst, 'reload schema';

COMMIT;

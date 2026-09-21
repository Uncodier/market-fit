BEGIN;

CREATE TABLE IF NOT EXISTS public.sale_order_item_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  sale_order_item_id uuid NOT NULL
    REFERENCES public.sale_order_items(id) ON DELETE CASCADE,
  unit_index integer NOT NULL CHECK (unit_index > 0),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'new',
      'pending',
      'preparing',
      'in_progress',
      'completed',
      'ready',
      'returned',
      'cancelled'
    )
  ),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_order_item_units_item_index_key
    UNIQUE (sale_order_item_id, unit_index)
);

CREATE INDEX IF NOT EXISTS sale_order_item_units_site_status_idx
  ON public.sale_order_item_units (site_id, status);

CREATE INDEX IF NOT EXISTS sale_order_item_units_site_assignee_idx
  ON public.sale_order_item_units (site_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

ALTER TABLE public.sale_order_item_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_order_item_units_unified
  ON public.sale_order_item_units;

CREATE POLICY sale_order_item_units_unified
  ON public.sale_order_item_units
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.sites AS site
      WHERE site.id = sale_order_item_units.site_id
        AND (
          site.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.site_members AS member
            WHERE member.site_id = site.id
              AND member.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    (
      current_setting('role', true) = 'service_role'
      OR (auth.jwt() ->> 'role') = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM public.sites AS site
        WHERE site.id = sale_order_item_units.site_id
          AND (
            site.user_id = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM public.site_members AS member
              WHERE member.site_id = site.id
                AND member.user_id = auth.uid()
            )
          )
      )
    )
    AND (
      assigned_to IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.sites AS site
        WHERE site.id = sale_order_item_units.site_id
          AND site.user_id = assigned_to
      )
      OR EXISTS (
        SELECT 1
        FROM public.site_members AS member
        WHERE member.site_id = sale_order_item_units.site_id
          AND member.user_id = assigned_to
          AND member.status = 'active'
      )
    )
  );

REVOKE ALL ON TABLE public.sale_order_item_units FROM anon;
GRANT SELECT ON TABLE public.sale_order_item_units TO authenticated;
GRANT UPDATE (status, assigned_to)
  ON TABLE public.sale_order_item_units TO authenticated;

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
BEGIN
  IF NEW.parent_sale_order_item_id IS NOT NULL OR NEW.quantity <= 0 THEN
    DELETE FROM public.sale_order_item_units
    WHERE sale_order_item_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    status_changed := NEW.status IS DISTINCT FROM OLD.status;
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
    NEW.created_at,
    now()
  FROM generate_series(1, unit_count) AS generated_index
  ON CONFLICT (sale_order_item_id, unit_index) DO NOTHING;

  UPDATE public.sale_order_item_units
  SET
    quantity = unit_quantity,
    shipment_id = NEW.shipment_id,
    started_at = COALESCE(NEW.sent_at, started_at, NEW.created_at),
    status = CASE WHEN status_changed THEN NEW.status ELSE status END,
    completed_at = CASE
      WHEN status_changed AND NEW.status IN ('completed', 'ready')
        THEN COALESCE(completed_at, now())
      WHEN status_changed
        AND NEW.status IN ('draft', 'new', 'pending', 'preparing', 'in_progress')
        THEN NULL
      ELSE completed_at
    END,
    updated_at = now()
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

INSERT INTO public.sale_order_item_units (
  site_id,
  sale_order_item_id,
  unit_index,
  quantity,
  status,
  shipment_id,
  started_at,
  created_at,
  updated_at
)
SELECT
  item.site_id,
  item.id,
  generated_index,
  CASE WHEN unit_count.value = 1 THEN item.quantity ELSE 1 END,
  item.status,
  item.shipment_id,
  COALESCE(item.sent_at, item.created_at),
  item.created_at,
  now()
FROM public.sale_order_items AS item
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN item.quantity > 0 AND item.quantity = trunc(item.quantity)
      THEN item.quantity::integer
    WHEN item.quantity > 0 THEN 1
    ELSE 0
  END AS value
) AS unit_count
CROSS JOIN LATERAL generate_series(1, unit_count.value) AS generated_index
WHERE item.parent_sale_order_item_id IS NULL
ON CONFLICT (sale_order_item_id, unit_index) DO NOTHING;

DROP TRIGGER IF EXISTS sync_sale_order_item_units_after_insert
  ON public.sale_order_items;
CREATE TRIGGER sync_sale_order_item_units_after_insert
AFTER INSERT ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_order_item_units_from_line();

DROP TRIGGER IF EXISTS sync_sale_order_item_units_after_update
  ON public.sale_order_items;
CREATE TRIGGER sync_sale_order_item_units_after_update
AFTER UPDATE OF quantity, status, shipment_id, sent_at
ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_order_item_units_from_line();

CREATE OR REPLACE FUNCTION public.touch_sale_order_item_unit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('completed', 'ready') THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF NEW.status IN ('draft', 'new', 'pending', 'preparing', 'in_progress') THEN
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_sale_order_item_unit()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS touch_sale_order_item_unit_before_update
  ON public.sale_order_item_units;
CREATE TRIGGER touch_sale_order_item_unit_before_update
BEFORE UPDATE ON public.sale_order_item_units
FOR EACH ROW
EXECUTE FUNCTION public.touch_sale_order_item_unit();

CREATE OR REPLACE FUNCTION public.sync_sale_order_item_status_from_units()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  shared_status text;
  status_count integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT min(status), count(DISTINCT status)
  INTO shared_status, status_count
  FROM public.sale_order_item_units
  WHERE sale_order_item_id = NEW.sale_order_item_id;

  IF status_count = 1 THEN
    UPDATE public.sale_order_items
    SET status = shared_status
    WHERE id = NEW.sale_order_item_id
      AND status IS DISTINCT FROM shared_status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sale_order_item_status_from_units()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_sale_order_item_status_after_unit_update
  ON public.sale_order_item_units;
CREATE TRIGGER sync_sale_order_item_status_after_unit_update
AFTER UPDATE OF status ON public.sale_order_item_units
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_order_item_status_from_units();

COMMENT ON TABLE public.sale_order_item_units IS
  'Individual operational units derived from commercial order-line quantities.';

COMMIT;

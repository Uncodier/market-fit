BEGIN;

ALTER TABLE public.sale_order_items
  DROP CONSTRAINT IF EXISTS sale_order_items_status_check;
ALTER TABLE public.sale_order_items
  ADD CONSTRAINT sale_order_items_status_check CHECK (
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
  );

CREATE OR REPLACE FUNCTION public.mutate_sale_order_item_units(
  p_site_id uuid,
  p_unit_ids uuid[],
  p_operation text,
  p_assignee_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  requested_count integer;
  matched_count integer;
  updated_count integer := 0;
  is_service_role boolean :=
    current_setting('role', true) = 'service_role'
    OR COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
    OR session_user = 'postgres';
  is_owner boolean := false;
  member_role text;
  restrict_to_assigned boolean := false;
  transitions jsonb;
BEGIN
  SELECT count(*)
  INTO requested_count
  FROM (
    SELECT DISTINCT requested.unit_id
    FROM unnest(p_unit_ids) AS requested(unit_id)
    WHERE requested.unit_id IS NOT NULL
  ) AS requested_units;

  IF requested_count = 0 OR requested_count > 100 THEN
    RAISE EXCEPTION 'Select between 1 and 100 order-line units';
  END IF;

  IF NOT is_service_role THEN
    IF actor_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT (
      EXISTS (
        SELECT 1 FROM public.sites AS site
        WHERE site.id = p_site_id
          AND site.user_id = actor_id
      )
      OR EXISTS (
        SELECT 1 FROM public.site_ownership AS ownership
        WHERE ownership.site_id = p_site_id
          AND ownership.user_id = actor_id
      )
    )
    INTO is_owner;

    SELECT member.role::text, COALESCE(member.restrict_to_assigned_only, false)
    INTO member_role, restrict_to_assigned
    FROM public.site_members AS member
    WHERE member.site_id = p_site_id
      AND member.user_id = actor_id
      AND member.status = 'active'
    LIMIT 1;

    IF NOT is_owner
      AND COALESCE(member_role, '') NOT IN (
        'owner',
        'admin',
        'collaborator'
      )
    THEN
      RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM item.id
  FROM public.sale_order_items AS item
  WHERE item.id IN (
    SELECT unit.sale_order_item_id
    FROM public.sale_order_item_units AS unit
    WHERE unit.site_id = p_site_id
      AND unit.id = ANY(p_unit_ids)
  )
  ORDER BY item.id
  FOR UPDATE;

  PERFORM 1
  FROM public.sale_order_item_units AS unit
  WHERE unit.site_id = p_site_id
    AND unit.id = ANY(p_unit_ids)
  ORDER BY unit.id
  FOR UPDATE;

  SELECT count(*)
  INTO matched_count
  FROM public.sale_order_item_units AS unit
  WHERE unit.site_id = p_site_id
    AND unit.id = ANY(p_unit_ids);

  IF matched_count <> requested_count THEN
    RAISE EXCEPTION 'One or more order-line units were not found';
  END IF;

  IF NOT is_service_role AND NOT is_owner AND restrict_to_assigned THEN
    IF EXISTS (
      SELECT 1
      FROM public.sale_order_item_units AS unit
      WHERE unit.site_id = p_site_id
        AND unit.id = ANY(p_unit_ids)
        AND unit.assigned_to IS DISTINCT FROM actor_id
    ) THEN
      RAISE EXCEPTION 'Restricted members can only update assigned units'
        USING ERRCODE = '42501';
    END IF;
    IF p_operation = 'assign'
      AND p_assignee_id IS DISTINCT FROM actor_id
    THEN
      RAISE EXCEPTION 'Restricted members cannot reassign units'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_operation = 'assign' THEN
    IF p_assignee_id IS NOT NULL AND NOT (
      EXISTS (
        SELECT 1 FROM public.sites AS site
        WHERE site.id = p_site_id
          AND site.user_id = p_assignee_id
      )
      OR EXISTS (
        SELECT 1 FROM public.site_ownership AS ownership
        WHERE ownership.site_id = p_site_id
          AND ownership.user_id = p_assignee_id
      )
      OR EXISTS (
        SELECT 1 FROM public.site_members AS member
        WHERE member.site_id = p_site_id
          AND member.user_id = p_assignee_id
          AND member.status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'Assignee must be an active site member';
    END IF;

    UPDATE public.sale_order_item_units
    SET assigned_to = p_assignee_id
    WHERE site_id = p_site_id
      AND id = ANY(p_unit_ids);
  ELSIF p_operation = 'advance' THEN
    transitions := p_status::jsonb;
    IF transitions IS NULL
      OR jsonb_object_length(transitions) <> requested_count
    THEN
      RAISE EXCEPTION 'Expected transitions are required';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.sale_order_item_units AS unit
      WHERE unit.site_id = p_site_id
        AND unit.id = ANY(p_unit_ids)
        AND transitions ->> unit.id::text IS DISTINCT FROM CASE unit.status
          WHEN 'draft' THEN 'preparing'
          WHEN 'new' THEN 'preparing'
          WHEN 'pending' THEN 'preparing'
          WHEN 'preparing' THEN 'completed'
          WHEN 'in_progress' THEN 'completed'
          WHEN 'completed' THEN 'returned'
          WHEN 'ready' THEN 'returned'
          ELSE NULL
        END
    ) THEN
      RAISE EXCEPTION 'Order-line units changed before this update';
    END IF;

    UPDATE public.sale_order_item_units
    SET status = transitions ->> id::text
    WHERE site_id = p_site_id
      AND id = ANY(p_unit_ids);
  ELSIF p_operation = 'set_status' THEN
    IF p_status NOT IN ('preparing', 'completed', 'returned') THEN
      RAISE EXCEPTION 'Invalid target status';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.sale_order_item_units AS unit
      WHERE unit.site_id = p_site_id
        AND unit.id = ANY(p_unit_ids)
        AND p_status IS DISTINCT FROM CASE unit.status
          WHEN 'draft' THEN 'preparing'
          WHEN 'new' THEN 'preparing'
          WHEN 'pending' THEN 'preparing'
          WHEN 'preparing' THEN 'completed'
          WHEN 'in_progress' THEN 'completed'
          WHEN 'completed' THEN 'returned'
          WHEN 'ready' THEN 'returned'
          ELSE NULL
        END
    ) THEN
      RAISE EXCEPTION 'Order-line units can only move to their next status';
    END IF;

    UPDATE public.sale_order_item_units
    SET status = p_status
    WHERE site_id = p_site_id
      AND id = ANY(p_unit_ids);
  ELSIF p_operation = 'cancel' THEN
    UPDATE public.sale_order_item_units
    SET status = 'cancelled'
    WHERE site_id = p_site_id
      AND id = ANY(p_unit_ids)
      AND status NOT IN ('cancelled', 'returned');
  ELSE
    RAISE EXCEPTION 'Invalid order-line unit operation';
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

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

  PERFORM 1
  FROM public.sale_order_items
  WHERE id = NEW.sale_order_item_id
  FOR UPDATE;

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

CREATE OR REPLACE FUNCTION public.authorize_order_item_unit_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  command_name text := CASE
    WHEN TG_OP = 'INSERT' THEN 'insert'
    WHEN TG_OP = 'DELETE' THEN 'delete'
    ELSE 'update'
  END;
  target_site_id uuid;
  is_service_role boolean :=
    current_setting('role', true) = 'service_role'
    OR COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
    OR session_user = 'postgres';
BEGIN
  target_site_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.site_id
    ELSE NEW.site_id
  END;
  IF NOT is_service_role
    AND NOT public.user_can(target_site_id, command_name)
    AND NOT EXISTS (
      SELECT 1
      FROM public.site_ownership AS ownership
      WHERE ownership.site_id = target_site_id
        AND ownership.user_id = auth.uid()
    )
  THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_order_item_unit_sync()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS authorize_order_item_unit_sync_before_insert
  ON public.sale_order_items;
CREATE TRIGGER authorize_order_item_unit_sync_before_insert
BEFORE INSERT ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.authorize_order_item_unit_sync();

DROP TRIGGER IF EXISTS authorize_order_item_unit_sync_before_update
  ON public.sale_order_items;
CREATE TRIGGER authorize_order_item_unit_sync_before_update
BEFORE UPDATE OF
  site_id,
  quantity,
  status,
  shipment_id,
  sent_at,
  parent_sale_order_item_id
ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.authorize_order_item_unit_sync();

DROP TRIGGER IF EXISTS authorize_order_item_unit_sync_before_delete
  ON public.sale_order_items;
CREATE TRIGGER authorize_order_item_unit_sync_before_delete
BEFORE DELETE ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.authorize_order_item_unit_sync();

DROP TRIGGER IF EXISTS sync_sale_order_item_units_after_update
  ON public.sale_order_items;
CREATE TRIGGER sync_sale_order_item_units_after_update
AFTER UPDATE OF
  site_id,
  quantity,
  status,
  shipment_id,
  sent_at,
  parent_sale_order_item_id
ON public.sale_order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_order_item_units_from_line();

CREATE OR REPLACE FUNCTION public.sync_order_lines_from_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  line_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('pending', 'in_progress', 'completed', 'cancelled')
  THEN
    line_status := CASE NEW.status
      WHEN 'pending' THEN 'new'
      WHEN 'in_progress' THEN 'preparing'
      ELSE NEW.status
    END;
    UPDATE public.sale_order_items
    SET status = line_status
    WHERE site_id = NEW.site_id
      AND sale_order_id = NEW.id
      AND status IS DISTINCT FROM line_status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_lines_from_order_status()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_cancelled_order_reopen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be reopened'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_cancelled_order_reopen()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_cancelled_order_reopen_before_update
  ON public.sale_orders;
CREATE TRIGGER prevent_cancelled_order_reopen_before_update
BEFORE UPDATE OF status ON public.sale_orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cancelled_order_reopen();

NOTIFY pgrst, 'reload schema';

COMMIT;

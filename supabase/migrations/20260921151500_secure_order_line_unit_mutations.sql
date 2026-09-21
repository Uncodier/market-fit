BEGIN;

DROP POLICY IF EXISTS sale_order_item_units_unified
  ON public.sale_order_item_units;
DROP POLICY IF EXISTS sale_order_item_units_select
  ON public.sale_order_item_units;

CREATE POLICY sale_order_item_units_select
  ON public.sale_order_item_units
  FOR SELECT
  TO authenticated
  USING (
    current_setting('role', true) = 'service_role'
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.sites AS site
      WHERE site.id = sale_order_item_units.site_id
        AND site.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.site_ownership AS ownership
      WHERE ownership.site_id = sale_order_item_units.site_id
        AND ownership.user_id = auth.uid()
    )
    OR (
      public.user_can(sale_order_item_units.site_id, 'select')
      AND EXISTS (
        SELECT 1 FROM public.site_members AS member
        WHERE member.site_id = sale_order_item_units.site_id
          AND member.user_id = auth.uid()
          AND member.status = 'active'
          AND (
            NOT COALESCE(member.restrict_to_assigned_only, false)
            OR sale_order_item_units.assigned_to = auth.uid()
          )
      )
    )
  );

REVOKE ALL ON TABLE public.sale_order_item_units FROM anon, authenticated;
GRANT SELECT ON TABLE public.sale_order_item_units TO authenticated;

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
    OR COALESCE((auth.jwt() ->> 'role') = 'service_role', false);
  is_owner boolean := false;
  member_role text;
  restrict_to_assigned boolean := false;
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
      AND COALESCE(member_role, '') NOT IN ('admin', 'collaborator')
    THEN
      RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;
  END IF;

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
    UPDATE public.sale_order_item_units
    SET status = CASE status
      WHEN 'draft' THEN 'preparing'
      WHEN 'new' THEN 'preparing'
      WHEN 'pending' THEN 'preparing'
      WHEN 'preparing' THEN 'completed'
      WHEN 'in_progress' THEN 'completed'
      WHEN 'completed' THEN 'returned'
      WHEN 'ready' THEN 'returned'
      ELSE status
    END
    WHERE site_id = p_site_id
      AND id = ANY(p_unit_ids)
      AND status IN (
        'draft',
        'new',
        'pending',
        'preparing',
        'in_progress',
        'completed',
        'ready'
      );
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

REVOKE ALL ON FUNCTION public.mutate_sale_order_item_units(
  uuid,
  uuid[],
  text,
  uuid,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_sale_order_item_units(
  uuid,
  uuid[],
  text,
  uuid,
  text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

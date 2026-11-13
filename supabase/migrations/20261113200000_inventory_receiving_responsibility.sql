BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.inventory_movements ADD COLUMN receiving_user_id uuid;
ALTER TABLE public.inventory_movements ADD COLUMN receiving_user_name text;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_receiving_responsibility_transfer
  CHECK (receiving_user_id IS NULL OR kind='transfer');

-- Preserve attribution after a team member is removed; eligibility is checked
-- at admission, and the display name is a server-owned snapshot.
CREATE FUNCTION public.inventory_receiver_name(p_site_id uuid,p_user_id uuid,p_location_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE member public.site_members%ROWTYPE; label text;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM public.sites WHERE id=p_site_id AND user_id=p_user_id AND archived_at IS NULL) THEN
    SELECT coalesce(nullif(trim(name),''),'Site owner') INTO label FROM public.profiles WHERE id=p_user_id;
    RETURN coalesce(label,'Site owner');
  END IF;
  IF (SELECT count(*) FROM public.site_members WHERE site_id=p_site_id AND user_id=p_user_id AND status='active') <> 1 THEN
    RAISE EXCEPTION 'Receiving responsible person is unavailable' USING ERRCODE='22023';
  END IF;
  SELECT * INTO member FROM public.site_members WHERE site_id=p_site_id AND user_id=p_user_id
    AND status='active' AND NOT coalesce(license_suspended,false) AND NOT coalesce(manually_disabled,false)
    AND role IN ('owner','admin','collaborator','marketing') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receiving responsible person is unavailable' USING ERRCODE='22023'; END IF;
  IF member.role NOT IN ('owner','admin') AND EXISTS(SELECT 1 FROM public.site_member_location_restrictions
    WHERE site_id=p_site_id AND site_member_id=member.id AND location_id=p_location_id) THEN
    RAISE EXCEPTION 'Receiving responsible person cannot access destination' USING ERRCODE='42501';
  END IF;
  RETURN coalesce(nullif(trim(member.name),''),nullif(trim(member.email),''),'Team member');
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_receiver_name(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Extend the private implementation without rewriting an applied migration.
-- Assert the expected source contract instead of silently patching unknown SQL.
DO $$
DECLARE source text; changed text;
BEGIN
  source := pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);
  IF position('ARRAY[''kind'',''catalogItemId'',''fromLocationId'',''toLocationId'',''quantity'',''notes'']' in source)=0
    OR position('quantity,notes,purchase_id)' in source)=0
    OR position('source_label,target_label,qty,op->>''notes'',(op->>''purchaseId'')::uuid)' in source)=0 THEN
    RAISE EXCEPTION 'Unexpected inventory implementation; review receiver migration';
  END IF;
  changed := replace(source,
    'ARRAY[''kind'',''catalogItemId'',''fromLocationId'',''toLocationId'',''quantity'',''notes'']',
    'ARRAY[''kind'',''catalogItemId'',''fromLocationId'',''toLocationId'',''quantity'',''notes'',''receivingUserId'']');
  changed := replace(changed,'quantity,notes,purchase_id)',
    'quantity,notes,purchase_id,receiving_user_id,receiving_user_name)');
  changed := replace(changed,'source_label,target_label,qty,op->>''notes'',(op->>''purchaseId'')::uuid)',
    'source_label,target_label,qty,op->>''notes'',(op->>''purchaseId'')::uuid,(op->>''receivingUserId'')::uuid,public.inventory_receiver_name(p_site_id,(op->>''receivingUserId'')::uuid,target_id))');
  EXECUTE changed;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_operations_locked(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.apply_inventory_operations(p_site_id uuid,p_request_id uuid,p_operations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE op jsonb;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL OR current_setting('role',true) <> 'authenticated' THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF p_site_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_operations) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_operations) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid inventory batch' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF NOT coalesce(public.user_can(p_site_id,'update'),false) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  FOR op IN SELECT value FROM jsonb_array_elements(p_operations) LOOP
    IF op ? 'receivingUserId' THEN
      IF op->>'kind' IS DISTINCT FROM 'transfer' OR jsonb_typeof(op->'receivingUserId') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'Invalid receiving responsible person' USING ERRCODE='22023';
      END IF;
      IF NOT coalesce(public.user_can_access_location(p_site_id,(op->>'toLocationId')::uuid),false) THEN
        RAISE EXCEPTION 'Destination access denied' USING ERRCODE='42501';
      END IF;
      PERFORM public.inventory_receiver_name(p_site_id,(op->>'receivingUserId')::uuid,(op->>'toLocationId')::uuid);
    END IF;
  END LOOP;
  RETURN public.apply_inventory_operations_locked(p_site_id,p_request_id,p_operations);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) TO authenticated;
COMMIT;
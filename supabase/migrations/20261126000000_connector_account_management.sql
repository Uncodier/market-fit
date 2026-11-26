BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.connector_audit_events DROP CONSTRAINT connector_audit_events_event_type_check;
ALTER TABLE public.connector_audit_events ADD CONSTRAINT connector_audit_events_event_type_check
  CHECK (event_type IN ('access_updated', 'policy_updated', 'auth_completed', 'provider_state_updated', 'connection_renamed'));

CREATE FUNCTION public.connector_manage_account(
  p_site_id uuid, p_connector_id uuid, p_expected_revision integer, p_operation text, p_display_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_revision integer;
  v_name text := btrim(p_display_name);
  v_event text := 'access_updated';
BEGIN
  IF p_operation IS NULL OR p_operation NOT IN ('rename', 'remove_members', 'remove_agents')
    OR (p_operation = 'rename' AND (v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 200 OR v_name ~ '[[:cntrl:]]'))
    OR (p_operation <> 'rename' AND p_display_name IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid connector management operation' USING ERRCODE = '22023';
  END IF;
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.connector_effective_site_access(p_site_id, v_actor) a WHERE a.can_manage) THEN
    RAISE EXCEPTION 'Connector management denied' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.sites WHERE id = p_site_id FOR SHARE;
  PERFORM 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = v_actor FOR SHARE;
  PERFORM 1 FROM public.site_members WHERE site_id = p_site_id AND user_id = v_actor ORDER BY id FOR SHARE;
  -- Share the account row lock and revision with single-grant edits, sync and policy edits.
  SELECT c.revision INTO v_revision FROM public.connectors c
    WHERE c.site_id = p_site_id AND c.id = p_connector_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.connector_effective_site_access(p_site_id, v_actor) a WHERE a.can_manage) THEN
    RAISE EXCEPTION 'Connector management denied' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS DISTINCT FROM v_revision THEN
    RAISE EXCEPTION 'Connector revision conflict' USING ERRCODE = '40001';
  END IF;

  IF p_operation = 'remove_members' THEN
    DELETE FROM public.connector_members WHERE site_id = p_site_id AND connector_id = p_connector_id;
  ELSIF p_operation = 'remove_agents' THEN
    DELETE FROM public.connector_agents WHERE site_id = p_site_id AND connector_id = p_connector_id;
  ELSE
    v_event := 'connection_renamed';
  END IF;
  UPDATE public.connectors SET
    display_name = CASE WHEN p_operation = 'rename' THEN v_name ELSE display_name END,
    access_mode = CASE WHEN p_operation = 'remove_members' THEN 'explicit' ELSE access_mode END,
    revision = v_revision + 1, updated_at = now()
    WHERE site_id = p_site_id AND id = p_connector_id;
  INSERT INTO public.connector_audit_events(site_id, connector_id, actor_id, event_type, revision)
    VALUES (p_site_id, p_connector_id, v_actor, v_event, v_revision + 1);
  RETURN jsonb_build_object('connector_id', p_connector_id, 'revision', v_revision + 1,
    'operation', p_operation, 'display_name', CASE WHEN p_operation = 'rename' THEN v_name END);
END;
$$;

REVOKE ALL ON FUNCTION public.connector_manage_account(uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.connector_manage_account(uuid, uuid, integer, text, text) TO authenticated;

-- Preserve the guard on ordinary writes and never allow re-enabling inheritance.
CREATE OR REPLACE FUNCTION public.connector_guard_access_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.access_mode IS DISTINCT FROM OLD.access_mode AND NOT (
    OLD.access_mode = 'workspace' AND NEW.access_mode = 'explicit' AND current_user = (
      SELECT pg_get_userbyid(proowner) FROM pg_proc
      WHERE oid = 'public.connector_manage_account(uuid, uuid, integer, text, text)'::regprocedure
    )
  ) THEN
    RAISE EXCEPTION 'Connector access mode is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
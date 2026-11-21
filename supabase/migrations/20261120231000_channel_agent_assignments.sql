BEGIN;
SET LOCAL lock_timeout = '5s';

-- Configuration only: do not provision agents, backfill guesses, change channel
-- activation or publish these preferences as runtime routing decisions.
CREATE TABLE public.channel_agent_assignments (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  connection_id text NOT NULL CHECK (length(connection_id) BETWEEN 1 AND 200
    AND connection_id !~ '^[[:space:]]|[[:space:]]$|[[:cntrl:]]'),
  -- Deliberately not ON DELETE SET NULL: a deleted/moved agent is unavailable,
  -- not an instruction to fall back. Validate site + eligibility at write time.
  agent_id uuid,
  revision integer NOT NULL CHECK (revision > 0),
  PRIMARY KEY (site_id, connection_id)
);

CREATE TABLE public.channel_agent_assignment_history (
  site_id uuid NOT NULL,
  connection_id text NOT NULL,
  revision integer NOT NULL,
  previous_agent_id uuid,
  agent_id uuid,
  actor_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (site_id, connection_id, revision),
  FOREIGN KEY (site_id, connection_id) REFERENCES public.channel_agent_assignments ON DELETE CASCADE
);

ALTER TABLE public.channel_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_agent_assignment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_agent_assignments, public.channel_agent_assignment_history
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.channel_agent_assignments TO authenticated;
CREATE POLICY channel_agent_assignment_read ON public.channel_agent_assignments FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND public.current_user_site_role(site_id) IS NOT NULL
    AND NOT public.current_user_has_site_location_restrictions(site_id)
    AND NOT (SELECT public.current_user_has_location_restrictions()));

-- No direct writes, including from the service role. A user-scoped RPC owns
-- admission, concurrency and history; no caller-supplied actor or schema.
CREATE FUNCTION public.set_channel_agent_assignment(
  p_site_id uuid, p_connection_id text, p_agent_id uuid, p_expected_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid(); inventory jsonb; matches integer;
  previous public.channel_agent_assignments; next_revision integer;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR actor IS NULL
    OR coalesce(public.current_user_site_role(p_site_id), '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Assignment management denied' USING ERRCODE = '42501';
  END IF;
  IF p_site_id IS NULL OR p_connection_id IS NULL OR length(p_connection_id) NOT BETWEEN 1 AND 200
    OR p_connection_id ~ '^[[:space:]]|[[:space:]]$|[[:cntrl:]]'
    OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646 THEN
    RAISE EXCEPTION 'Invalid assignment request' USING ERRCODE = '22023';
  END IF;

  -- Use the same site lock as licensing/activation, then recheck authority.
  -- Protect role/ownership and the source connection/agent through commit.
  PERFORM public.lock_site_license(p_site_id);
  PERFORM 1 FROM public.site_ownership WHERE site_id = p_site_id AND user_id = actor FOR SHARE;
  PERFORM 1 FROM public.site_members WHERE site_id = p_site_id AND user_id = actor ORDER BY id FOR SHARE;
  IF coalesce(public.current_user_site_role(p_site_id), '') NOT IN ('owner', 'admin')
    OR public.current_user_has_site_location_restrictions(p_site_id) IS DISTINCT FROM false
    OR public.current_user_has_location_restrictions() IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Assignment management denied' USING ERRCODE = '42501';
  END IF;

  SELECT nullif(s.channels->'connections', 'null'::jsonb) INTO inventory
    FROM public.settings s WHERE s.site_id = p_site_id FOR SHARE;
  IF inventory IS NOT NULL AND jsonb_typeof(inventory) <> 'array' THEN
    RAISE EXCEPTION 'Invalid connection inventory' USING ERRCODE = '22000';
  END IF;
  SELECT count(*) INTO matches FROM jsonb_array_elements(inventory) AS c(value)
    WHERE jsonb_typeof(c.value->'id') = 'string' AND c.value->>'id' = p_connection_id;
  -- Web is intrinsic to the authorized site. A stored row colliding with the
  -- sentinel or duplicate ordinary IDs cannot be addressed unambiguously.
  IF matches <> (CASE WHEN p_connection_id = 'website' THEN 0 ELSE 1 END) THEN
    RAISE EXCEPTION 'Connection unavailable' USING ERRCODE = 'PT404';
  END IF;

  SELECT a.* INTO previous FROM public.channel_agent_assignments a
    WHERE a.site_id = p_site_id AND a.connection_id = p_connection_id FOR UPDATE;
  IF coalesce(previous.revision, 0) <> p_expected_revision THEN
    RAISE EXCEPTION 'Assignment revision changed' USING ERRCODE = 'PT409';
  END IF;
  IF p_agent_id IS NOT NULL THEN
    PERFORM 1 FROM public.agents a WHERE a.id = p_agent_id AND a.site_id = p_site_id AND a.status = 'active' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agent unavailable' USING ERRCODE = 'PT422'; END IF;
  END IF;

  next_revision := p_expected_revision + 1;
  IF previous.revision IS NULL THEN
    INSERT INTO public.channel_agent_assignments(site_id, connection_id, agent_id, revision)
      VALUES (p_site_id, p_connection_id, p_agent_id, next_revision);
  ELSE
    UPDATE public.channel_agent_assignments SET agent_id = p_agent_id, revision = next_revision
      WHERE site_id = p_site_id AND connection_id = p_connection_id;
  END IF;
  INSERT INTO public.channel_agent_assignment_history(site_id, connection_id, revision, previous_agent_id, agent_id, actor_id)
    VALUES (p_site_id, p_connection_id, next_revision, previous.agent_id, p_agent_id, actor);
  RETURN jsonb_build_object('connectionId', p_connection_id, 'agentId', p_agent_id, 'revision', next_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.set_channel_agent_assignment(uuid, text, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_channel_agent_assignment(uuid, text, uuid, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
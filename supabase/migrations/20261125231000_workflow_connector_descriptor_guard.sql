BEGIN;
SET LOCAL lock_timeout='5s';

-- Internal rejection markers for schema projection, not account discovery, a
-- browser DTO, or proof of workflow publication. Never return them over HTTP.
CREATE FUNCTION public.workflow_connector_descriptor_markers(p_site uuid,p_connector uuid,p_actor uuid,p_tool text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE markers jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR p_tool IS NULL THEN RAISE insufficient_privilege; END IF;
  SELECT jsonb_build_array(b.id,b.resource_boundary,b.resource_namespace,b.evidence_ref,a.attempt_id)
    INTO STRICT markers FROM connector_result_private.direct_bindings b
    JOIN connector_result_private.ask_connections a USING(site_id,connector_id)
    JOIN connector_result_private.direct_resources r USING(resource_namespace,resource_boundary)
    JOIN public.connector_members m ON (m.site_id,m.connector_id,m.user_id)=(p_site,p_connector,p_actor)
    JOIN public.connector_policies cp ON (cp.site_id,cp.connector_id)=(p_site,p_connector)
    WHERE (b.site_id,b.connector_id,b.resource_kind)=(p_site,p_connector,'external_business_resource') AND r.site_id=p_site
      AND m.can_use AND m.can_view AND m.revoked_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>statement_timestamp())
      AND 'direct'=ANY(cp.allowed_hosts) AND (cp.tool_access_mode='all' OR (cp.tool_access_mode='selected' AND p_tool=ANY(cp.allowed_tools)))
      AND EXISTS (SELECT FROM public.connector_effective_site_access(p_site,p_actor) v WHERE v.can_manage)
      AND public.site_user_has_effective_access(p_site,p_actor)
      AND NOT EXISTS (SELECT FROM public.site_members sm WHERE (sm.site_id,sm.user_id)=(p_site,p_actor) AND
        (sm.restrict_to_assigned_only IS DISTINCT FROM false OR sm.blocked_screens IS NULL OR
         sm.blocked_screens && (r.required_screens || ARRAY['connectors','robots','workflows']) OR
         EXISTS (SELECT FROM public.site_member_location_restrictions l WHERE (l.site_id,l.site_member_id)=(p_site,sm.id))));
  RETURN markers;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RAISE insufficient_privilege;
END $$;
REVOKE ALL ON FUNCTION public.workflow_connector_descriptor_markers(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workflow_connector_descriptor_markers(uuid,uuid,uuid,text) TO service_role;
COMMIT;

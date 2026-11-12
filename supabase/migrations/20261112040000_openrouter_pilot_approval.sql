BEGIN;
-- Deployment operator-owned pilot approval. No API/customer/tool can grant it.
-- Populate only after approved schema deployment and real payer/capability checks.
CREATE TABLE public.openrouter_rollout_approvals (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id),
  approved_until timestamptz NOT NULL,
  approved_by text NOT NULL CHECK (length(approved_by) BETWEEN 1 AND 200),
  evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openrouter_rollout_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_rollout_approvals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.openrouter_rollout_approvals TO service_role;

CREATE OR REPLACE FUNCTION public.openrouter_customer_publish(
  p_site_id uuid, p_actor_id uuid, p_expected_revision integer, p_candidate jsonb,
  p_refresh_token uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_row public.openrouter_customer_connections; next_row public.openrouter_customer_connections;
BEGIN
  PERFORM public.openrouter_customer_assert_manager(p_site_id, p_actor_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('openrouter:' || p_site_id::text, 0));
  SELECT * INTO current_row FROM public.openrouter_customer_connections WHERE site_id = p_site_id FOR UPDATE;
  IF p_expected_revision IS NULL OR p_expected_revision <> coalesce(current_row.revision, 0)
    THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE = '40001'; END IF;
  IF p_refresh_token IS NOT NULL AND (current_row.refresh_token IS DISTINCT FROM p_refresh_token
    OR current_row.refresh_until <= now()) THEN RAISE EXCEPTION 'Refresh conflict' USING ERRCODE = '40001'; END IF;
  IF current_row.id IS NOT NULL AND current_row.id <> (p_candidate->>'id')::uuid
    THEN RAISE EXCEPTION 'Connection identity conflict' USING ERRCODE = '40001'; END IF;
  IF (p_candidate->>'selected')::boolean AND NOT EXISTS (
    SELECT 1 FROM public.openrouter_rollout_approvals WHERE site_id=p_site_id AND approved_until>now()
  ) THEN RAISE EXCEPTION 'Customer runtime not approved' USING ERRCODE='55000'; END IF;
  IF (p_candidate->>'credential_version')::integer < coalesce(current_row.credential_version, 1)
    OR (p_candidate->>'credential_version')::integer > coalesce(current_row.credential_version + 1, 1)
    THEN RAISE EXCEPTION 'Credential revision conflict' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.openrouter_customer_connections (
    id, site_id, status, selected, revision, policy_version, credential_version,
    encrypted_credential, capabilities, catalog, catalog_updated_at, verified_at, consent_at, created_by
  ) VALUES (
    (p_candidate->>'id')::uuid, p_site_id, p_candidate->>'status', (p_candidate->>'selected')::boolean,
    p_expected_revision + 1, coalesce(current_row.policy_version, 0) + 1,
    (p_candidate->>'credential_version')::integer, p_candidate->>'encrypted_credential',
    p_candidate->'capabilities', p_candidate->'catalog', (p_candidate->>'catalog_updated_at')::timestamptz,
    (p_candidate->>'verified_at')::timestamptz, (p_candidate->>'consent_at')::timestamptz, p_actor_id
  ) ON CONFLICT (site_id) DO UPDATE SET
    status = EXCLUDED.status, selected = EXCLUDED.selected, revision = EXCLUDED.revision,
    policy_version = EXCLUDED.policy_version, credential_version = EXCLUDED.credential_version,
    encrypted_credential = EXCLUDED.encrypted_credential, capabilities = EXCLUDED.capabilities,
    catalog = EXCLUDED.catalog, catalog_updated_at = EXCLUDED.catalog_updated_at,
    verified_at = EXCLUDED.verified_at, consent_at = EXCLUDED.consent_at,
    updated_at = now(), refresh_token = NULL, refresh_until = NULL
  RETURNING * INTO next_row;
  INSERT INTO public.openrouter_customer_policies(connection_id, policy_version, credential_version, capabilities)
    VALUES(next_row.id, next_row.policy_version, next_row.credential_version, next_row.capabilities);
  RETURN to_jsonb(next_row);
END;
$$;

COMMIT;

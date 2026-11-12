BEGIN;

-- Durable status/attribution is independent of Redis retention and selected policy.
-- Only the dispatch ledger grants the single paid POST; this table never does.
CREATE TABLE public.openrouter_customer_video_jobs (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  connection_id uuid NOT NULL REFERENCES public.openrouter_customer_connections(id),
  operation_key text NOT NULL,
  job jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, operation_key)
);
ALTER TABLE public.openrouter_customer_video_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_customer_video_jobs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.openrouter_customer_video_save(p_job jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE previous jsonb; routing jsonb; field text;
BEGIN
  routing := p_job->'routing';
  IF jsonb_typeof(p_job) IS DISTINCT FROM 'object' OR octet_length(p_job::text) > 65536
    OR p_job - ARRAY['id','siteId','instanceId','routing','request','fingerprint','eventId','operationKey',
      'createdAt','status','upstreamId','generationId','cost','error','videos'] <> '{}'::jsonb
    OR jsonb_typeof(routing) IS DISTINCT FROM 'object'
    OR routing - ARRAY['payer','siteId','connectionId','policyVersion','credentialVersion'] <> '{}'::jsonb
    OR routing->>'payer' IS DISTINCT FROM 'customer'
    OR routing->>'siteId' IS DISTINCT FROM p_job->>'siteId'
    OR coalesce((routing->>'policyVersion')::integer,0) < 1
    OR coalesce((routing->>'credentialVersion')::integer,0) < 1
    OR coalesce(length(p_job->>'operationKey'),0) NOT BETWEEN 1 AND 256
    OR coalesce(p_job->>'status','') NOT IN ('pending','in_progress','completed','failed')
    OR jsonb_typeof(p_job->'request') IS DISTINCT FROM 'object'
    OR (p_job->'request') - ARRAY['model','prompt','duration','aspect_ratio','resolution'] <> '{}'::jsonb
    OR coalesce(length(p_job->'request'->>'model'),0) NOT BETWEEN 1 AND 256
    OR coalesce(length(p_job->'request'->>'prompt'),0) NOT BETWEEN 1 AND 10000
    OR coalesce(length(p_job->>'fingerprint'),0) <> 64
    OR p_job->>'eventId' IS NULL
    OR p_job->>'createdAt' IS NULL
    OR (p_job ? 'upstreamId' AND (p_job->>'upstreamId') !~ '^[A-Za-z0-9_-]{1,200}$')
  THEN RAISE EXCEPTION 'Invalid customer video job' USING ERRCODE = '22023'; END IF;
  PERFORM (p_job->>'eventId')::uuid, (p_job->>'createdAt')::timestamptz;
  PERFORM 1 FROM public.openrouter_customer_connections
    WHERE id = (routing->>'connectionId')::uuid AND site_id = (p_job->>'siteId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Video ownership mismatch' USING ERRCODE = '42501'; END IF;
  -- Serializes concurrent inserts/updates, without a lease that could allow replay.
  PERFORM pg_advisory_xact_lock(hashtextextended((p_job->>'siteId') || ':' || (p_job->>'operationKey'),0));
  SELECT job INTO previous FROM public.openrouter_customer_video_jobs
    WHERE site_id = (p_job->>'siteId')::uuid AND operation_key = p_job->>'operationKey' FOR UPDATE;
  IF previous IS NOT NULL THEN
    FOREACH field IN ARRAY ARRAY['id','siteId','instanceId','routing','request','fingerprint','eventId','operationKey','createdAt'] LOOP
      IF previous->field IS DISTINCT FROM p_job->field THEN
        RAISE EXCEPTION 'Video immutable field conflict' USING ERRCODE = '40001';
      END IF;
    END LOOP;
    IF previous ? 'upstreamId' AND previous->'upstreamId' IS DISTINCT FROM p_job->'upstreamId'
      OR previous->>'status' IN ('completed','failed') AND previous IS DISTINCT FROM p_job
    THEN RAISE EXCEPTION 'Video outcome conflict' USING ERRCODE = '40001'; END IF;
    UPDATE public.openrouter_customer_video_jobs SET job = p_job, updated_at = now()
      WHERE id = (p_job->>'id')::uuid;
  ELSE
    IF p_job->>'status' <> 'pending' OR p_job ? 'upstreamId' OR p_job ? 'videos' THEN
      RAISE EXCEPTION 'Video must begin pending' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.openrouter_customer_video_jobs(id,site_id,connection_id,operation_key,job)
    VALUES ((p_job->>'id')::uuid,(p_job->>'siteId')::uuid,(routing->>'connectionId')::uuid,p_job->>'operationKey',p_job);
  END IF;
  RETURN p_job;
END;
$$;

CREATE FUNCTION public.openrouter_customer_video_load(p_site_id uuid,p_job_id uuid DEFAULT NULL,p_operation_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT job FROM public.openrouter_customer_video_jobs WHERE site_id = p_site_id
    AND ((p_job_id IS NOT NULL AND id = p_job_id) OR (p_job_id IS NULL AND operation_key = p_operation_key));
$$;
REVOKE ALL ON FUNCTION public.openrouter_customer_video_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.openrouter_customer_video_load(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_customer_video_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.openrouter_customer_video_load(uuid,uuid,text) TO service_role;

COMMIT;
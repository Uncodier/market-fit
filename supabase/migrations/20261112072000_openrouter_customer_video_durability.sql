BEGIN;

-- Forward-only CAS repair; existing versionless rows start at revision zero.
CREATE OR REPLACE FUNCTION public.openrouter_customer_video_save(p_job jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE previous jsonb; routing jsonb; field text; current_version bigint;
BEGIN
  routing := p_job->'routing';
  IF coalesce(p_job->>'version','0') !~ '^[0-9]{1,15}$' THEN
    RAISE EXCEPTION 'Invalid video version' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_job) IS DISTINCT FROM 'object' OR octet_length(p_job::text) > 65536
    OR p_job - ARRAY['id','siteId','instanceId','routing','request','fingerprint','eventId','operationKey',
      'createdAt','status','upstreamId','generationId','cost','error','videos','version','settlement'] <> '{}'::jsonb
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
  IF p_job ? 'settlement' THEN
    IF jsonb_typeof(p_job->'settlement') IS DISTINCT FROM 'object'
      OR (p_job->'settlement') - ARRAY['status','receipt'] <> '{}'::jsonb
      OR coalesce(p_job->'settlement'->>'status','') NOT IN ('completed','failed')
      OR jsonb_typeof(p_job->'settlement'->'receipt') IS DISTINCT FROM 'object'
      OR (p_job->'settlement'->'receipt') - ARRAY['site_id','connection_id','policy_version',
        'credential_version','event_id','capability','generation_id','model','state','usage_evidence'] <> '{}'::jsonb
      OR p_job->'settlement'->'receipt'->>'event_id' IS DISTINCT FROM p_job->>'eventId'
      OR p_job->'settlement'->'receipt'->>'site_id' IS DISTINCT FROM p_job->>'siteId'
      OR p_job->'settlement'->'receipt'->>'connection_id' IS DISTINCT FROM routing->>'connectionId'
      OR p_job->'settlement'->'receipt'->>'policy_version' IS DISTINCT FROM routing->>'policyVersion'
      OR p_job->'settlement'->'receipt'->>'credential_version' IS DISTINCT FROM routing->>'credentialVersion'
      OR p_job->'settlement'->'receipt'->>'capability' IS DISTINCT FROM 'video'
    THEN RAISE EXCEPTION 'Invalid video settlement' USING ERRCODE = '22023'; END IF;
  END IF;
  IF p_job->>'status' IN ('completed','failed') AND (
    p_job->'settlement'->>'status' IS DISTINCT FROM p_job->>'status'
    OR (p_job->>'status' = 'completed' AND
      (jsonb_typeof(p_job->'videos') IS DISTINCT FROM 'array' OR jsonb_array_length(p_job->'videos') <> 1))) THEN
    RAISE EXCEPTION 'Video terminal checkpoint missing' USING ERRCODE = '22023';
  END IF;
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
    current_version := coalesce((previous->>'version')::bigint,0);
    -- Exact ACK-loss retry is harmless, but a different stale snapshot must never win.
    IF (previous - 'version') = (p_job - 'version') THEN
      RETURN previous || jsonb_build_object('version',current_version);
    END IF;
    IF coalesce((p_job->>'version')::bigint,0) <> current_version THEN
      RAISE EXCEPTION 'Video stale version' USING ERRCODE = '40001';
    END IF;
    IF previous ? 'settlement' AND (
      previous->'cost' IS DISTINCT FROM p_job->'cost'
      OR previous->'generationId' IS DISTINCT FROM p_job->'generationId') THEN
      RAISE EXCEPTION 'Video settlement evidence conflict' USING ERRCODE = '40001';
    END IF;
    FOREACH field IN ARRAY ARRAY['upstreamId','generationId','cost','videos','settlement'] LOOP
      IF previous ? field AND previous->field IS DISTINCT FROM p_job->field
        AND (field NOT IN ('generationId','cost') OR previous ? 'settlement' OR NOT p_job ? field) THEN
        RAISE EXCEPTION 'Video checkpoint conflict' USING ERRCODE = '40001';
      END IF;
    END LOOP;
    IF previous->>'status' = 'in_progress' AND p_job->>'status' = 'pending' THEN
      RAISE EXCEPTION 'Video status regression' USING ERRCODE = '40001';
    END IF;
    IF previous ? 'upstreamId' AND previous->'upstreamId' IS DISTINCT FROM p_job->'upstreamId'
      OR previous->>'status' IN ('completed','failed') AND previous IS DISTINCT FROM p_job
    THEN RAISE EXCEPTION 'Video outcome conflict' USING ERRCODE = '40001'; END IF;
    p_job := jsonb_set(p_job,'{version}',to_jsonb(current_version + 1));
    UPDATE public.openrouter_customer_video_jobs SET job = p_job, updated_at = now()
      WHERE id = (p_job->>'id')::uuid;
  ELSE
    IF p_job->>'status' <> 'pending' OR p_job ? 'upstreamId' OR p_job ? 'videos'
      OR p_job ? 'settlement' OR coalesce((p_job->>'version')::bigint,0) <> 0 THEN
      RAISE EXCEPTION 'Video must begin pending' USING ERRCODE = '22023';
    END IF;
    p_job := jsonb_set(p_job,'{version}','1'::jsonb);
    INSERT INTO public.openrouter_customer_video_jobs(id,site_id,connection_id,operation_key,job)
    VALUES ((p_job->>'id')::uuid,(p_job->>'siteId')::uuid,(routing->>'connectionId')::uuid,p_job->>'operationKey',p_job);
  END IF;
  RETURN p_job;
END;
$$;

REVOKE ALL ON FUNCTION public.openrouter_customer_video_save(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_customer_video_save(jsonb) TO service_role;

COMMIT;

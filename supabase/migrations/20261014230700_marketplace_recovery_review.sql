BEGIN;
ALTER TABLE public.marketplace_integrations ADD COLUMN poll_sent_next boolean NOT NULL DEFAULT false;

-- A Rappi new-order read consumes READY records. Alternate recovery of SENT
-- orders, and keep per-store reads spaced even across concurrent workers.
CREATE OR REPLACE FUNCTION public.claim_marketplace_poll(p_limit integer DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE claimed jsonb;
BEGIN
  IF NOT public.marketplace_is_backend() THEN
    RAISE EXCEPTION 'Marketplace polling requires backend' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Invalid marketplace poll limit'; END IF;
  WITH eligible AS (
    SELECT i.id FROM public.marketplace_integrations i JOIN public.sites s ON s.id = i.site_id
    WHERE i.enabled AND s.archived_at IS NULL AND (i.last_polled_at IS NULL OR i.last_polled_at <= now()-interval '45 seconds')
    ORDER BY i.last_polled_at NULLS FIRST,i.id LIMIT p_limit FOR UPDATE OF i SKIP LOCKED
  ), changed AS (
    UPDATE public.marketplace_integrations i SET last_polled_at = now(),poll_sent_next = NOT i.poll_sent_next
    FROM eligible e WHERE i.id = e.id RETURNING i.id,i.provider,i.poll_sent_next
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('integration_id',id,'provider',provider,
      'order_list',CASE WHEN poll_sent_next THEN 'new' ELSE 'sent' END)),'[]'::jsonb) INTO claimed FROM changed;
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_marketplace_poll(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_poll(integer) TO service_role;
COMMIT;
BEGIN;
ALTER TABLE public.marketplace_integrations ADD COLUMN last_polled_at timestamptz;
ALTER TABLE public.sale_orders ADD COLUMN marketplace_polled_at timestamptz;

-- Durable rate-limited claim, not a provider-operation retry. A crash loses one
-- poll window, never repeats a pending/unknown mutation. Server worker fetches
-- authoritative snapshots and imports through the same atomic event RPC.
CREATE FUNCTION public.claim_marketplace_poll(p_limit integer DEFAULT 3)
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
    UPDATE public.marketplace_integrations i SET last_polled_at = now() FROM eligible e WHERE i.id = e.id
    RETURNING i.id,i.provider
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('integration_id',id,'provider',provider)),'[]'::jsonb) INTO claimed FROM changed;
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_marketplace_poll(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_poll(integer) TO service_role;

-- Current deployments publish orders/lines but not shipments. Preserve unrelated
-- publication members; skip safely in offline PostgreSQL without Supabase.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS(
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shipments'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments; END IF;
END $$;
COMMIT;
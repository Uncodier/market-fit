BEGIN;

-- Expose receipt counts, never proposal identities or contents before opening.
CREATE FUNCTION public.list_procurement_quotation_envelopes(p_site uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF public.procurement_tender_access(p_site,'select') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tender_id',receipts.tender_id,'publication_id',receipts.publication_id,
    'tender_title',receipts.tender_title,'opening_at',receipts.opening_at,
    'received_count',receipts.received_count
  ) ORDER BY receipts.opening_at,receipts.publication_id),'[]'::jsonb) INTO result
  FROM (
    SELECT p.tender_id,p.id AS publication_id,p.snapshot->>'title' AS tender_title,
      p.snapshot->>'opening_at' AS opening_at,count(*) AS received_count
    FROM public.quotations q
    JOIN public.procurement_tender_publications p ON p.id=q.procurement_publication_id
      AND p.site_id=q.buyer_site_id AND p.tender_id=q.procurement_tender_id
    WHERE q.buyer_site_id=p_site AND q.purpose='procurement'
      AND q.procurement_source='supplier_submitted'
      AND (p.snapshot->>'opening_policy'='on_receipt'
        OR (p.snapshot->>'opening_at')::timestamptz<=now()) IS NOT TRUE
    GROUP BY p.id,p.tender_id,p.snapshot->>'title',p.snapshot->>'opening_at'
  ) receipts;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.list_procurement_quotation_envelopes(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_procurement_quotation_envelopes(uuid) TO authenticated;

COMMIT;
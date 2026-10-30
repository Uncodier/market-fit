BEGIN;

-- Derive durable receipt events from immutable submissions, including existing ones.
-- Never expose quotation IDs, supplier identities, references or proposal contents.
CREATE FUNCTION public.list_procurement_receipt_activity(p_site uuid,p_tender uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF public.procurement_tender_access(p_site,'select') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.procurement_tenders WHERE id=p_tender AND site_id=p_site) THEN
    RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'receipt_number',r.receipt_number,'received_at',r.received_at,
    'publication_id',r.publication_id,'publication_version',r.publication_version
  ) ORDER BY r.receipt_number DESC),'[]'::jsonb) INTO result
  FROM (
    SELECT row_number() OVER (ORDER BY q.created_at,q.id) AS receipt_number,
      q.created_at AS received_at,p.id AS publication_id,p.version AS publication_version
    FROM public.quotations q
    JOIN public.procurement_tender_publications p ON p.id=q.procurement_publication_id
      AND p.site_id=q.buyer_site_id AND p.tender_id=q.procurement_tender_id
    WHERE q.buyer_site_id=p_site AND q.procurement_tender_id=p_tender
      AND q.purpose='procurement' AND q.procurement_source='supplier_submitted'
  ) r;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.list_procurement_receipt_activity(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_procurement_receipt_activity(uuid,uuid) TO authenticated;

COMMIT;
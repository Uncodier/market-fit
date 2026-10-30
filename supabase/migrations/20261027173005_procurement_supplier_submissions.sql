BEGIN;

-- The representation helper is installed by the later evidence migration.
-- An absent integration fails closed, rather than inferring authority from email.
CREATE FUNCTION public.submit_procurement_quotation(p_site uuid,p_document jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean:=false; result uuid; evidence jsonb:=COALESCE(p_document->'evidence','[]'::jsonb);
BEGIN
  IF auth.uid() IS NULL OR to_regprocedure('public.procurement_can_represent(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  EXECUTE 'SELECT public.procurement_can_represent($1,$2)' INTO allowed USING p_site,(p_document->>'supplier_id')::uuid;
  IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  EXECUTE 'SELECT true FROM public.supplier_representatives WHERE site_id=$1 AND supplier_id=$2 AND user_id=$3 AND revoked_at IS NULL FOR SHARE'
    INTO allowed USING p_site,(p_document->>'supplier_id')::uuid,auth.uid();
  IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Verified representation required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(evidence) IS DISTINCT FROM 'array' OR jsonb_array_length(evidence)>100 THEN
    RAISE EXCEPTION 'Invalid evidence selection' USING ERRCODE='22023'; END IF;
  result:=public.capture_procurement_quotation(p_site,p_document,'supplier_submitted');
  IF jsonb_array_length(evidence)>0 THEN
    IF to_regprocedure('public.attach_procurement_quotation_evidence(uuid,jsonb)') IS NULL THEN
      RAISE EXCEPTION 'Evidence integration unavailable' USING ERRCODE='22023'; END IF;
    EXECUTE 'SELECT public.attach_procurement_quotation_evidence($1,$2)' USING result,evidence;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_procurement_quotation(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_procurement_quotation(uuid,jsonb) TO authenticated;

CREATE FUNCTION public.my_procurement_submissions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(row),'[]') INTO result FROM (
    SELECT jsonb_build_object('id',q.id,'reference',q.procurement_reference,'publication_id',q.procurement_publication_id,
      'tender_title',p.snapshot->>'title','currency',q.currency,'net_amount_minor',q.procurement_net_minor,
      'tax_amount_minor',q.procurement_tax_minor,'submitted_at',q.created_at,
      'lines',(SELECT jsonb_agg(jsonb_build_object('name',i.name,'quantity',i.quantity,'unit_net_minor',i.procurement_unit_net_minor,
        'net_amount_minor',i.procurement_net_minor,'tax_amount_minor',i.procurement_tax_minor)) FROM public.quotation_items i WHERE i.quotation_id=q.id)) AS row
    FROM public.quotations q JOIN public.procurement_tender_publications p ON p.id=q.procurement_publication_id
    WHERE q.procurement_source='supplier_submitted' AND q.procurement_custodian_id=auth.uid()
    ORDER BY q.created_at DESC LIMIT 100
  ) rows;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.my_procurement_submissions() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.my_procurement_submissions() TO authenticated;

COMMIT;
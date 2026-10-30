BEGIN;

-- Single-target buyer projection. Keep the same immutable opening boundary as
-- list_procurement_quotations without depending on its newest-100 list window.
CREATE FUNCTION public.get_procurement_quotation(p_site uuid, p_quotation uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'select') THEN
    RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'id',q.id,'supplier_id',s.id,'supplier_name',s.name,'tender_id',t.id,
    'title',q.procurement_reference,'tender_title',p.snapshot->>'title','publication_id',p.id,
    'procurement_revision',q.procurement_revision,'currency',q.currency,
    'net_amount_minor',q.procurement_net_minor,'tax_amount_minor',q.procurement_tax_minor,
    'recorded_at',q.created_at,'reference',q.procurement_reference,'award_id',a.id,
    'source',q.procurement_source,'lines',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'quantity',i.quantity,
        'catalog_item_id',i.catalog_item_id,'unit_net_minor',i.procurement_unit_net_minor,
        'net_amount_minor',i.procurement_net_minor,'tax_amount_minor',i.procurement_tax_minor) ORDER BY i.id)
      FROM public.quotation_items i WHERE i.quotation_id=q.id
    ),'[]'::jsonb)
  ) INTO result
  FROM public.quotations q
    JOIN public.suppliers s ON s.id=q.procurement_supplier_id AND s.site_id=p_site
    JOIN public.procurement_tenders t ON t.id=q.procurement_tender_id AND t.site_id=p_site
    JOIN public.procurement_tender_publications p
      ON p.id=q.procurement_publication_id AND p.site_id=p_site AND p.tender_id=t.id
    LEFT JOIN public.procurement_awards a ON a.quotation_id=q.id AND a.site_id=p_site
  WHERE q.id=p_quotation AND q.buyer_site_id=p_site AND q.purpose='procurement'
    AND (q.procurement_source='buyer_recorded' OR p.snapshot->>'opening_policy'='on_receipt'
      OR (p.snapshot->>'opening_at')::timestamptz<=now());
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_procurement_quotation(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_procurement_quotation(uuid,uuid) TO authenticated;

COMMIT;
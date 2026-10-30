BEGIN;

CREATE FUNCTION public.list_procurement_quotations(p_site uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'select') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(row),'[]') INTO result FROM (
    SELECT jsonb_build_object('id',q.id,'supplier_id',s.id,'supplier_name',s.name,'tender_id',t.id,
      'title',q.procurement_reference,'tender_title',p.snapshot->>'title','publication_id',p.id,
      'procurement_revision',q.procurement_revision,'currency',q.currency,'net_amount_minor',q.procurement_net_minor,
      'tax_amount_minor',q.procurement_tax_minor,'recorded_at',q.created_at,'reference',q.procurement_reference,
      'award_id',a.id,'source',q.procurement_source,'lines',(SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'quantity',i.quantity,
        'catalog_item_id',i.catalog_item_id,'unit_net_minor',i.procurement_unit_net_minor,
        'net_amount_minor',i.procurement_net_minor,'tax_amount_minor',i.procurement_tax_minor) ORDER BY i.id)
        FROM public.quotation_items i WHERE i.quotation_id=q.id)) AS row
    FROM public.quotations q JOIN public.suppliers s ON s.id=q.procurement_supplier_id AND s.site_id=p_site
      JOIN public.procurement_tenders t ON t.id=q.procurement_tender_id
      JOIN public.procurement_tender_publications p ON p.id=q.procurement_publication_id
      LEFT JOIN public.procurement_awards a ON a.quotation_id=q.id
    WHERE q.buyer_site_id=p_site AND q.purpose='procurement'
      AND (q.procurement_source='buyer_recorded' OR p.snapshot->>'opening_policy'='on_receipt'
        OR (p.snapshot->>'opening_at')::timestamptz<=now())
    ORDER BY q.created_at DESC LIMIT 100
  ) rows;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.list_procurement_quotations(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_procurement_quotations(uuid) TO authenticated;

CREATE FUNCTION public.list_procurement_orders(p_site uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'select') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(row),'[]') INTO result FROM (
    SELECT jsonb_build_object('id',o.id,'award_id',o.award_id,'quotation_id',o.quotation_id,'supplier_name',s.name,
      'currency',o.currency,'net_amount_minor',o.net_amount_minor,'tax_amount_minor',o.tax_amount_minor,'created_at',o.created_at,
      'lines',(SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'quantity',i.quantity,
        'unit_net_minor',i.unit_net_minor,'net_amount_minor',i.net_amount_minor,'tax_amount_minor',i.tax_amount_minor,
        'received_quantity',(SELECT COALESCE(sum(r.quantity),0) FROM public.procurement_receipt_items r WHERE r.order_item_id=i.id)) ORDER BY i.id)
        FROM public.purchase_order_items i WHERE i.order_id=o.id)) AS row
    FROM public.purchase_orders o JOIN public.suppliers s ON s.id=o.supplier_id AND s.site_id=p_site
    WHERE o.site_id=p_site ORDER BY o.created_at DESC LIMIT 100
  ) rows;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.list_procurement_orders(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_procurement_orders(uuid) TO authenticated;

-- A single-target projection for server policy evaluation, never client prices.
CREATE FUNCTION public.procurement_commerce_event_context(p_site uuid,p_target uuid,p_version integer,p_event text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; result jsonb;
BEGIN
  PERFORM public.procurement_validate_commerce_event(p_site,p_target,p_version,p_event);
  IF p_event='award' THEN SELECT * INTO q FROM public.quotations WHERE id=p_target;
  ELSE SELECT quotation.* INTO q FROM public.quotations quotation JOIN public.procurement_awards a ON a.quotation_id=quotation.id WHERE a.id=p_target; END IF;
  SELECT jsonb_build_object('currency',q.currency,'net_amount_minor',q.procurement_net_minor,
    'supplier_proposals',(SELECT count(DISTINCT proposal.procurement_supplier_id) FROM public.quotations proposal
      JOIN public.suppliers supplier ON supplier.id=proposal.procurement_supplier_id AND supplier.site_id=p_site
      WHERE proposal.procurement_publication_id=q.procurement_publication_id AND proposal.buyer_site_id=p_site AND supplier.status='approved'),
    'lines',jsonb_agg(jsonb_build_object('id',i.id,'productId',i.catalog_item_id,
      'categoryIds',CASE WHEN c.category_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(c.category_id) END,
      'netAmountMinor',i.procurement_net_minor) ORDER BY i.id)) INTO result
    FROM public.quotation_items i JOIN public.catalog_items c ON c.id=i.catalog_item_id AND c.site_id=p_site WHERE i.quotation_id=q.id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) TO authenticated;

COMMIT;
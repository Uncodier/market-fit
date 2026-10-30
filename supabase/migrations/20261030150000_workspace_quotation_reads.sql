BEGIN;
SET LOCAL lock_timeout='5s';

CREATE INDEX procurement_business_registration_workspace
 ON public.procurement_open_business_registrations(acting_site_id,publication_id);

-- Not a Data API schema. The invoker list needs a narrowly projected definer
-- source, never definer access to sales or leads.
CREATE SCHEMA workspace_quotation_private;
REVOKE ALL ON SCHEMA workspace_quotation_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA workspace_quotation_private TO authenticated;

CREATE FUNCTION workspace_quotation_private.authorize(p_site uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL
 OR public.procurement_business_access(p_site,auth.uid()) IS DISTINCT FROM true
 OR public.user_can(p_site,'select') IS DISTINCT FROM true
 OR (public.current_user_site_role(p_site) NOT IN ('owner','admin') AND EXISTS(
   SELECT 1 FROM public.site_members m WHERE m.site_id=p_site AND m.user_id=auth.uid()
   AND m.status='active' AND COALESCE(to_jsonb(m.blocked_screens),'[]'::jsonb) ? 'quotations')) THEN
   RAISE EXCEPTION 'Quotation access denied' USING ERRCODE='42501';
 END IF;
END $$;

CREATE FUNCTION workspace_quotation_private.business_rows(p_site uuid,p_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,title text,reference text,created_at timestamptz,updated_at timestamptz,
 currency text,subtotal numeric,tax_total numeric,total numeric,business_name text,buyer_name text,tender_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM workspace_quotation_private.authorize(p_site);
 -- Company proposals have no acting-business location. Omit this branch for
 -- restricted/unknown scope without suppressing location-filtered sales RLS.
 IF public.current_user_has_site_location_restrictions(p_site) IS DISTINCT FROM false THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,p.snapshot->>'title',q.procurement_reference::text,q.created_at,q.updated_at,
 q.currency::text,q.procurement_net_minor::numeric/100,q.procurement_tax_minor::numeric/100,
 (q.procurement_net_minor::numeric+q.procurement_tax_minor::numeric)/100,
 business.name::text,buyer.name::text,'/tenders/'||portal.slug||'/'||t.portal_slug
 FROM public.procurement_open_business_registrations b
 JOIN public.quotations q ON q.procurement_publication_id=b.publication_id
   AND q.buyer_site_id=b.site_id AND q.procurement_supplier_id=b.supplier_id
 JOIN public.procurement_tender_publications p ON p.id=b.publication_id AND p.site_id=b.site_id
 JOIN public.procurement_tenders t ON t.id=p.tender_id AND t.site_id=p.site_id
 JOIN public.sites business ON business.id=b.acting_site_id
 JOIN public.sites buyer ON buyer.id=b.site_id
 JOIN public.procurement_tender_portals portal ON portal.site_id=b.site_id
 WHERE b.acting_site_id=p_site AND q.purpose='procurement'
   AND q.procurement_source='supplier_submitted' AND (p_id IS NULL OR q.id=p_id);
END $$;

CREATE FUNCTION public.get_business_procurement_quotation(p_site uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM workspace_quotation_private.authorize(p_site);
 IF p_id IS NULL THEN RAISE EXCEPTION 'Quotation ID required' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',r.id,'purpose','procurement','status','sent',
   'title',r.title,'reference',r.reference,'created_at',r.created_at,'valid_until',NULL,
   'site',jsonb_build_object('name',r.business_name),'lead',jsonb_build_object('name',r.buyer_name),
   'subtotal',r.subtotal,'tax_total',r.tax_total,'total',r.total,'currency',r.currency,'tender_url',r.tender_url,
   'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'quantity',i.quantity,
     'unit_price',i.procurement_unit_net_minor::numeric/100,'subtotal',i.procurement_net_minor::numeric/100)
     ORDER BY i.id) FROM public.quotation_items i WHERE i.quotation_id=r.id),'[]'::jsonb))
 INTO result FROM workspace_quotation_private.business_rows(p_site,p_id) r;
 RETURN result;
END $$;

CREATE FUNCTION public.list_workspace_quotations(p_site uuid,p_status text DEFAULT 'all',
 p_search text DEFAULT '',p_page integer DEFAULT 1,p_page_size integer DEFAULT 50,p_sort text DEFAULT 'newest')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM workspace_quotation_private.authorize(p_site);
 IF p_status IS NULL OR p_status NOT IN ('all','draft','sent','accepted','rejected','expired')
 OR p_search IS NULL OR length(p_search)>200 OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000
 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 100
 OR p_sort IS NULL OR p_sort NOT IN ('newest','oldest','updated_at') THEN
   RAISE EXCEPTION 'Invalid quotation filters' USING ERRCODE='22023'; END IF;
 WITH combined AS (
   SELECT q.id,q.purpose,q.status::text,q.total,q.currency,q.created_at,q.updated_at,q.valid_until,
     jsonb_build_object('name',l.name,'email',l.email) AS lead,
     NULL::text AS title,NULL::text AS reference,NULL::text AS tender_url
   FROM public.quotations q LEFT JOIN public.leads l ON l.id=q.lead_id
   WHERE q.site_id=p_site AND q.purpose='sales'
   UNION ALL
   SELECT r.id,'procurement','sent',r.total,r.currency,r.created_at,r.updated_at,NULL::timestamptz,
     jsonb_build_object('name',r.buyer_name,'email',NULL),r.title,r.reference,r.tender_url
   FROM workspace_quotation_private.business_rows(p_site) r
 ), filtered AS (
   SELECT * FROM combined c WHERE (p_status='all' OR c.status=p_status)
   AND (p_search='' OR strpos(lower(concat_ws(' ',c.id::text,c.title,c.reference,c.lead->>'name',c.lead->>'email')),lower(p_search))>0)
 ), numbered AS (
   SELECT f.*,row_number() OVER (ORDER BY
     CASE WHEN p_sort='oldest' THEN f.created_at END ASC,
     CASE WHEN p_sort='updated_at' THEN f.updated_at END DESC,
     CASE WHEN p_sort<>'oldest' THEN f.created_at END DESC,f.id) AS ordinal
   FROM filtered f
 ), page AS (
   SELECT * FROM numbered ORDER BY ordinal LIMIT p_page_size OFFSET (p_page-1)*p_page_size
 )
 SELECT jsonb_build_object('data',COALESCE((SELECT jsonb_agg(to_jsonb(page)-'ordinal' ORDER BY ordinal) FROM page),'[]'::jsonb),
   'count',(SELECT count(*) FROM filtered)) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION workspace_quotation_private.authorize(uuid),
 workspace_quotation_private.business_rows(uuid,uuid),public.get_business_procurement_quotation(uuid,uuid),
 public.list_workspace_quotations(uuid,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION workspace_quotation_private.authorize(uuid),
 workspace_quotation_private.business_rows(uuid,uuid),public.get_business_procurement_quotation(uuid,uuid),
 public.list_workspace_quotations(uuid,text,text,integer,integer,text) TO authenticated;

COMMIT;
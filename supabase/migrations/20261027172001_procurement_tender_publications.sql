BEGIN;

-- Owner-only primitive: the separately authorized event approval workflow calls
-- this in its transaction. Neither API role can bypass that workflow.
CREATE FUNCTION public.procurement_materialize_tender_publication(p_site uuid,p_id uuid,p_version integer,p_actor uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; publication uuid; safe_lines jsonb; claims text; policy jsonb; policy_version integer;
BEGIN
 claims:=current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
 IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Publisher access revoked' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.procurement_tenders WHERE id=p_id AND site_id=p_site FOR UPDATE;
 IF t.id IS NULL OR t.version<>p_version OR t.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'Tender version conflict' USING ERRCODE='40001'; END IF;
 IF t.participation_deadline<=now() OR (t.opening_policy='after_close' AND t.opening_at<t.participation_deadline) THEN RAISE EXCEPTION 'Publication dates expired' USING ERRCODE='22023'; END IF;
 SELECT document,revision INTO policy,policy_version FROM public.procurement_policy_versions WHERE site_id=p_site ORDER BY revision DESC LIMIT 1;
 IF t.global_visible AND policy#>'{settings,allowGlobalListing}' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Global listing disabled by policy' USING ERRCODE='22023'; END IF;
 IF t.visibility<>'private' AND NOT EXISTS(SELECT 1 FROM public.procurement_tender_portals WHERE site_id=p_site AND enabled) THEN RAISE EXCEPTION 'Tender portal is disabled' USING ERRCODE='22023'; END IF;
 IF t.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.procurement_requests WHERE id=t.request_id AND site_id=p_site AND status='approved') THEN
  RAISE EXCEPTION 'Linked request must be approved' USING ERRCODE='22023';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('id',line->>'id','description',line->>'description','quantity',(line->>'quantity')::integer,'unit',line->>'unit') ORDER BY ord)
 INTO safe_lines FROM jsonb_array_elements(t.requirements) WITH ORDINALITY AS x(line,ord);
 INSERT INTO public.procurement_tender_publications(site_id,tender_id,version,visibility,global_visible,published_by,policy_revision,snapshot)
 VALUES(p_site,p_id,p_version,t.visibility,t.global_visible,p_actor,policy_version,jsonb_build_object(
  'title',t.title,'description',t.description,'currency',t.currency,'participation',t.participation,'opening_policy',t.opening_policy,'participation_deadline',t.participation_deadline,'opening_at',t.opening_at,'requirements',safe_lines)) RETURNING id INTO publication;
 UPDATE public.procurement_tenders SET status='published',updated_at=now() WHERE id=p_id;
 INSERT INTO public.procurement_tender_audit(site_id,tender_id,version,actor_id,event,snapshot) VALUES(p_site,p_id,p_version,p_actor,'published',jsonb_build_object('publication_id',publication));
 PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
 RETURN publication;
END $$;
REVOKE ALL ON FUNCTION public.procurement_materialize_tender_publication(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Minimal DTO only; raw tender, supplier, estimate, request and audit tables
-- remain private. Unlisted publications require the full opaque tender slug.
CREATE FUNCTION public.public_procurement_tenders(p_site_slug text DEFAULT NULL,p_tender_slug text DEFAULT NULL,p_page integer DEFAULT 0,p_search text DEFAULT '')
RETURNS TABLE(site_slug text,tender_slug text,publication_id uuid,version integer,status text,published_at timestamptz,snapshot jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_page<0 OR p_page>10000 OR length(p_search)>200 OR (p_site_slug IS NOT NULL AND p_site_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$')
 OR (p_tender_slug IS NOT NULL AND (p_site_slug IS NULL OR p_tender_slug !~ '^[0-9a-f-]{36}$')) THEN
  RAISE EXCEPTION 'Invalid public tender query' USING ERRCODE='22023';
 END IF;
 RETURN QUERY
 SELECT portal.slug,t.portal_slug,p.id,p.version,t.status,p.published_at,p.snapshot
 FROM public.procurement_tenders t
 JOIN public.procurement_tender_portals portal ON portal.site_id=t.site_id AND portal.enabled
 JOIN public.sites s ON s.id=t.site_id AND s.archived_at IS NULL
 JOIN LATERAL (SELECT pub.* FROM public.procurement_tender_publications pub WHERE pub.tender_id=t.id ORDER BY pub.version DESC LIMIT 1) p ON true
 WHERE t.status IN ('published','closed')
 AND (p.visibility='public' OR (p.visibility='unlisted' AND p_tender_slug=t.portal_slug AND p_site_slug=portal.slug))
 AND (p_site_slug IS NOT NULL OR (p.global_visible AND
   (SELECT document#>'{settings,allowGlobalListing}' FROM public.procurement_policy_versions WHERE site_id=t.site_id ORDER BY revision DESC LIMIT 1)='true'::jsonb
   AND NOT EXISTS(SELECT 1 FROM public.procurement_policy_versions revoked WHERE revoked.site_id=t.site_id AND revoked.revision>p.policy_revision
     AND revoked.document#>'{settings,allowGlobalListing}' IS DISTINCT FROM 'true'::jsonb)))
 AND (p_site_slug IS NULL OR portal.slug=p_site_slug)
 AND (p_tender_slug IS NULL OR t.portal_slug=p_tender_slug)
 AND (p_search='' OR position(lower(p_search) IN lower(p.snapshot->>'title'))>0)
 ORDER BY p.published_at DESC,p.id
 LIMIT 25 OFFSET p_page*25;
END $$;
REVOKE ALL ON FUNCTION public.public_procurement_tenders(text,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.public_procurement_tenders(text,text,integer,text) TO anon,authenticated;

CREATE FUNCTION public.set_procurement_tender_participant(p_site uuid,p_id uuid,p_version integer,p_supplier uuid,p_status text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; participant uuid; deadline timestamptz;
BEGIN
 IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.procurement_tenders WHERE site_id=p_site AND id=p_id FOR UPDATE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
 IF t.version<>p_version OR t.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'Tender version conflict' USING ERRCODE='40001'; END IF;
 deadline:=t.participation_deadline;
 IF t.status='published' THEN SELECT (snapshot->>'participation_deadline')::timestamptz INTO deadline FROM public.procurement_tender_publications WHERE tender_id=p_id ORDER BY version DESC LIMIT 1; END IF;
 IF p_status NOT IN ('invited','withdrawn') OR p_status IS NULL OR (p_status='invited' AND (deadline IS NULL OR deadline<=now())) THEN RAISE EXCEPTION 'Invalid participation state' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE site_id=p_site AND id=p_supplier AND (p_status='withdrawn' OR status='approved')) THEN
  RAISE EXCEPTION 'Approved same-site supplier required' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.procurement_tender_participants(site_id,tender_id,supplier_id,status,invited_by)
 VALUES(p_site,p_id,p_supplier,p_status,auth.uid()) ON CONFLICT(tender_id,supplier_id) DO UPDATE SET status=excluded.status RETURNING id INTO participant;
 INSERT INTO public.procurement_tender_audit(site_id,tender_id,version,actor_id,event,snapshot)
 VALUES(p_site,p_id,p_version,auth.uid(),'participant_'||p_status,jsonb_build_object('participant_id',participant,'supplier_id',p_supplier));
 RETURN participant;
END $$;
REVOKE ALL ON FUNCTION public.set_procurement_tender_participant(uuid,uuid,integer,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_procurement_tender_participant(uuid,uuid,integer,uuid,text) TO authenticated;

CREATE FUNCTION public.configure_procurement_tender_portal(p_site uuid,p_enabled boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result text;
BEGIN
 IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Portal enabled state required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.procurement_tender_portals(site_id,enabled) VALUES(p_site,p_enabled)
 ON CONFLICT(site_id) DO UPDATE SET enabled=excluded.enabled RETURNING slug INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.configure_procurement_tender_portal(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.configure_procurement_tender_portal(uuid,boolean) TO authenticated;

COMMIT;
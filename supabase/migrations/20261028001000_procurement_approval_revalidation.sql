BEGIN;

-- Publication decisions must not apply an obsolete policy while recording the
-- newly current policy as if it authorized the original approval plan.
CREATE OR REPLACE FUNCTION public.finalize_procurement_event(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.procurement_event_approvals;
BEGIN
  SELECT * INTO STRICT a FROM public.procurement_event_approvals WHERE id=p_id;
  IF a.status<>'approved' THEN RAISE EXCEPTION 'Approval incomplete' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||a.site_id::text,0));
  IF a.policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=a.site_id) THEN
    RAISE EXCEPTION 'Policy changed; request a new approval' USING ERRCODE='40001';
  END IF;
  IF a.event='publication' THEN
    PERFORM public.procurement_materialize_tender_publication(a.site_id,a.target_id,a.target_version,a.actor_id);
  ELSIF a.event IN ('award','order') THEN
    PERFORM public.procurement_materialize_commerce_event(a.id);
  ELSE RAISE EXCEPTION 'Unsupported event' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finalize_procurement_event(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Count only eligible, distinct suppliers for the exact publication. A withdrawn
-- invitation cannot satisfy a mandatory competition count simply because its
-- immutable quotation remains in the audit history.
CREATE OR REPLACE FUNCTION public.procurement_commerce_event_context(p_site uuid,p_target uuid,p_version integer,p_event text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; result jsonb;
BEGIN
  PERFORM public.procurement_validate_commerce_event(p_site,p_target,p_version,p_event);
  IF p_event='award' THEN SELECT * INTO q FROM public.quotations WHERE id=p_target;
  ELSE SELECT quotation.* INTO q FROM public.quotations quotation JOIN public.procurement_awards a ON a.quotation_id=quotation.id WHERE a.id=p_target; END IF;
  SELECT jsonb_build_object('currency',q.currency,'net_amount_minor',q.procurement_net_minor,
    'supplier_proposals',(SELECT count(DISTINCT proposal.procurement_supplier_id) FROM public.quotations proposal
      JOIN public.suppliers supplier ON supplier.id=proposal.procurement_supplier_id AND supplier.site_id=p_site
      JOIN public.procurement_tender_publications publication ON publication.id=proposal.procurement_publication_id
      WHERE proposal.procurement_publication_id=q.procurement_publication_id AND proposal.buyer_site_id=p_site
        AND supplier.status='approved'
        AND (CASE WHEN proposal.procurement_source='buyer_recorded' OR publication.snapshot->>'participation'='invitation_only'
          THEN EXISTS(SELECT 1 FROM public.procurement_tender_participants participant
            WHERE participant.tender_id=proposal.procurement_tender_id AND participant.supplier_id=supplier.id AND participant.status='invited')
          ELSE publication.snapshot->>'participation' IN ('open','approved_suppliers') END)),
    'lines',jsonb_agg(jsonb_build_object('id',i.id,'productId',i.catalog_item_id,
      'categoryIds',CASE WHEN c.category_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(c.category_id) END,
      'netAmountMinor',i.procurement_net_minor) ORDER BY i.id)) INTO result
    FROM public.quotation_items i JOIN public.catalog_items c ON c.id=i.catalog_item_id AND c.site_id=p_site WHERE i.quotation_id=q.id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_commerce_event_context(uuid,uuid,integer,text) TO authenticated;

-- Historical assignment alone must not reveal subsequent revisions after a
-- request is returned and its approval plan is replaced.
CREATE OR REPLACE FUNCTION public.procurement_request_visible(p_id uuid,p_site uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.procurement_request_access(p_site) OR (
    auth.uid() IS NOT NULL AND public.current_user_site_role(p_site) IS NOT NULL
    AND COALESCE(public.user_can(p_site,'select'),false)
    AND public.current_user_has_site_location_restrictions(p_site) IS NOT DISTINCT FROM false
    AND EXISTS(SELECT 1 FROM public.procurement_request_stages stage
      JOIN public.procurement_requests request ON request.id=stage.request_id AND request.revision=stage.revision
      WHERE request.id=p_id AND request.site_id=p_site AND stage.definition->'approverIds' ? auth.uid()::text));
$$;
REVOKE ALL ON FUNCTION public.procurement_request_visible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_request_visible(uuid,uuid) TO authenticated;

COMMIT;
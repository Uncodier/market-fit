BEGIN;
SET LOCAL lock_timeout='5s';

-- Classify canonical opportunities, without restricting public direct-link access.
CREATE OR REPLACE FUNCTION public.my_procurement_participation_details() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(jsonb_agg(o.value || jsonb_build_object(
  'visibility',p.visibility,'participation',p.snapshot->>'participation',
  'directly_invited',EXISTS(SELECT 1 FROM public.procurement_tender_participants participant
   WHERE participant.tender_id=p.tender_id AND participant.site_id=p.site_id
   AND participant.supplier_id=(o.value->>'supplier_id')::uuid AND participant.status='invited'))),'[]'::jsonb)
 FROM jsonb_array_elements(public.my_procurement_participation()) o(value)
 JOIN public.procurement_tender_publications p ON p.id=(o.value->>'publication_id')::uuid
$$;
REVOKE ALL ON FUNCTION public.my_procurement_participation_details() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.my_procurement_participation_details() TO authenticated;

-- A retained owner row authorizes only its exact immutable publication snapshot.
-- This helper accepts no publication selector: it cannot discover unsaved tenders.
CREATE FUNCTION public.procurement_saved_draft_opportunities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'publication_id',d.publication_id,'publication_version',d.publication_version,'applicant_key',d.applicant_key,
  'opportunity',jsonb_build_object(
   'site_id',p.site_id,'tender_id',p.tender_id,'publication_id',p.id,'version',p.version,
   'title',p.snapshot->>'title','description',p.snapshot->>'description','currency',p.snapshot->>'currency',
   'visibility',p.visibility,'participation',p.snapshot->>'participation',
   'participation_deadline',p.snapshot->>'participation_deadline','opening_at',p.snapshot->>'opening_at',
   'opening_policy',p.snapshot->>'opening_policy',
   'requirements',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',line->>'id','description',line->>'description','quantity',line->'quantity','unit',line->>'unit')),'[]'::jsonb)
    FROM jsonb_array_elements(p.snapshot->'requirements') line),
   'acting_as_self',d.applicant_key='personal',
   'acting_site_id',business.id,
   'supplier_id',COALESCE(represented.id,registration.supplier_id,self.supplier_id),
   'supplier_name',COALESCE(business.name,represented.name,NULLIF(d.draft->>'holderName',''),'On behalf of myself'),
   'directly_invited',EXISTS(SELECT 1 FROM public.procurement_tender_participants participant
    WHERE participant.site_id=p.site_id AND participant.tender_id=p.tender_id AND participant.status='invited'
    AND participant.supplier_id=COALESCE(represented.id,registration.supplier_id,self.supplier_id))
  ))),'[]'::jsonb)
 FROM public.procurement_submission_drafts d
 JOIN public.procurement_tender_publications p ON p.id=d.publication_id
  AND p.version=d.publication_version AND p.site_id=d.site_id
 LEFT JOIN public.sites business ON d.applicant_key='business:'||business.id::text
 LEFT JOIN public.procurement_open_business_registrations registration ON registration.publication_id=p.id
  AND registration.acting_site_id=business.id AND registration.site_id=p.site_id
 LEFT JOIN public.procurement_self_suppliers self ON d.applicant_key='personal'
  AND self.user_id=d.owner_id AND self.site_id=p.site_id
 LEFT JOIN public.suppliers represented ON d.applicant_key='supplier:'||represented.id::text
  AND represented.site_id=p.site_id
 WHERE auth.uid() IS NOT NULL AND d.owner_id=auth.uid()
$$;
REVOKE ALL ON FUNCTION public.procurement_saved_draft_opportunities() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_saved_draft_opportunities() TO authenticated;

-- User-scoped table reads retain owner RLS, including closed/revoked drafts.
-- Only exact current selectors permit editing; attempted receipts permit recovery.
CREATE FUNCTION public.procurement_submission_drafts_list() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 WITH current_opportunities AS MATERIALIZED (
  SELECT o.value,CASE WHEN o.value->>'acting_site_id' IS NOT NULL THEN 'business:'||(o.value->>'acting_site_id')
   WHEN (o.value->>'acting_as_self')::boolean OR o.value->>'supplier_id' IS NULL THEN 'personal'
   ELSE 'supplier:'||(o.value->>'supplier_id') END AS applicant_key
  FROM jsonb_array_elements(public.my_procurement_participation_details()) o(value)
 ), retained_opportunities AS MATERIALIZED (
  SELECT o.value FROM jsonb_array_elements(public.procurement_saved_draft_opportunities()) o(value)
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'publication_id',d.publication_id,'publication_version',d.publication_version,'applicant_key',d.applicant_key,
  'updated_at',d.updated_at,'draft_revision',d.draft_revision,'reference',d.draft->>'reference',
  'attempted',d.draft->>'attempted'='true',
  'opportunity',COALESCE(current.value,retained.value->'opportunity'),
  'can_resume',current.value IS NOT NULL OR d.draft->>'attempted'='true'
 ) ORDER BY d.updated_at DESC,d.publication_id,d.publication_version,d.applicant_key),'[]'::jsonb)
 INTO result FROM public.procurement_submission_drafts d
 LEFT JOIN current_opportunities current ON current.value->>'publication_id'=d.publication_id::text
  AND (current.value->>'version')::integer=d.publication_version AND current.applicant_key=d.applicant_key
 LEFT JOIN retained_opportunities retained ON retained.value->>'publication_id'=d.publication_id::text
  AND (retained.value->>'publication_version')::integer=d.publication_version
  AND retained.value->>'applicant_key'=d.applicant_key
 WHERE d.owner_id=auth.uid();
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.procurement_submission_drafts_list() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_submission_drafts_list() TO authenticated;
COMMIT;
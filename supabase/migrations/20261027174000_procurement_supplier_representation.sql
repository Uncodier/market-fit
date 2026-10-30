BEGIN;

-- A workspace relationship grant is not global organization credential authority.
CREATE TABLE public.supplier_representatives (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL,
 supplier_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 granted_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 UNIQUE(site_id,supplier_id,user_id),
 FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.supplier_representation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 grant_id uuid NOT NULL REFERENCES public.supplier_representatives(id),
 site_id uuid NOT NULL, actor_id uuid NOT NULL, event text NOT NULL CHECK(event IN ('granted','revoked')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.procurement_can_represent(p_site uuid,p_supplier uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.supplier_representatives r
  JOIN public.suppliers s ON s.id=r.supplier_id AND s.site_id=r.site_id
  JOIN public.sites workspace ON workspace.id=r.site_id
  WHERE r.site_id=p_site AND r.supplier_id=p_supplier AND r.user_id=auth.uid()
  AND r.revoked_at IS NULL AND s.status NOT IN ('blocked','archived') AND workspace.archived_at IS NULL
 )
$$;
CREATE FUNCTION public.set_supplier_representative(p_site uuid,p_supplier uuid,p_user uuid,p_revoke boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Representation access denied' USING ERRCODE='42501'; END IF;
 IF p_revoke IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user AND email_confirmed_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.suppliers WHERE site_id=p_site AND id=p_supplier) THEN
  RAISE EXCEPTION 'Verified account and same-workspace supplier required' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.supplier_representatives(site_id,supplier_id,user_id,granted_by,revoked_at)
 VALUES(p_site,p_supplier,p_user,auth.uid(),CASE WHEN p_revoke THEN now() END)
 ON CONFLICT(site_id,supplier_id,user_id) DO UPDATE SET revoked_at=excluded.revoked_at,granted_by=excluded.granted_by
 RETURNING id INTO result;
 INSERT INTO public.supplier_representation_events(grant_id,site_id,actor_id,event)
 VALUES(result,p_site,auth.uid(),CASE WHEN p_revoke THEN 'revoked' ELSE 'granted' END);
 RETURN result;
END $$;
ALTER TABLE public.supplier_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_representation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_representatives,public.supplier_representation_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.supplier_representatives,public.supplier_representation_events TO authenticated;
CREATE POLICY representation_read ON public.supplier_representatives FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.procurement_tender_access(site_id));
CREATE POLICY representation_event_read ON public.supplier_representation_events FOR SELECT TO authenticated
 USING(public.procurement_tender_access(site_id));
CREATE TRIGGER supplier_representation_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.supplier_representation_events FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();
REVOKE ALL ON FUNCTION public.procurement_can_represent(uuid,uuid),public.set_supplier_representative(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_can_represent(uuid,uuid),public.set_supplier_representative(uuid,uuid,uuid,boolean) TO authenticated;

COMMIT;
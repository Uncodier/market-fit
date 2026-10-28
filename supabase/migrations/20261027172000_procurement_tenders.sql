BEGIN;

CREATE TABLE public.procurement_tender_portals (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  enabled boolean NOT NULL DEFAULT false,
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$')
);
CREATE TABLE public.procurement_tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (length(description)<=10000),
  request_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed','cancelled')),
  visibility text NOT NULL CHECK (visibility IN ('public','unlisted','private')),
  global_visible boolean NOT NULL DEFAULT false,
  participation text NOT NULL CHECK (participation IN ('open','invitation_only','approved_suppliers')),
  opening_policy text NOT NULL CHECK (opening_policy IN ('on_receipt','after_close')),
  portal_slug text NOT NULL DEFAULT gen_random_uuid()::text,
  participation_deadline timestamptz NOT NULL,
  opening_at timestamptz NOT NULL,
  currency text NOT NULL CHECK (currency IN ('USD','MXN','EUR','GBP','CAD')),
  requirements jsonb NOT NULL CHECK (jsonb_typeof(requirements)='array'),
  net_amount_minor bigint NOT NULL CHECK (net_amount_minor BETWEEN 0 AND 9007199254740991),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id,id), UNIQUE(site_id,portal_slug),
  FOREIGN KEY(site_id,request_id) REFERENCES public.procurement_requests(site_id,id) ON DELETE RESTRICT,
  CHECK (NOT global_visible OR visibility='public'),
  CHECK (opening_policy='on_receipt' OR opening_at >= participation_deadline)
);
CREATE INDEX procurement_tenders_site ON public.procurement_tenders(site_id,updated_at DESC,id);
CREATE TABLE public.procurement_tender_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  tender_id uuid NOT NULL,
  version integer NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public','unlisted','private')),
  global_visible boolean NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid NOT NULL,
  policy_revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  UNIQUE(tender_id,version),
  FOREIGN KEY(site_id,tender_id) REFERENCES public.procurement_tenders(site_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.procurement_tender_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  tender_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','withdrawn')),
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tender_id,supplier_id),
  FOREIGN KEY(site_id,tender_id) REFERENCES public.procurement_tenders(site_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.procurement_tender_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL,
  tender_id uuid NOT NULL, version integer NOT NULL, actor_id uuid NOT NULL,
  event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL
);

CREATE FUNCTION public.procurement_tender_access(p_site uuid,p_command text DEFAULT 'select') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL
 AND COALESCE(public.current_user_site_role(p_site) IN ('owner','admin'),false)
 AND public.current_user_has_site_location_restrictions(p_site) IS NOT DISTINCT FROM false
 AND COALESCE(public.user_can(p_site,p_command),false)
$$;
REVOKE ALL ON FUNCTION public.procurement_tender_access(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_tender_access(uuid,text) TO authenticated;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['procurement_tender_portals','procurement_tenders','procurement_tender_publications','procurement_tender_participants','procurement_tender_audit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY tender_manager_read ON public.%I FOR SELECT TO authenticated USING (public.procurement_tender_access(site_id))',t);
 END LOOP;
END $$;

CREATE TRIGGER procurement_tender_publications_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.procurement_tender_publications FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();
CREATE TRIGGER procurement_tender_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
 ON public.procurement_tender_audit FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

CREATE FUNCTION public.save_procurement_tender(p_site uuid,p_id uuid,p_version integer,p_document jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders; line jsonb; total numeric:=0; n integer; rid uuid; seen text[]:='{}';
BEGIN
 IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_document) k WHERE k NOT IN
 ('title','description','request_id','currency','visibility','global_visible','participation','opening_policy','participation_deadline','opening_at','requirements'))
 OR NOT p_document ?& ARRAY['title','description','request_id','currency','visibility','global_visible','participation','opening_policy','participation_deadline','opening_at','requirements']
 OR jsonb_typeof(p_document->'global_visible') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(p_document->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(p_document->'description') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'Invalid tender document' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_document->'requirements') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid requirements' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(p_document->'requirements');
 IF n<1 OR n>100 THEN RAISE EXCEPTION 'Invalid requirements' USING ERRCODE='22023'; END IF;
 rid:=(p_document->>'request_id')::uuid;
 IF rid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.procurement_requests WHERE id=rid AND site_id=p_site)
 THEN RAISE EXCEPTION 'Request access denied' USING ERRCODE='42501'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_document->'requirements') LOOP
  IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR NOT line ?& ARRAY['id','description','quantity','unit','unit_net_minor','catalog_item_id']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(line) k WHERE k NOT IN ('id','description','quantity','unit','unit_net_minor','catalog_item_id'))
  OR line->>'id' IS NULL OR line->>'description' IS NULL OR line->>'quantity' IS NULL OR line->>'unit' IS NULL OR line->>'unit_net_minor' IS NULL
  OR jsonb_typeof(line->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(line->'description') IS DISTINCT FROM 'string'
  OR jsonb_typeof(line->'unit') IS DISTINCT FROM 'string' OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number'
  OR jsonb_typeof(line->'unit_net_minor') IS DISTINCT FROM 'number'
  OR length(btrim(line->>'description')) NOT BETWEEN 1 AND 2000 OR length(btrim(line->>'unit')) NOT BETWEEN 1 AND 40
  OR (line->>'quantity')::numeric NOT BETWEEN 1 AND 1000000 OR (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric)
  OR (line->>'unit_net_minor')::numeric NOT BETWEEN 0 AND 9007199254740991 OR (line->>'unit_net_minor')::numeric<>trunc((line->>'unit_net_minor')::numeric)
  OR line->>'id'=ANY(seen)
  THEN RAISE EXCEPTION 'Invalid requirement' USING ERRCODE='22023'; END IF;
  PERFORM (line->>'id')::uuid;
  seen:=array_append(seen,line->>'id');
  IF line->>'catalog_item_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_items WHERE id=(line->>'catalog_item_id')::uuid AND site_id=p_site AND status='active')
  THEN RAISE EXCEPTION 'Catalog access denied' USING ERRCODE='42501'; END IF;
  total:=total+(line->>'quantity')::numeric*(line->>'unit_net_minor')::numeric;
 END LOOP;
 IF total IS NULL OR total>9007199254740991 THEN RAISE EXCEPTION 'Invalid estimate' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
  IF p_version<>0 THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='40001'; END IF;
  INSERT INTO public.procurement_tender_portals(site_id) VALUES(p_site) ON CONFLICT(site_id) DO NOTHING;
  INSERT INTO public.procurement_tenders(site_id,title,description,request_id,visibility,global_visible,participation,opening_policy,participation_deadline,opening_at,currency,requirements,net_amount_minor,created_by)
  VALUES(p_site,btrim(p_document->>'title'),p_document->>'description',rid,p_document->>'visibility',(p_document->>'global_visible')::boolean,p_document->>'participation',p_document->>'opening_policy',
   (p_document->>'participation_deadline')::timestamptz,(p_document->>'opening_at')::timestamptz,p_document->>'currency',p_document->'requirements',total,auth.uid()) RETURNING * INTO t;
 ELSE
  SELECT * INTO t FROM public.procurement_tenders WHERE id=p_id AND site_id=p_site FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
  IF t.version<>p_version OR t.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'Version or state conflict' USING ERRCODE='40001'; END IF;
  UPDATE public.procurement_tenders SET title=btrim(p_document->>'title'),description=p_document->>'description',request_id=rid,
   visibility=p_document->>'visibility',global_visible=(p_document->>'global_visible')::boolean,
   participation=p_document->>'participation',opening_policy=p_document->>'opening_policy',
   participation_deadline=(p_document->>'participation_deadline')::timestamptz,opening_at=(p_document->>'opening_at')::timestamptz,
   currency=p_document->>'currency',requirements=p_document->'requirements',net_amount_minor=total,version=version+1,updated_at=now()
   WHERE id=p_id RETURNING * INTO t;
 END IF;
 INSERT INTO public.procurement_tender_audit(site_id,tender_id,version,actor_id,event,snapshot) VALUES(p_site,t.id,t.version,auth.uid(),'saved',to_jsonb(t));
 RETURN t.id;
END $$;
REVOKE ALL ON FUNCTION public.save_procurement_tender(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_procurement_tender(uuid,uuid,integer,jsonb) TO authenticated;

CREATE FUNCTION public.transition_procurement_tender(p_site uuid,p_id uuid,p_version integer,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.procurement_tenders;
BEGIN
 IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.procurement_tenders WHERE id=p_id AND site_id=p_site FOR UPDATE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Tender access denied' USING ERRCODE='42501'; END IF;
 IF t.version<>p_version THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='40001'; END IF;
 IF p_action='delete' AND t.status='draft' THEN
  DELETE FROM public.procurement_tender_participants WHERE tender_id=p_id;
  DELETE FROM public.procurement_tenders WHERE id=p_id;
 ELSIF (p_action='cancel' AND t.status IN ('draft','published')) OR (p_action='close' AND t.status='published' AND
  (SELECT (snapshot->>'participation_deadline')::timestamptz FROM public.procurement_tender_publications WHERE tender_id=p_id ORDER BY version DESC LIMIT 1)<=now()) THEN
  UPDATE public.procurement_tenders SET status=CASE p_action WHEN 'cancel' THEN 'cancelled' ELSE 'closed' END,version=version+1,updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid tender transition' USING ERRCODE='22023'; END IF;
 INSERT INTO public.procurement_tender_audit(site_id,tender_id,version,actor_id,event,snapshot) VALUES(p_site,p_id,p_version,auth.uid(),p_action,to_jsonb(t));
END $$;
REVOKE ALL ON FUNCTION public.transition_procurement_tender(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_procurement_tender(uuid,uuid,integer,text) TO authenticated;

COMMIT;
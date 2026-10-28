BEGIN;

-- A buyer's private relationship, not a CRM lead or an account representation grant.
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'under_review', 'approved', 'blocked', 'archived')),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  commercial_terms text NOT NULL DEFAULT '' CHECK (length(commercial_terms) <= 10000),
  private_notes text NOT NULL DEFAULT '' CHECK (length(private_notes) <= 20000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (site_id, id)
);
CREATE INDEX suppliers_site_status_name ON public.suppliers(site_id, status, name, id);

CREATE TABLE public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  email text NOT NULL DEFAULT '' CHECK (length(email) <= 254 AND (email = '' OR email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 60),
  role text NOT NULL DEFAULT '' CHECK (length(role) <= 120),
  is_primary boolean NOT NULL DEFAULT false,
  FOREIGN KEY (site_id, supplier_id) REFERENCES public.suppliers(site_id, id) ON DELETE RESTRICT
);
CREATE INDEX supplier_contacts_supplier ON public.supplier_contacts(site_id, supplier_id);
CREATE UNIQUE INDEX supplier_contacts_one_primary ON public.supplier_contacts(supplier_id) WHERE is_primary;

CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_site_id_id_unique ON public.catalog_categories(site_id, id);
CREATE TABLE public.supplier_category_links (
  site_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  category_id uuid NOT NULL,
  PRIMARY KEY (supplier_id, category_id),
  FOREIGN KEY (site_id, supplier_id) REFERENCES public.suppliers(site_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (site_id, category_id) REFERENCES public.catalog_categories(site_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX supplier_category_links_site ON public.supplier_category_links(site_id, category_id);

CREATE TABLE public.supplier_activity (
  site_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'status_changed')),
  previous_status text,
  status text NOT NULL CHECK (status IN ('prospect', 'under_review', 'approved', 'blocked', 'archived')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (supplier_id, version),
  FOREIGN KEY (site_id, supplier_id) REFERENCES public.suppliers(site_id, id) ON DELETE RESTRICT
);

CREATE FUNCTION public.procurement_supplier_can(p_site_id uuid, p_command text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_user_site_role(p_site_id) IS NOT NULL
    AND public.current_user_has_site_location_restrictions(p_site_id) IS FALSE
    AND (p_command = 'select' OR public.current_user_site_role(p_site_id) IN ('owner', 'admin', 'collaborator'))
    AND p_command IN ('select', 'insert', 'update')
    AND public.user_can(p_site_id, p_command) IS TRUE
$$;
REVOKE ALL ON FUNCTION public.procurement_supplier_can(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.procurement_supplier_can(uuid,text) TO authenticated;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppliers, public.supplier_contacts, public.supplier_category_links FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.supplier_activity FROM PUBLIC, anon, authenticated, service_role;
-- Writes exclusively use the checked, transactional CAS function below.
GRANT SELECT ON public.suppliers, public.supplier_contacts, public.supplier_category_links TO authenticated;
GRANT SELECT ON public.supplier_activity TO authenticated;
CREATE POLICY suppliers_read ON public.suppliers FOR SELECT TO authenticated
  USING (public.procurement_supplier_can(site_id, 'select'));
CREATE POLICY supplier_contacts_read ON public.supplier_contacts FOR SELECT TO authenticated
  USING (public.procurement_supplier_can(site_id, 'select'));
CREATE POLICY supplier_categories_read ON public.supplier_category_links FOR SELECT TO authenticated
  USING (public.procurement_supplier_can(site_id, 'select'));
CREATE POLICY supplier_activity_read ON public.supplier_activity FOR SELECT TO authenticated
  USING (public.procurement_supplier_can(site_id, 'select'));

CREATE FUNCTION public.record_supplier_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.supplier_activity(site_id,supplier_id,version,actor_id,action,previous_status,status)
  VALUES (NEW.site_id,NEW.id,NEW.version,auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'created' WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed' ELSE 'updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,NEW.status);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_supplier_activity() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER supplier_activity_record AFTER INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.record_supplier_activity();

CREATE FUNCTION public.reject_supplier_activity_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Supplier activity is immutable' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_supplier_activity_mutation() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER supplier_activity_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.supplier_activity
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_supplier_activity_mutation();

CREATE FUNCTION public.guard_procurement_supplier() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Archive suppliers instead of deleting them' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Invalid supplier identity or revision' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'archived' AND NEW.status NOT IN ('archived', 'prospect') THEN
    RAISE EXCEPTION 'Restore archived suppliers as prospects before review' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_procurement_supplier() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER supplier_identity_guard BEFORE UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_supplier();
CREATE TRIGGER supplier_no_truncate BEFORE TRUNCATE ON public.suppliers
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_procurement_supplier();

CREATE FUNCTION public.guard_supplier_category() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.catalog_categories c WHERE c.id = NEW.category_id AND c.site_id = NEW.site_id) THEN
    RAISE EXCEPTION 'Category must belong to supplier workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_supplier_category() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER supplier_category_site_guard BEFORE INSERT OR UPDATE ON public.supplier_category_links
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_category();

CREATE FUNCTION public.save_procurement_supplier(
  p_site_id uuid, p_id uuid, p_expected_version integer, p_document jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid := COALESCE(p_id, gen_random_uuid());
  v_supplier public.suppliers;
  v_contact jsonb;
  v_category jsonb;
  v_company uuid;
BEGIN
  IF public.procurement_supplier_can(p_site_id, CASE WHEN p_id IS NULL THEN 'insert' ELSE 'update' END) IS DISTINCT FROM true
    OR public.procurement_supplier_can(p_site_id, 'select') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Supplier access denied' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 OR p_expected_version >= 2147483647
    OR p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
    OR octet_length(p_document::text) > 131072
    OR NOT (p_document ?& ARRAY['name','status','company_id','commercial_terms','private_notes','contacts','category_ids'])
    OR p_document - ARRAY['name','status','company_id','commercial_terms','private_notes','contacts','category_ids'] <> '{}'::jsonb
    OR jsonb_typeof(p_document->'name') <> 'string'
    OR jsonb_typeof(p_document->'status') <> 'string'
    OR jsonb_typeof(p_document->'company_id') NOT IN ('string','null')
    OR jsonb_typeof(p_document->'commercial_terms') <> 'string'
    OR jsonb_typeof(p_document->'private_notes') <> 'string'
    OR jsonb_typeof(p_document->'contacts') <> 'array'
    OR jsonb_typeof(p_document->'category_ids') <> 'array' THEN
    RAISE EXCEPTION 'Invalid supplier document' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_document->'contacts') > 50 OR jsonb_array_length(p_document->'category_ids') > 100 THEN
    RAISE EXCEPTION 'Too many supplier references' USING ERRCODE = '22023';
  END IF;
  v_company := (p_document->>'company_id')::uuid;
  IF p_id IS NULL THEN
    IF p_expected_version <> 0 OR p_document->>'status' <> 'prospect' THEN
      RAISE EXCEPTION 'Invalid initial supplier state' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.suppliers(id,site_id,name,status,company_id,commercial_terms,private_notes,created_by)
    VALUES (v_id,p_site_id,btrim(p_document->>'name'),'prospect',v_company,
      p_document->>'commercial_terms',p_document->>'private_notes',auth.uid()) RETURNING * INTO v_supplier;
  ELSE
    -- Row lock and version predicate ensure exactly one concurrent writer wins.
    UPDATE public.suppliers SET name=btrim(p_document->>'name'),status=p_document->>'status',
      company_id=v_company,commercial_terms=p_document->>'commercial_terms',private_notes=p_document->>'private_notes',
      version=version+1,updated_at=clock_timestamp()
    WHERE id=p_id AND site_id=p_site_id AND version=p_expected_version RETURNING * INTO v_supplier;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier revision conflict' USING ERRCODE = '40001'; END IF;
  END IF;
  DELETE FROM public.supplier_contacts WHERE site_id=p_site_id AND supplier_id=v_id;
  FOR v_contact IN SELECT value FROM jsonb_array_elements(p_document->'contacts') LOOP
    IF jsonb_typeof(v_contact) <> 'object'
      OR NOT (v_contact ?& ARRAY['name','email','phone','role','is_primary'])
      OR v_contact - ARRAY['name','email','phone','role','is_primary'] <> '{}'::jsonb
      OR jsonb_typeof(v_contact->'name') <> 'string' OR jsonb_typeof(v_contact->'email') <> 'string'
      OR jsonb_typeof(v_contact->'phone') <> 'string' OR jsonb_typeof(v_contact->'role') <> 'string'
      OR jsonb_typeof(v_contact->'is_primary') <> 'boolean' THEN
      RAISE EXCEPTION 'Invalid supplier contact' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.supplier_contacts(site_id,supplier_id,name,email,phone,role,is_primary)
    VALUES (p_site_id,v_id,btrim(v_contact->>'name'),v_contact->>'email',v_contact->>'phone',
      v_contact->>'role',(v_contact->>'is_primary')::boolean);
  END LOOP;
  DELETE FROM public.supplier_category_links WHERE site_id=p_site_id AND supplier_id=v_id;
  FOR v_category IN SELECT value FROM jsonb_array_elements(p_document->'category_ids') LOOP
    IF jsonb_typeof(v_category) <> 'string' THEN
      RAISE EXCEPTION 'Invalid supplier category' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.supplier_category_links(site_id,supplier_id,category_id)
    VALUES (p_site_id,v_id,(v_category #>> '{}')::uuid);
  END LOOP;
  -- No account identity is inferred from a contact or a global company reference.
  RETURN (to_jsonb(v_supplier) - 'created_by') || jsonb_build_object(
    'contacts', p_document->'contacts', 'category_ids', p_document->'category_ids');
END;
$$;
REVOKE ALL ON FUNCTION public.save_procurement_supplier(uuid,uuid,integer,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_procurement_supplier(uuid,uuid,integer,jsonb) TO authenticated;

COMMIT;
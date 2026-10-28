BEGIN;

CREATE TABLE public.procurement_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites(id),
  tender_id uuid NOT NULL UNIQUE REFERENCES public.procurement_tenders(id),
  quotation_id uuid NOT NULL UNIQUE REFERENCES public.quotations(id),
  supplier_id uuid NOT NULL, approval_id uuid NOT NULL UNIQUE REFERENCES public.procurement_event_approvals(id),
  version integer NOT NULL DEFAULT 1 CHECK(version=1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), actor_id uuid NOT NULL,
  FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id), UNIQUE(site_id,id)
);
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites(id),
  award_id uuid NOT NULL UNIQUE REFERENCES public.procurement_awards(id),
  quotation_id uuid NOT NULL UNIQUE REFERENCES public.quotations(id),
  supplier_id uuid NOT NULL, approval_id uuid NOT NULL UNIQUE REFERENCES public.procurement_event_approvals(id),
  currency text NOT NULL, net_amount_minor bigint NOT NULL, tax_amount_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), actor_id uuid NOT NULL,
  FOREIGN KEY(site_id,supplier_id) REFERENCES public.suppliers(site_id,id), UNIQUE(site_id,id)
);
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  quotation_item_id uuid NOT NULL UNIQUE REFERENCES public.quotation_items(id),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id), name text NOT NULL,
  quantity integer NOT NULL CHECK(quantity>0), unit_net_minor bigint NOT NULL CHECK(unit_net_minor>=0),
  net_amount_minor bigint NOT NULL CHECK(net_amount_minor>=0), tax_amount_minor bigint NOT NULL CHECK(tax_amount_minor>=0),
  tax_snapshot jsonb NOT NULL
);
CREATE TABLE public.procurement_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL,
  order_id uuid NOT NULL, actor_id uuid NOT NULL, note text NOT NULL CHECK(length(note) BETWEEN 1 AND 1000),
  idempotency_key uuid NOT NULL, input jsonb NOT NULL,
  kind text NOT NULL DEFAULT 'non_stock_acceptance' CHECK(kind='non_stock_acceptance'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(site_id,idempotency_key),
  FOREIGN KEY(site_id,order_id) REFERENCES public.purchase_orders(site_id,id)
);
CREATE TABLE public.procurement_receipt_items (
  receipt_id uuid NOT NULL REFERENCES public.procurement_receipts(id),
  order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id),
  quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(receipt_id,order_item_id)
);
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['procurement_awards','purchase_orders','purchase_order_items','procurement_receipts','procurement_receipt_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',name);
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation()',name);
  END LOOP;
END $$;

CREATE FUNCTION public.procurement_validate_commerce_event(p_site uuid,p_target uuid,p_version integer,p_event text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations; t public.procurement_tenders; pub public.procurement_tender_publications; a public.procurement_awards;
BEGIN
  IF NOT public.procurement_tender_access(p_site,'update') THEN RAISE EXCEPTION 'Procurement access denied' USING ERRCODE='42501'; END IF;
  IF p_event='order' THEN
    SELECT * INTO a FROM public.procurement_awards WHERE id=p_target AND site_id=p_site FOR UPDATE;
    IF a.id IS NULL OR p_version IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'Award changed' USING ERRCODE='40001'; END IF;
    SELECT * INTO q FROM public.quotations WHERE id=a.quotation_id;
  ELSIF p_event='award' THEN
    SELECT * INTO q FROM public.quotations WHERE id=p_target AND buyer_site_id=p_site AND purpose='procurement';
    IF q.id IS NULL OR p_version IS DISTINCT FROM q.procurement_revision THEN RAISE EXCEPTION 'Quotation changed' USING ERRCODE='40001'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported commerce event' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM public.procurement_tenders WHERE id=q.procurement_tender_id AND site_id=p_site FOR UPDATE;
  SELECT * INTO pub FROM public.procurement_tender_publications WHERE tender_id=t.id ORDER BY version DESC LIMIT 1;
  IF t.id IS NULL OR t.status NOT IN ('published','closed') OR pub.id IS DISTINCT FROM q.procurement_publication_id
    OR (t.status='published' AND t.version IS DISTINCT FROM pub.version)
    OR (pub.snapshot->>'opening_at')::timestamptz>clock_timestamp()
    OR (pub.snapshot->>'participation_deadline')::timestamptz>clock_timestamp() THEN
    RAISE EXCEPTION 'Tender is not open for award or publication changed' USING ERRCODE='40001'; END IF;
  PERFORM 1 FROM public.suppliers WHERE id=q.procurement_supplier_id AND site_id=p_site AND status='approved' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier approval revoked' USING ERRCODE='42501'; END IF;
  IF q.procurement_source='buyer_recorded' OR pub.snapshot->>'participation'='invitation_only' THEN
    PERFORM 1 FROM public.procurement_tender_participants WHERE tender_id=t.id AND supplier_id=q.procurement_supplier_id AND status='invited' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invitation revoked' USING ERRCODE='42501'; END IF;
  END IF;
  IF t.request_id IS NOT NULL THEN
    PERFORM 1 FROM public.procurement_requests r WHERE r.id=t.request_id AND r.site_id=p_site AND r.status='approved'
      AND r.policy_revision=(SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=p_site) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current request approval required' USING ERRCODE='40001'; END IF;
  END IF;
  IF p_event='award' AND EXISTS(SELECT 1 FROM public.procurement_awards WHERE tender_id=t.id AND quotation_id<>q.id) THEN
    RAISE EXCEPTION 'Tender already awarded' USING ERRCODE='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.procurement_validate_commerce_event(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.procurement_materialize_commerce_event(p_approval uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE approval public.procurement_event_approvals; q public.quotations; award public.procurement_awards;
  order_id uuid; claims text;
BEGIN
  SELECT * INTO STRICT approval FROM public.procurement_event_approvals WHERE id=p_approval;
  IF approval.status<>'approved' THEN RAISE EXCEPTION 'Approval required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:'||approval.site_id::text,0));
  IF approval.policy_revision IS DISTINCT FROM (SELECT max(revision) FROM public.procurement_policy_versions WHERE site_id=approval.site_id) THEN
    RAISE EXCEPTION 'Policy changed' USING ERRCODE='40001'; END IF;
  claims:=current_setting('request.jwt.claims',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',approval.actor_id,'role','authenticated')::text,true);
  PERFORM public.procurement_validate_commerce_event(approval.site_id,approval.target_id,approval.target_version,approval.event);
  IF approval.plan->>'minimumSupplierProposals' IS NOT NULL AND
    (public.procurement_commerce_event_context(approval.site_id,approval.target_id,approval.target_version,approval.event)->>'supplier_proposals')::integer
      < (approval.plan->>'minimumSupplierProposals')::integer THEN
    RAISE EXCEPTION 'Minimum supplier proposals no longer met' USING ERRCODE='40001'; END IF;
  IF approval.event='award' THEN
    SELECT * INTO STRICT q FROM public.quotations WHERE id=approval.target_id;
    INSERT INTO public.procurement_awards(site_id,tender_id,quotation_id,supplier_id,approval_id,actor_id)
      VALUES(approval.site_id,q.procurement_tender_id,q.id,q.procurement_supplier_id,p_approval,approval.actor_id)
      ON CONFLICT(quotation_id) DO NOTHING;
  ELSIF approval.event='order' THEN
    SELECT * INTO STRICT award FROM public.procurement_awards WHERE id=approval.target_id;
    SELECT * INTO STRICT q FROM public.quotations WHERE id=award.quotation_id;
    INSERT INTO public.purchase_orders(site_id,award_id,quotation_id,supplier_id,approval_id,currency,net_amount_minor,tax_amount_minor,actor_id)
      VALUES(approval.site_id,award.id,q.id,q.procurement_supplier_id,p_approval,q.currency,q.procurement_net_minor,q.procurement_tax_minor,approval.actor_id)
      ON CONFLICT(award_id) DO NOTHING RETURNING id INTO order_id;
    IF order_id IS NOT NULL THEN
      INSERT INTO public.purchase_order_items(order_id,quotation_item_id,catalog_item_id,name,quantity,unit_net_minor,net_amount_minor,tax_amount_minor,tax_snapshot)
      SELECT order_id,id,catalog_item_id,name,quantity,procurement_unit_net_minor,procurement_net_minor,procurement_tax_minor,procurement_tax_snapshot
        FROM public.quotation_items WHERE quotation_id=q.id;
    END IF;
  END IF;
  PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
END $$;
REVOKE ALL ON FUNCTION public.procurement_materialize_commerce_event(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.finalize_procurement_event(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.procurement_event_approvals;
BEGIN
  SELECT * INTO STRICT a FROM public.procurement_event_approvals WHERE id=p_id;
  IF a.status<>'approved' THEN RAISE EXCEPTION 'Approval incomplete' USING ERRCODE='22023'; END IF;
  IF a.event='publication' THEN
    PERFORM public.procurement_materialize_tender_publication(a.site_id,a.target_id,a.target_version,a.actor_id);
  ELSIF a.event IN ('award','order') THEN
    PERFORM public.procurement_materialize_commerce_event(a.id);
  ELSE RAISE EXCEPTION 'Unsupported event' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finalize_procurement_event(uuid) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
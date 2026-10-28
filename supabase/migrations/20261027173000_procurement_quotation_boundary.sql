BEGIN;
SET LOCAL lock_timeout='5s';

CREATE SCHEMA procurement_commerce_private;
REVOKE ALL ON SCHEMA procurement_commerce_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE procurement_commerce_private.quote_writes (
  transaction_id bigint NOT NULL, quotation_id uuid NOT NULL,
  PRIMARY KEY(transaction_id,quotation_id)
);
REVOKE ALL ON procurement_commerce_private.quote_writes FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.quotations
  ADD COLUMN purpose text NOT NULL DEFAULT 'sales' CHECK(purpose IN ('sales','procurement')),
  ADD COLUMN buyer_site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  ADD COLUMN procurement_supplier_id uuid,
  ADD COLUMN procurement_tender_id uuid,
  ADD COLUMN procurement_publication_id uuid REFERENCES public.procurement_tender_publications(id) ON DELETE RESTRICT,
  ADD COLUMN procurement_revision integer,
  ADD COLUMN procurement_custodian_id uuid,
  ADD COLUMN procurement_reference text,
  ADD COLUMN procurement_idempotency_key uuid,
  ADD COLUMN procurement_input jsonb,
  ADD COLUMN procurement_source text CHECK(procurement_source IN ('buyer_recorded','supplier_submitted')),
  ADD COLUMN procurement_net_minor bigint,
  ADD COLUMN procurement_tax_minor bigint,
  ALTER COLUMN site_id DROP NOT NULL,
  ALTER COLUMN lead_id DROP NOT NULL,
  ADD CONSTRAINT quotation_procurement_supplier_fk FOREIGN KEY(buyer_site_id,procurement_supplier_id)
    REFERENCES public.suppliers(site_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT quotation_procurement_tender_fk FOREIGN KEY(buyer_site_id,procurement_tender_id)
    REFERENCES public.procurement_tenders(site_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT quotation_purpose_boundary CHECK(
    (purpose='sales' AND site_id IS NOT NULL AND lead_id IS NOT NULL AND buyer_site_id IS NULL
      AND procurement_supplier_id IS NULL AND procurement_tender_id IS NULL AND procurement_publication_id IS NULL
      AND procurement_revision IS NULL AND procurement_custodian_id IS NULL AND procurement_reference IS NULL
      AND procurement_idempotency_key IS NULL AND procurement_input IS NULL AND procurement_source IS NULL AND procurement_net_minor IS NULL AND procurement_tax_minor IS NULL)
    OR (purpose='procurement' AND site_id IS NULL AND lead_id IS NULL AND deal_id IS NULL
      AND buyer_user_id IS NULL AND price_list_id IS NULL AND location_id IS NULL AND status='draft'
      AND buyer_site_id IS NOT NULL AND procurement_supplier_id IS NOT NULL AND procurement_tender_id IS NOT NULL
      AND procurement_publication_id IS NOT NULL AND procurement_revision=1 AND procurement_custodian_id IS NOT NULL
      AND length(procurement_reference) BETWEEN 1 AND 120 AND procurement_idempotency_key IS NOT NULL
      AND procurement_input IS NOT NULL AND procurement_source IS NOT NULL AND procurement_net_minor BETWEEN 0 AND 1000000000000000
      AND procurement_tax_minor BETWEEN 0 AND 1000000000000000
      AND subtotal=procurement_net_minor::numeric/100 AND tax_total=procurement_tax_minor::numeric/100
      AND discount_total=0 AND total=subtotal+tax_total
      AND public_access_token IS NULL AND public_access_token_expires_at IS NULL AND public_access_token_revoked_at IS NULL
      AND checkout_claim_id IS NULL AND checkout_claimed_at IS NULL AND checkout_sale_id IS NULL AND checkout_order_id IS NULL)
  );
CREATE UNIQUE INDEX procurement_quote_idempotency ON public.quotations(buyer_site_id,procurement_idempotency_key) WHERE purpose='procurement';
CREATE UNIQUE INDEX procurement_quote_supplier_publication ON public.quotations(procurement_publication_id,procurement_supplier_id) WHERE purpose='procurement';
CREATE INDEX procurement_quote_buyer ON public.quotations(buyer_site_id,created_at DESC) WHERE purpose='procurement';

-- Existing workflow webhooks publish seller records; never send procurement
-- supplier assertions into that delivery plane (including through service DML).
DROP TRIGGER quotations_webhooks ON public.quotations;
CREATE TRIGGER quotations_webhooks_insert AFTER INSERT ON public.quotations FOR EACH ROW
  WHEN (NEW.purpose='sales') EXECUTE FUNCTION public.dispatch_workflow_database_webhook();
CREATE TRIGGER quotations_webhooks_update AFTER UPDATE ON public.quotations FOR EACH ROW
  WHEN (NEW.purpose='sales' AND OLD.purpose='sales') EXECUTE FUNCTION public.dispatch_workflow_database_webhook();
CREATE TRIGGER quotations_webhooks_delete AFTER DELETE ON public.quotations FOR EACH ROW
  WHEN (OLD.purpose='sales') EXECUTE FUNCTION public.dispatch_workflow_database_webhook();

ALTER TABLE public.quotation_items
  ADD COLUMN procurement_requirement_id text,
  ADD COLUMN procurement_unit_net_minor bigint,
  ADD COLUMN procurement_net_minor bigint,
  ADD COLUMN procurement_tax_minor bigint,
  ADD COLUMN procurement_tax_snapshot jsonb;

-- Procurement rows are not part of the seller/buyer checkout data plane, even
-- for a manager. The dedicated user-authorized RPCs below expose minimal DTOs.
CREATE POLICY procurement_quote_legacy_boundary ON public.quotations AS RESTRICTIVE FOR ALL
  TO PUBLIC USING(purpose='sales') WITH CHECK(purpose='sales');
CREATE FUNCTION public.is_procurement_quotation(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.quotations WHERE id=p_id AND purpose='procurement')
$$;
REVOKE ALL ON FUNCTION public.is_procurement_quotation(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_procurement_quotation(uuid) TO authenticated,service_role;
CREATE POLICY procurement_items_legacy_boundary ON public.quotation_items AS RESTRICTIVE FOR ALL
  TO PUBLIC USING(procurement_requirement_id IS NULL) WITH CHECK(procurement_requirement_id IS NULL);

-- Preserve the audited seller scope inheritance function verbatim. Only the
-- isolated procurement branch bypasses its required seller-site parent check.
DROP TRIGGER location_acl_inherit ON public.quotation_items;
CREATE TRIGGER location_acl_inherit BEFORE INSERT OR UPDATE ON public.quotation_items
  FOR EACH ROW WHEN (NOT public.is_procurement_quotation(NEW.quotation_id))
  EXECUTE FUNCTION public.location_acl_inherit_scope();

CREATE FUNCTION public.guard_procurement_quotation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP<>'INSERT' AND OLD.purpose='procurement' THEN
    RAISE EXCEPTION 'Procurement quotations are immutable' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND NEW.purpose IS DISTINCT FROM OLD.purpose THEN
    RAISE EXCEPTION 'Quotation purpose is immutable' USING ERRCODE='42501';
  END IF;
  IF NEW.purpose='procurement' AND NOT EXISTS(SELECT 1 FROM procurement_commerce_private.quote_writes
    WHERE transaction_id=txid_current() AND quotation_id=NEW.id) THEN
    RAISE EXCEPTION 'Procurement quotation writer required' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_procurement_quotation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_quote_guard BEFORE INSERT OR UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_quotation();

CREATE FUNCTION public.guard_procurement_quotation_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotations;
BEGIN
  IF TG_OP<>'INSERT' AND public.is_procurement_quotation(OLD.quotation_id) THEN
    RAISE EXCEPTION 'Procurement quotation items are immutable' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  SELECT * INTO q FROM public.quotations WHERE id=NEW.quotation_id;
  IF q.purpose='procurement' THEN
    IF NOT EXISTS(SELECT 1 FROM procurement_commerce_private.quote_writes
      WHERE transaction_id=txid_current() AND quotation_id=q.id) THEN
      RAISE EXCEPTION 'Procurement quotation writer required' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.catalog_items WHERE id=NEW.catalog_item_id AND site_id=q.buyer_site_id)
      OR NEW.quantity NOT BETWEEN 1 AND 1000000 OR NEW.procurement_requirement_id IS NULL
      OR NEW.procurement_unit_net_minor IS NULL OR NEW.procurement_tax_snapshot IS NULL
      OR NEW.procurement_net_minor IS DISTINCT FROM NEW.procurement_unit_net_minor*NEW.quantity
      OR NEW.unit_price IS DISTINCT FROM NEW.procurement_unit_net_minor::numeric/100
      OR NEW.subtotal IS DISTINCT FROM NEW.procurement_net_minor::numeric/100
      OR NEW.procurement_tax_minor IS NULL THEN
      RAISE EXCEPTION 'Invalid procurement item snapshot' USING ERRCODE='23514'; END IF;
  ELSIF NEW.procurement_requirement_id IS NOT NULL OR NEW.procurement_unit_net_minor IS NOT NULL
    OR NEW.procurement_net_minor IS NOT NULL OR NEW.procurement_tax_minor IS NOT NULL OR NEW.procurement_tax_snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Sales item cannot contain procurement state' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_procurement_quotation_item() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER procurement_item_guard BEFORE INSERT OR UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_quotation_item();

COMMIT;
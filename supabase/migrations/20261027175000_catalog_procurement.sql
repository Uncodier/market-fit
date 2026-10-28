BEGIN;

-- Sales disabling is deliberately gated until every public and POS consumer is audited.
-- is_purchasable retains its existing variant/checkout meaning.
ALTER TABLE public.catalog_items
  ADD COLUMN procurement_enabled boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_procurement_site_id_id ON public.catalog_items(site_id,id);

CREATE FUNCTION public.guard_catalog_procurement_capability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.procurement_enabled)
    OR (TG_OP = 'UPDATE' AND NEW.procurement_enabled IS DISTINCT FROM OLD.procurement_enabled) THEN
    IF public.procurement_supplier_can(NEW.site_id,'update') IS NOT TRUE THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_catalog_procurement_capability() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER catalog_procurement_capability_guard BEFORE INSERT OR UPDATE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_procurement_capability();

CREATE TABLE public.catalog_item_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  submission_key uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_unit text NOT NULL CHECK (length(btrim(purchase_unit)) BETWEEN 1 AND 80),
  units_per_purchase_unit numeric(16,6) NOT NULL CHECK (units_per_purchase_unit > 0 AND units_per_purchase_unit <= 1000000000),
  minimum_quantity numeric(16,6) NOT NULL CHECK (minimum_quantity > 0 AND minimum_quantity <= 1000000000),
  lead_time_days integer NOT NULL CHECK (lead_time_days BETWEEN 0 AND 3650),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991),
  valid_from date NOT NULL,
  valid_until date NOT NULL CHECK (valid_until >= valid_from),
  terms text NOT NULL DEFAULT '' CHECK (length(terms) <= 4000),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (site_id,submission_key),
  FOREIGN KEY (site_id,catalog_item_id) REFERENCES public.catalog_items(site_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (site_id,supplier_id) REFERENCES public.suppliers(site_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX catalog_item_suppliers_lookup ON public.catalog_item_suppliers(site_id,catalog_item_id,valid_from DESC,id);
CREATE INDEX catalog_item_suppliers_supplier ON public.catalog_item_suppliers(site_id,supplier_id);
ALTER TABLE public.catalog_item_suppliers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_item_suppliers FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.catalog_item_suppliers TO authenticated;
CREATE POLICY catalog_sourcing_read ON public.catalog_item_suppliers FOR SELECT TO authenticated
USING (public.procurement_supplier_can(site_id,'select'));
CREATE POLICY catalog_sourcing_insert ON public.catalog_item_suppliers FOR INSERT TO authenticated
WITH CHECK (public.procurement_supplier_can(site_id,'insert') AND created_by=auth.uid());

-- Dated offers are append-only. Corrections create another dated offer, retaining provenance.
CREATE FUNCTION public.guard_catalog_supplier_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Supplier offers are append-only' USING ERRCODE = '42501';
  END IF;
  IF public.procurement_supplier_can(NEW.site_id,'insert') IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.catalog_items WHERE id=NEW.catalog_item_id AND site_id=NEW.site_id
    AND status='active' AND procurement_enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item is not enabled for procurement' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.suppliers WHERE id=NEW.supplier_id AND site_id=NEW.site_id
    AND status='approved' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An approved supplier is required' USING ERRCODE='23514'; END IF;
  NEW.created_by := auth.uid();
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_catalog_supplier_offer() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER catalog_supplier_offer_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_item_suppliers
FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_supplier_offer();

COMMIT;
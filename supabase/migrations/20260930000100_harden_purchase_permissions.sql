BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Replace, rather than supplement, the membership-only ALL policies.
DROP POLICY IF EXISTS purchases_unified ON public.purchases;
DROP POLICY IF EXISTS purchase_items_unified ON public.purchase_items;
DROP POLICY IF EXISTS purchases_select ON public.purchases;
DROP POLICY IF EXISTS purchases_insert ON public.purchases;
DROP POLICY IF EXISTS purchases_update ON public.purchases;
DROP POLICY IF EXISTS purchases_delete ON public.purchases;
DROP POLICY IF EXISTS purchase_items_select ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_insert ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_update ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_delete ON public.purchase_items;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid IN ('public.purchases'::regclass, 'public.purchase_items'::regclass)) THEN
    RAISE EXCEPTION 'Unexpected purchase policies; review schema drift before applying this migration';
  END IF;
END;
$$;

REVOKE ALL ON TABLE public.purchases, public.purchase_items FROM PUBLIC, anon, authenticated;
DO $$
DECLARE target text; columns text;
BEGIN
  FOREACH target IN ARRAY ARRAY['purchases', 'purchase_items'] LOOP
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns
    FROM pg_catalog.pg_attribute
    WHERE attrelid = format('public.%I', target)::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', columns, target);
  END LOOP;
END;
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.purchases, public.purchase_items
  TO authenticated, service_role;

CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated
  USING (public.user_can(site_id, 'select'));
CREATE POLICY purchases_insert ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.user_can(site_id, 'insert'));
CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated
  USING (public.user_can(site_id, 'update')) WITH CHECK (public.user_can(site_id, 'update'));
CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated
  USING (public.user_can(site_id, 'delete'));

-- Check the parent as well as the child site, including historical mismatches.
CREATE POLICY purchase_items_select ON public.purchase_items FOR SELECT TO authenticated
  USING (public.user_can(site_id, 'select') AND EXISTS (
    SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND p.site_id = purchase_items.site_id));
CREATE POLICY purchase_items_insert ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (public.user_can(site_id, 'insert') AND EXISTS (
    SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND p.site_id = purchase_items.site_id));
CREATE POLICY purchase_items_update ON public.purchase_items FOR UPDATE TO authenticated
  USING (public.user_can(site_id, 'update') AND EXISTS (
    SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND p.site_id = purchase_items.site_id))
  WITH CHECK (public.user_can(site_id, 'update') AND EXISTS (
    SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND p.site_id = purchase_items.site_id));
CREATE POLICY purchase_items_delete ON public.purchase_items FOR DELETE TO authenticated
  USING (public.user_can(site_id, 'delete') AND EXISTS (
    SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND p.site_id = purchase_items.site_id));

-- Enforce the same invariant for privileged writers and concurrent parent edits.
-- NOT VALID avoids rewriting or repairing unknown historical financial data;
-- new relationships are enforced immediately. See the rollout guide to validate.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_id_site_id_key ON public.purchases (id, site_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.purchase_items'::regclass AND conname = 'purchase_items_purchase_site_fkey') THEN
    ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_purchase_site_fkey
      FOREIGN KEY (purchase_id, site_id) REFERENCES public.purchases (id, site_id)
      ON DELETE CASCADE NOT VALID;
  ELSIF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.purchase_items'::regclass AND conname = 'purchase_items_purchase_site_fkey'
      AND contype = 'f' AND confrelid = 'public.purchases'::regclass
      AND confdeltype = 'c' AND confupdtype = 'a' AND confmatchtype = 's' AND NOT condeferrable
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = 'public.purchase_items'::regclass AND attname = 'purchase_id'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = 'public.purchase_items'::regclass AND attname = 'site_id')]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = 'public.purchases'::regclass AND attname = 'id'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = 'public.purchases'::regclass AND attname = 'site_id')]) THEN
    RAISE EXCEPTION 'Unexpected purchase_items_purchase_site_fkey definition';
  END IF;
END;
$$;

-- The composite key replaces the weaker relationship. Keeping both would make
-- existing PostgREST purchase_items(...) embeds ambiguous after schema reload.
ALTER TABLE public.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_purchase_id_fkey;
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE contype = 'f'
    AND conrelid = 'public.purchase_items'::regclass AND confrelid = 'public.purchases'::regclass) <> 1 THEN
    RAISE EXCEPTION 'Unexpected additional purchase relationship; review before reloading the API schema';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
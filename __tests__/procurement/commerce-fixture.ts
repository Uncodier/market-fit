import { installRequestsFixture, itemId } from './requests-fixture'
import { isolatedPostgres, migration, uuid, ids } from '../security/isolated-postgres'
import { sqlJson, saveSql } from './storage-fixture'
import { defaultPolicyDocument } from '@/app/purchases/procurement/domain'

export { ids, uuid, itemId }
export const supplierId = uuid(801)
export const tenderId = uuid(802)
export const publicationId = uuid(803)
export const requirementId = uuid(804)
export const quoteDocument = { supplier_id: supplierId, tender_id: tenderId, publication_id: publicationId,
  reference: 'Supplier PDF 123', idempotency_key: uuid(805), lines: [{ requirement_id: requirementId, unit_net_minor: 1234 }] }
export const recordQuote = (document: unknown = quoteDocument) => `SELECT public.record_procurement_quotation('${ids.site}',${sqlJson(document)});`

export function installCommerceFixture(pg: ReturnType<typeof isolatedPostgres>, realSuppliers = false) {
  pg.db('DROP SCHEMA IF EXISTS procurement_commerce_private CASCADE;')
  installRequestsFixture(pg)
  if (realSuppliers) {
    pg.db('CREATE TABLE public.companies(id uuid PRIMARY KEY,name text); ALTER TABLE public.catalog_categories ADD COLUMN name text;')
    pg.db(migration('20261027170000_procurement_suppliers.sql'))
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}"}'; INSERT INTO public.suppliers(id,site_id,name,status,created_by) VALUES('${supplierId}','${ids.site}','Supplier','approved','${ids.owner}');`)
  } else {
    pg.db(`CREATE TABLE public.suppliers(id uuid PRIMARY KEY,site_id uuid NOT NULL,name text,status text,UNIQUE(site_id,id));
      INSERT INTO public.suppliers VALUES('${supplierId}','${ids.site}','Supplier','approved');`)
  }
  pg.db(`
    CREATE TABLE public.quotations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES sites,
      lead_id uuid NOT NULL,deal_id uuid,buyer_user_id uuid,price_list_id uuid,location_id uuid,
      status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
      currency text NOT NULL DEFAULT 'USD',subtotal numeric NOT NULL DEFAULT 0,discount_total numeric NOT NULL DEFAULT 0,
      tax_total numeric NOT NULL DEFAULT 0,total numeric NOT NULL DEFAULT 0,notes text,valid_until timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
      public_access_token text,public_access_token_expires_at timestamptz,public_access_token_revoked_at timestamptz,
      checkout_claim_id uuid,checkout_claimed_at timestamptz,checkout_sale_id uuid,checkout_order_id uuid);
    CREATE TABLE public.quotation_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quotation_id uuid NOT NULL REFERENCES quotations,
      catalog_item_id uuid NOT NULL REFERENCES catalog_items,name text NOT NULL,quantity integer NOT NULL DEFAULT 1,
      unit_price numeric NOT NULL DEFAULT 0,subtotal numeric NOT NULL DEFAULT 0,metadata jsonb);
    ALTER TABLE quotations ENABLE ROW LEVEL SECURITY; ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON quotations,quotation_items TO authenticated,service_role;
    CREATE POLICY legacy ON quotations FOR ALL USING(true) WITH CHECK(true);
    CREATE POLICY legacy ON quotation_items FOR ALL USING(true) WITH CHECK(true);
    CREATE TABLE webhook_calls(id uuid);
    CREATE FUNCTION public.dispatch_workflow_database_webhook() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO public.webhook_calls VALUES(COALESCE(NEW.id,OLD.id)); RETURN COALESCE(NEW,OLD); END $$;
    CREATE TRIGGER quotations_webhooks AFTER INSERT OR DELETE OR UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION dispatch_workflow_database_webhook();
    CREATE FUNCTION public.location_acl_inherit_scope() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NOT EXISTS(SELECT 1 FROM public.quotations WHERE id=NEW.quotation_id AND site_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Operational parent unavailable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER location_acl_inherit BEFORE INSERT OR UPDATE ON quotation_items FOR EACH ROW EXECUTE FUNCTION location_acl_inherit_scope();
    CREATE FUNCTION public.location_acl_visible_quotation_items() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
      BEGIN IF current_setting('role',true)<>'authenticated' THEN RETURN NEW; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.quotations WHERE id=NEW.quotation_id) THEN
        RAISE EXCEPTION 'Operational parent unavailable' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER location_acl_10_visible BEFORE INSERT OR UPDATE ON quotation_items
      FOR EACH ROW EXECUTE FUNCTION location_acl_visible_quotation_items();`)
  for (const file of ['20261027172000_procurement_tenders.sql', '20261027172001_procurement_tender_publications.sql',
    '20261027172002_procurement_event_approvals.sql', '20261027173000_procurement_quotation_boundary.sql',
    '20261027173001_procurement_quotation_capture.sql', '20261027173002_procurement_orders.sql',
    '20261027173003_procurement_commerce_approvals.sql', '20261027173004_procurement_commerce_reads.sql',
    '20261027173005_procurement_supplier_submissions.sql']) pg.db(migration(file))
  // Privileged bodies run as a non-superuser owner, including real RLS visibility
  // inside the legacy SECURITY INVOKER parent trigger.
  pg.db(`GRANT USAGE ON SCHEMA procurement_commerce_private TO postgres;
    GRANT ALL ON ALL TABLES IN SCHEMA public,procurement_commerce_private TO postgres;
    DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
  pg.call(saveSql(0, defaultPolicyDocument()))
  const requirements = [{ id: requirementId, description: 'Equipment', quantity: 2, unit: 'each', unit_net_minor: 1234, catalog_item_id: itemId }]
  pg.db(`INSERT INTO public.procurement_tenders(id,site_id,title,description,visibility,participation,opening_policy,
    participation_deadline,opening_at,currency,requirements,net_amount_minor,created_by,status)
    VALUES('${tenderId}','${ids.site}','Tender','Tender description','private','invitation_only','after_close',now()+interval '1 day',
      now()+interval '1 day','USD',${sqlJson(requirements)},2468,'${ids.owner}','published');
    INSERT INTO public.procurement_tender_publications(id,site_id,tender_id,version,visibility,global_visible,published_by,policy_revision,snapshot)
    VALUES('${publicationId}','${ids.site}','${tenderId}',1,'private',false,'${ids.owner}',1,jsonb_build_object(
      'title','Tender','currency','USD','requirements',${sqlJson(requirements)},
      'participation_deadline',now()+interval '1 day','opening_at',now()+interval '1 day','opening_policy','after_close','participation','invitation_only'));
    INSERT INTO public.procurement_tender_participants(site_id,tender_id,supplier_id,invited_by)
      VALUES('${ids.site}','${tenderId}','${supplierId}','${ids.owner}');`)
}

export function openAward(pg: ReturnType<typeof isolatedPostgres>) {
  // Synthetic database-owner clock fixture only; application roles cannot amend publications.
  pg.db(`SET session_replication_role=replica;
    UPDATE procurement_tender_publications SET snapshot=jsonb_set(jsonb_set(snapshot,'{opening_at}',to_jsonb(now()-interval '1 second')),
    '{participation_deadline}',to_jsonb(now()-interval '1 second')); SET session_replication_role=origin;`)
}
export const approve = (target: string, event: 'award' | 'order') => `SELECT public.create_procurement_commerce_approval('${ids.site}','${target}',1,'${event}',
  '${ids.owner}',1,'{"status":"ready","stages":[],"requirements":[],"minimumSupplierProposals":null}');`
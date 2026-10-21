import { readdirSync } from 'node:fs'
import { installLocationFixture, locationIds, replaceLocations } from './location-access-fixture'
import { isolatedPostgres, migration, uuid } from './isolated-postgres'

export const enforcementIds = { ...locationIds, item: uuid(301), otherItem: uuid(302),
  allowed: uuid(401), denied: uuid(402), unresolved: uuid(403), other: uuid(404),
  child: uuid(501), deniedChild: uuid(502), newRow: uuid(601), thirdLocation: uuid(204) }
export const enforcementMigrations = readdirSync('supabase/migrations')
  .filter(file => /^2026102003000\d_/.test(file)).sort()
const roots = ['deals','quotations','subscriptions','tasks','conversations','records','sale_orders',
  'reservations','sales','purchases','transactions','inventory_levels','pos_register_sessions','shipments']
const children: Record<string, string> = {
  sale_order_items: 'sale_order_id uuid,location_id uuid',
  sale_order_item_units: 'sale_order_item_id uuid,shipment_id uuid',
  quotation_items: 'quotation_id uuid', purchase_items: 'purchase_id uuid',
  messages: 'conversation_id uuid,lead_id uuid', shipment_location_pings: 'shipment_id uuid',
  pos_register_movements: 'session_id uuid', pos_register_receipts: 'session_id uuid,sale_id uuid',
  task_comments: 'task_id uuid',task_categories: 'task_id uuid',
  accounting_sale_refunds: 'sale_id uuid',invoice_reminders: 'sale_id uuid',
}
const noSiteChildren = ['messages','quotation_items','task_comments','task_categories']
const exactFunction = (file: string, declaration: string) => {
  const sql = migration(file)
  return sql.slice(sql.indexOf(declaration)).split('$$;')[0] + '$$;'
}
export function installEnforcementFixture(pg: ReturnType<typeof isolatedPostgres>, ready = true) {
  const i = enforcementIds
  pg.db('DROP SCHEMA IF EXISTS location_acl_private CASCADE; DROP SCHEMA IF EXISTS storage CASCADE')
  installLocationFixture(pg)
  const permissions = migration('20260825160000_fix_site_role_and_delete_caps.sql')
  pg.db(permissions.slice(permissions.indexOf('CREATE OR REPLACE FUNCTION public.user_can(')).split('$$;')[0] + '$$;')
  pg.db('ALTER TABLE site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false')
  pg.db(`CREATE TABLE public.catalog_items(id uuid PRIMARY KEY,site_id uuid REFERENCES sites,name text);
    CREATE TABLE public.leads(id uuid PRIMARY KEY,site_id uuid REFERENCES sites,notes text);
    CREATE TABLE public.reports(id uuid PRIMARY KEY,site_id uuid REFERENCES sites,payload jsonb);
    CREATE TABLE public.opaque_projection(id uuid PRIMARY KEY,payload jsonb);
    CREATE TABLE public.legacy_no_rls(id uuid PRIMARY KEY,site_id uuid,payload jsonb);
    CREATE TABLE public.buyer_documents(id uuid PRIMARY KEY,site_id uuid,buyer_user_id uuid,public_title text);
    CREATE TABLE public.deal_leads(id uuid PRIMARY KEY,deal_id uuid,lead_id uuid);
    CREATE TABLE public.deal_owners(id uuid PRIMARY KEY,deal_id uuid,user_id uuid);
    ${roots.map(table => `CREATE TABLE public.${table}(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES sites, payload text,
      ${['sales','purchases','transactions','inventory_levels','pos_register_sessions'].includes(table) ? 'location_id uuid,' : ''}
      ${table === 'quotations' ? 'deal_id uuid,' : ''}
      ${table === 'tasks' ? 'deal_id uuid,conversation_id uuid,lead_id uuid,' : ''}
      ${table === 'records' ? 'relations jsonb,source_id uuid,' : ''}
      ${table === 'sale_orders' ? 'sale_id uuid,' : ''}
      ${table === 'shipments' ? 'origin_location_id uuid,sale_order_id uuid,sale_id uuid,' : ''}
      ${table === 'inventory_levels' ? 'catalog_item_id uuid,quantity numeric DEFAULT 0,updated_at timestamptz DEFAULT now(),UNIQUE(catalog_item_id,location_id),' : ''}
      created_at timestamptz DEFAULT now());`).join('\n')}
    ${Object.entries(children).map(([table, columns]) => `CREATE TABLE public.${table}
      (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${noSiteChildren.includes(table) ? '' : 'site_id uuid REFERENCES sites,'}${columns},payload text);`).join('\n')}
    ALTER TABLE purchase_items ADD FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;
    ALTER TABLE sale_orders ADD FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE SET NULL;
    CREATE FUNCTION public.private_rollup(p_site_id uuid DEFAULT NULL) RETURNS bigint LANGUAGE sql
      STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT count(*) FROM public.reports $$;
    CREATE FUNCTION public.private_rows() RETURNS TABLE(id uuid,payload text) LANGUAGE sql
      STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT id,payload FROM public.deals $$;
    CREATE FUNCTION public.private_out(OUT total bigint) LANGUAGE sql
      STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT count(*) FROM public.reports $$;
    CREATE FUNCTION public.private_inout(INOUT total bigint) LANGUAGE sql
      STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT total + count(*) FROM public.reports $$;
    CREATE FUNCTION public.service_only() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 7 $$;
    REVOKE ALL ON FUNCTION public.service_only() FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.service_only() TO service_role;
    CREATE VIEW public.private_deal_view AS SELECT * FROM public.deals;
    CREATE VIEW public.invoker_deal_view WITH (security_invoker=true) AS SELECT * FROM public.deals;
    CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text);
    GRANT ALL ON storage.objects TO anon,authenticated,service_role;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY old_storage_policy ON storage.objects USING(true) WITH CHECK(true);`)
  pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,anon,service_role;
    REVOKE ALL ON public.location_access_rollout,public.site_member_location_restrictions,
      public.site_member_location_restriction_audit FROM authenticated,anon,service_role;
    GRANT SELECT ON public.site_member_location_restrictions,public.site_member_location_restriction_audit TO authenticated;
    ${[...roots,...Object.keys(children).filter(t => !noSiteChildren.includes(t)),'locations','catalog_items','leads','reports'].map(table => `
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY legacy_read ON public.${table} FOR SELECT TO authenticated USING(public.user_can(site_id,'select'));
      CREATE POLICY legacy_insert ON public.${table} FOR INSERT TO authenticated WITH CHECK(public.user_can(site_id,'insert'));
      CREATE POLICY legacy_update ON public.${table} FOR UPDATE TO authenticated USING(public.user_can(site_id,'update')) WITH CHECK(public.user_can(site_id,'update'));
      CREATE POLICY legacy_delete ON public.${table} FOR DELETE TO authenticated USING(public.user_can(site_id,'delete'));
      CREATE POLICY independent_public ON public.${table} FOR SELECT TO anon USING(true);`).join('\n')}
    ${['opaque_projection','deal_leads','deal_owners',...noSiteChildren].map(table => `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY old_projection ON public.${table} TO authenticated USING(true) WITH CHECK(true);`).join('\n')}
    ALTER TABLE buyer_documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY buyer_identity ON buyer_documents FOR SELECT TO authenticated USING(buyer_user_id=auth.uid());
    CREATE FUNCTION public.buyer_document(p_id uuid,p_actor uuid) RETURNS jsonb LANGUAGE sql
      SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('id',id,'title',public_title)
      FROM public.buyer_documents WHERE id=p_id AND buyer_user_id=p_actor $$;
    REVOKE ALL ON FUNCTION public.buyer_document(uuid,uuid) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.buyer_document(uuid,uuid) TO service_role;`)
  pg.db(exactFunction('20260820000000_team_member_restrict_assigned.sql','CREATE OR REPLACE FUNCTION public.is_deal_owner('))
  pg.db(exactFunction('20260916020700_records_access_hardening.sql','CREATE OR REPLACE FUNCTION public.can_access_record_values('))
  for (const file of enforcementMigrations) {
    if (ready || !file.includes('30009_')) pg.db(migration(file))
  }
  pg.db(`INSERT INTO catalog_items VALUES('${i.item}','${i.site}','Widget'),('${i.otherItem}','${i.otherSite}','Other');
    INSERT INTO locations(id,site_id) VALUES('${i.thirdLocation}','${i.site}');
    INSERT INTO leads VALUES('${i.allowed}','${i.site}','Global private notes');
    INSERT INTO reports VALUES('${i.allowed}','${i.site}','{"secret":true}');
    INSERT INTO opaque_projection VALUES('${i.allowed}','{"secret":true}');
    INSERT INTO legacy_no_rls VALUES('${i.allowed}','${i.site}','{"secret":true}');
    INSERT INTO buyer_documents VALUES('${i.allowed}','${i.site}','${i.member}','My purchase'),
      ('${i.denied}','${i.site}','${i.viewer}','Other purchase');
    INSERT INTO storage.objects VALUES('${i.allowed}','private/file.pdf');
    ${roots.filter(t => t !== 'inventory_levels').map(table => {
      const location = table === 'reservations' ? 'operating_location_id' : table === 'shipments' ? 'origin_location_id' : 'location_id'
      return `INSERT INTO ${table}(id,site_id,${location}) VALUES
        ('${i.allowed}','${i.site}','${i.location}'),('${i.denied}','${i.site}','${i.secondLocation}'),
        ('${i.unresolved}','${i.site}',NULL),('${i.other}','${i.otherSite}','${i.foreignLocation}');`
    }).join('\n')}
    INSERT INTO inventory_levels(id,site_id,catalog_item_id,location_id,quantity) VALUES
      ('${i.allowed}','${i.site}','${i.item}','${i.location}',20),
      ('${i.denied}','${i.site}','${i.item}','${i.secondLocation}',10);
    INSERT INTO purchase_items(id,site_id,purchase_id) VALUES
      ('${i.child}','${i.site}','${i.allowed}'),('${i.deniedChild}','${i.site}','${i.denied}');
    INSERT INTO messages(id,conversation_id) VALUES
      ('${i.child}','${i.allowed}'),('${i.deniedChild}','${i.denied}');
    INSERT INTO sale_order_items(id,site_id,sale_order_id) VALUES
      ('${i.child}','${i.site}','${i.allowed}'),('${i.deniedChild}','${i.site}','${i.denied}');
    INSERT INTO sale_order_item_units(id,site_id,sale_order_item_id) VALUES
      ('${i.child}','${i.site}','${i.child}'),('${i.deniedChild}','${i.site}','${i.deniedChild}');
    INSERT INTO task_comments(id,task_id) VALUES
      ('${i.child}','${i.allowed}'),('${i.deniedChild}','${i.denied}');
    INSERT INTO deal_owners VALUES('${i.child}','${i.allowed}','${i.member}');`)
}
export function restrictEnforcementMember(pg: ReturnType<typeof isolatedPostgres>) {
  pg.call(replaceLocations([enforcementIds.secondLocation]))
}
import { randomUUID } from 'node:crypto'
import { actorSql, isolatedPostgres, migration } from './isolated-postgres'
import { i as legacyIds, installReviewFixture } from './location-review-fixture'

export const commerceTables = ['deals', 'subscriptions', 'quotations', 'sales',
  'sale_orders', 'shipments', 'sale_order_items'] as const
export const planningMigration = () => migration('20261021233000_bound_commerce_rls_planning.sql')
export type Pg = ReturnType<typeof isolatedPostgres>

/** Reuse real chronological policy installers, but generate every identity locally. */
export function installCommerceFixture(native: Pg) {
  const replacements = new Map<string, string>()
  const translate = (sql: string) => sql.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    value => {
      if (!replacements.has(value)) replacements.set(value, randomUUID())
      return replacements.get(value)!
    })
  native.db('DROP SCHEMA IF EXISTS commerce_rls_private CASCADE')
  const pg: Pg = { ...native, db(sql) {
    if (sql === migration('20261020030002_location_enforcement_policies.sql')) {
      native.db('ALTER TABLE public.sale_order_items ADD COLUMN parent_sale_order_item_id uuid')
    }
    return native.db(translate(sql))
  }, call(sql, user, role) { return native.db(translate(actorSql(sql, user, role))) } }
  installReviewFixture(pg)
  const ids = Object.fromEntries(Object.entries(legacyIds).map(([key, value]) =>
    [key, translate(value)])) as typeof legacyIds
  const extra = Object.fromEntries(['inactive', 'disabled', 'suspended', 'invalid', 'hidden',
    'hiddenLink', 'crossSite', 'dangling', 'nullLink', 'parentItem', 'sideShipment', 'missing',
    'ownerElsewhere', 'ownerElsewhereMember'].map(key => [key, randomUUID()]))
  native.db(`INSERT INTO site_members(id,site_id,user_id,role,status,manually_disabled,license_suspended)
    VALUES ('${randomUUID()}','${ids.site}','${extra.inactive}','collaborator','inactive',false,false),
      ('${randomUUID()}','${ids.site}','${extra.disabled}','collaborator','active',true,false),
      ('${randomUUID()}','${ids.site}','${extra.suspended}','collaborator','active',false,true),
      ('${randomUUID()}','${ids.site}','${extra.invalid}','collaborator','active',false,false);
    INSERT INTO site_members(id,site_id,user_id,role,status) VALUES
      ('${extra.ownerElsewhereMember}','${ids.otherSite}','${ids.owner}','collaborator','active');
    INSERT INTO site_member_location_restrictions(site_id,site_member_id,location_id) VALUES
      ('${ids.site}','${ids.memberRow}','${ids.secondLocation}'),
      ('${ids.otherSite}','${extra.ownerElsewhereMember}','${ids.foreignLocation}');
    INSERT INTO deals(id,site_id,location_id,payload) VALUES
      ('${extra.hidden}','${ids.site}','${ids.location}','hidden');
    CREATE POLICY independent_parent_visibility ON deals AS RESTRICTIVE FOR SELECT
      TO authenticated USING(payload IS DISTINCT FROM 'hidden');
    SET session_replication_role=replica;
    ${[ids.allowed, ids.denied, ids.unresolved, ids.other].map(id => `
      UPDATE quotations SET deal_id='${id}' WHERE id='${id}';
      UPDATE sales SET quotation_id='${id}',subscription_id='${id}' WHERE id='${id}';
      UPDATE sale_orders SET quotation_id='${id}',sale_id='${id}' WHERE id='${id}';
      UPDATE shipments SET sale_order_id='${id}',sale_id='${id}' WHERE id='${id}';`).join('\n')}
    INSERT INTO quotations(id,site_id,location_id,deal_id) VALUES
      ('${extra.hiddenLink}','${ids.site}','${ids.location}','${extra.hidden}'),
      ('${extra.crossSite}','${ids.site}','${ids.location}','${ids.other}'),
      ('${extra.dangling}','${ids.site}','${ids.location}','${extra.missing}'),
      ('${extra.nullLink}','${ids.site}',NULL,'${ids.unresolved}');
    UPDATE sale_order_items SET shipment_id='${ids.allowed}' WHERE id='${ids.child}';
    INSERT INTO sale_order_items(id,site_id,sale_order_id,shipment_id,location_id,parent_sale_order_item_id)
      VALUES ('${extra.parentItem}','${ids.site}','${ids.allowed}',NULL,'${ids.location}','${ids.child}'),
        ('${extra.sideShipment}','${ids.site}','${ids.allowed}','${ids.denied}','${ids.location}',NULL);
    SET session_replication_role=origin;`)
  return { ids, extra }
}

export const policySnapshot = `SET search_path=pg_catalog; SELECT coalesce(jsonb_agg(jsonb_build_object(
  'table',c.relname,'name',p.polname,'oid',p.oid,'roles',p.polroles,'command',p.polcmd,
  'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),
  'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY c.relname,p.polname),'[]')
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`

export function outcome(pg: Pg, sql: string, user: string, role = 'authenticated') {
  try { return { rows: pg.call(`BEGIN; ${sql}; ROLLBACK;`, user, role), state: 'ok' } }
  catch (error) {
    // SQLSTATE is stable across policy expression/context changes, unlike CONTEXT text.
    const stderr = String((error as { stderr?: Buffer }).stderr || error)
    return { rows: '', state: stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] || stderr.split('\n')[0] }
  }
}

export function insertProbe(table: string, ids: typeof legacyIds, denied = false) {
  const location = denied ? ids.secondLocation : ids.location
  const parent = denied ? ids.denied : ids.allowed
  const scope = table === 'shipments' ? 'origin_location_id' : 'location_id'
  const links = table === 'shipments' ? `,sale_order_id` : table === 'sale_order_items' ? ',sale_order_id' : ''
  return `INSERT INTO public.${table}(site_id,${scope}${links})
    VALUES('${ids.site}','${location}'${links ? `,'${parent}'` : ''}) RETURNING site_id`
}

export function populateCommerceGraph(pg: Pg, ids: typeof legacyIds, count = 20) {
  pg.db(Array.from({ length: count }, () => {
    const [deal, subscription, quotation, sale, order, shipment, item] = commerceTables.map(() => randomUUID())
    return `INSERT INTO deals(id,site_id,location_id) VALUES('${deal}','${ids.site}','${ids.location}');
      INSERT INTO subscriptions(id,site_id,location_id) VALUES('${subscription}','${ids.site}','${ids.location}');
      INSERT INTO quotations(id,site_id,location_id,deal_id) VALUES('${quotation}','${ids.site}','${ids.location}','${deal}');
      INSERT INTO sales(id,site_id,location_id,quotation_id,subscription_id) VALUES
        ('${sale}','${ids.site}','${ids.location}','${quotation}','${subscription}');
      INSERT INTO sale_orders(id,site_id,location_id,quotation_id,sale_id) VALUES
        ('${order}','${ids.site}','${ids.location}','${quotation}','${sale}');
      INSERT INTO shipments(id,site_id,origin_location_id,sale_order_id,sale_id) VALUES
        ('${shipment}','${ids.site}','${ids.location}','${order}','${sale}');
      INSERT INTO sale_order_items(id,site_id,sale_order_id,shipment_id,location_id) VALUES
        ('${item}','${ids.site}','${order}','${shipment}','${ids.location}');`
  }).join('\n'))
}

/** Each DML runs in a rolled-back subtransaction; returned IDs/errors are retained. */
export function permissionSnapshot(pg: Pg, ids: typeof legacyIds, user: string, role = 'authenticated') {
  const probes = commerceTables.flatMap(table => [
    [`${table}:select`, `SELECT id FROM public.${table}`],
    [`${table}:insert`, insertProbe(table, ids)],
    [`${table}:insert-denied`, insertProbe(table, ids, true)],
    [`${table}:update`, `UPDATE public.${table} SET payload='probe' RETURNING id`],
    [`${table}:delete`, `DELETE FROM public.${table} WHERE id='${table === 'sale_order_items' ? ids.child : ids.allowed}' RETURNING id`],
  ])
  const encoded = JSON.stringify(probes.map(([label, sql]) => ({ label, sql }))).replace(/'/g, "''")
  return JSON.parse(pg.db(`CREATE TEMP TABLE probe_results(label text,rows text,state text);
    GRANT ALL ON probe_results TO authenticated,anon,service_role;
    ${actorSql('', user, role)}
    DO $probe$ DECLARE probe jsonb; result text; error_state text; BEGIN
      FOR probe IN SELECT value FROM jsonb_array_elements('${encoded}'::jsonb) LOOP
        result := NULL; error_state := 'ok';
        BEGIN
          IF probe->>'label' LIKE '%:select' THEN
            EXECUTE format('SELECT coalesce(string_agg(id::text,'','' ORDER BY id),'''') FROM (%s) q',probe->>'sql') INTO result;
          ELSE
            EXECUTE format('WITH changed AS (%s) SELECT count(*)::text FROM changed',probe->>'sql') INTO result;
          END IF;
          RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='synthetic rollback';
        EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
          WHEN OTHERS THEN GET STACKED DIAGNOSTICS error_state=RETURNED_SQLSTATE;
        END;
        INSERT INTO probe_results VALUES(probe->>'label',result,error_state);
      END LOOP;
    END $probe$;
    RESET ROLE; SELECT jsonb_agg(to_jsonb(r) ORDER BY label) FROM probe_results r;`))
}
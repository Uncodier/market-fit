import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { actorSql } from './isolated-postgres'
import { installCommerceFixture, planningMigration, type Pg } from './commerce-planning-fixture'

export const operationalTables = ['conversations', 'tasks', 'reservations', 'sale_order_item_units',
  'messages', 'task_comments', 'task_categories', 'shipment_location_pings',
  'inventory_levels', 'transactions', 'pos_register_receipts'] as const
export const operationalMigration = () => readFileSync(path.join(process.cwd(),
  'docs/experiments/bound-operational-rls-planning.sql'), 'utf8')

/** Actual chronological installers, including the already-applied commerce barrier. */
export function installOperationalFixture(pg: Pg) {
  pg.db('DROP SCHEMA IF EXISTS operational_rls_private CASCADE')
  const fixture = installCommerceFixture(pg)
  pg.db(planningMigration())
  const { ids, extra } = fixture
  pg.db(`SET session_replication_role=replica;
    UPDATE tasks SET deal_id=id,conversation_id=id WHERE id IN ('${ids.allowed}','${ids.denied}','${ids.other}');
    UPDATE reservations SET sale_order_item_id='${ids.child}' WHERE id='${ids.allowed}';
    UPDATE reservations SET sale_order_item_id='${ids.deniedChild}' WHERE id='${ids.denied}';
    UPDATE sale_order_item_units SET shipment_id='${ids.allowed}' WHERE id='${ids.child}';
    INSERT INTO task_categories(id,task_id) VALUES('${ids.child}','${ids.allowed}'),('${ids.deniedChild}','${ids.denied}');
    INSERT INTO shipment_location_pings(id,site_id,shipment_id) VALUES
      ('${ids.child}','${ids.site}','${ids.allowed}'),('${ids.deniedChild}','${ids.site}','${ids.denied}');
    INSERT INTO pos_register_receipts(id,site_id,session_id,sale_id) VALUES
      ('${ids.child}','${ids.site}','${ids.allowed}','${ids.allowed}'),
      ('${ids.deniedChild}','${ids.site}','${ids.denied}','${ids.denied}');
    UPDATE transactions SET sale_order_id=id WHERE id IN ('${ids.allowed}','${ids.denied}','${ids.other}');
    INSERT INTO conversations(id,site_id,location_id,payload) VALUES
      ('${extra.hidden}','${ids.site}','${ids.location}','hidden');
    CREATE POLICY independent_conversation_visibility ON conversations AS RESTRICTIVE FOR SELECT
      TO authenticated USING(payload IS DISTINCT FROM 'hidden');
    INSERT INTO messages(id,conversation_id) VALUES('${extra.hiddenLink}','${extra.hidden}'),
      ('${extra.crossSite}','${ids.other}'),('${extra.dangling}','${extra.missing}'),('${extra.nullLink}',NULL);
    INSERT INTO tasks(id,site_id,location_id,conversation_id) VALUES
      ('${extra.hiddenLink}','${ids.site}','${ids.location}','${extra.hidden}'),
      ('${extra.crossSite}','${ids.site}','${ids.location}','${ids.other}'),
      ('${extra.dangling}','${ids.site}','${ids.location}','${extra.missing}');
    SET session_replication_role=origin;`)
  return fixture
}

/** Each mutation is rolled back; SQLSTATE and affected row counts remain observable. */
export function operationalSnapshot(pg: Pg, fixture: ReturnType<typeof installOperationalFixture>, user: string, role = 'authenticated') {
  const { ids } = fixture
  const probes = operationalTables.flatMap(table => {
    const root = ['conversations', 'tasks', 'reservations', 'inventory_levels', 'transactions'].includes(table)
    const allowed = root ? ids.allowed : ids.child
    const denied = root ? ids.denied : ids.deniedChild
    const columns: string[] = JSON.parse(pg.db(`SELECT json_agg(attname ORDER BY attnum) FROM pg_attribute
      WHERE attrelid='public.${table}'::regclass AND attnum>0 AND NOT attisdropped`))
    const insert = (source: string) => {
      // Capture values as the fixture owner so a denied actor still attempts the
      // actual INSERT WITH CHECK (INSERT SELECT from a hidden row would test zero rows).
      const row = JSON.parse(pg.db(`SELECT to_jsonb(t) FROM public.${table} t WHERE id='${source}'`))
      return `INSERT INTO public.${table}(${columns.join(',')}) VALUES (${columns.map(column =>
        column === 'id' ? 'gen_random_uuid()' : column === 'location_id' && table === 'inventory_levels' && source === allowed
          ? `'${ids.thirdLocation}'::uuid` : row[column] === null ? 'NULL' : `'${String(row[column]).replace(/'/g, "''")}'`).join(',')}) RETURNING id`
    }
    return [
      { label: `${table}:select`, sql: `SELECT id FROM public.${table}` },
      { label: `${table}:insert`, sql: insert(allowed) },
      { label: `${table}:insert-denied`, sql: insert(denied) },
      { label: `${table}:update`, sql: `UPDATE public.${table} SET payload='probe' RETURNING id` },
      { label: `${table}:move-denied`, sql: `UPDATE public.${table} SET ${
        root ? (table === 'reservations' ? 'operating_location_id' : 'location_id') :
          table === 'messages' ? 'conversation_id' : table.startsWith('task_') ? 'task_id' :
            table === 'sale_order_item_units' ? 'sale_order_item_id' :
              table === 'shipment_location_pings' ? 'shipment_id' : 'session_id'}='${
        root ? ids.secondLocation : table === 'sale_order_item_units' ? ids.deniedChild : ids.denied}' WHERE id='${allowed}' RETURNING id` },
      { label: `${table}:delete`, sql: `DELETE FROM public.${table} WHERE id='${allowed}' RETURNING id` },
    ]
  })
  const encoded = JSON.stringify(probes).replace(/'/g, "''")
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
    RESET ROLE; SELECT jsonb_agg(to_jsonb(r) ORDER BY label) FROM probe_results r;`)) as Array<{ label: string; rows: string; state: string }>
}

export function populateOperationalGraph(pg: Pg, ids: ReturnType<typeof installOperationalFixture>['ids'], count = 20) {
  pg.db(Array.from({ length: count }, () => {
    const [deal, sub, quote, sale, order, shipment, item, conversation, task, reservation, unit, message] =
      Array.from({ length: 12 }, () => randomUUID())
    return `INSERT INTO deals(id,site_id,location_id) VALUES('${deal}','${ids.site}','${ids.location}');
      INSERT INTO subscriptions(id,site_id,location_id) VALUES('${sub}','${ids.site}','${ids.location}');
      INSERT INTO quotations(id,site_id,location_id,deal_id) VALUES('${quote}','${ids.site}','${ids.location}','${deal}');
      INSERT INTO sales(id,site_id,location_id,quotation_id,subscription_id) VALUES('${sale}','${ids.site}','${ids.location}','${quote}','${sub}');
      INSERT INTO sale_orders(id,site_id,location_id,sale_id,quotation_id) VALUES('${order}','${ids.site}','${ids.location}','${sale}','${quote}');
      INSERT INTO shipments(id,site_id,origin_location_id,sale_order_id,sale_id) VALUES('${shipment}','${ids.site}','${ids.location}','${order}','${sale}');
      INSERT INTO sale_order_items(id,site_id,location_id,sale_order_id,shipment_id) VALUES('${item}','${ids.site}','${ids.location}','${order}','${shipment}');
      INSERT INTO conversations(id,site_id,location_id) VALUES('${conversation}','${ids.site}','${ids.location}');
      INSERT INTO tasks(id,site_id,location_id,conversation_id,deal_id) VALUES('${task}','${ids.site}','${ids.location}','${conversation}','${deal}');
      INSERT INTO reservations(id,site_id,operating_location_id,sale_order_item_id) VALUES('${reservation}','${ids.site}','${ids.location}','${item}');
      INSERT INTO sale_order_item_units(id,site_id,sale_order_item_id,shipment_id) VALUES('${unit}','${ids.site}','${item}','${shipment}');
      INSERT INTO messages(id,conversation_id) VALUES('${message}','${conversation}');
      INSERT INTO task_comments(task_id) VALUES('${task}'); INSERT INTO task_categories(task_id) VALUES('${task}');
      INSERT INTO shipment_location_pings(site_id,shipment_id) VALUES('${ids.site}','${shipment}');
      INSERT INTO transactions(site_id,location_id,sale_order_id) VALUES('${ids.site}','${ids.location}','${order}');
      INSERT INTO pos_register_receipts(site_id,session_id,sale_id) VALUES('${ids.site}','${ids.allowed}','${sale}');`
  }).join('\n'))
}
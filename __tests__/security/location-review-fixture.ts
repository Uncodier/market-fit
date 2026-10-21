import { readdirSync } from 'node:fs'
import { enforcementIds, installEnforcementFixture } from './location-enforcement-fixture'
import { isolatedPostgres, migration } from './isolated-postgres'

export const reviewMigrations = readdirSync('supabase/migrations')
  .filter(file => /^2026102101000[0-4]_/.test(file)).sort()
export const i = enforcementIds
export const checkedRestrictions = (next: string[], expected: string[] = [], member = i.memberRow) => {
  const array = (ids: string[]) => `ARRAY[${ids.map(id => `'${id}'`).join(',')}]::uuid[]`
  return `SELECT replace_site_member_location_restrictions_checked('${i.site}','${member}',${array(next)},${array(expected)})`
}

// The core schema predates repository migrations. Supply its actual FK shapes,
// not naked UUID columns; later purchase/register constraints come from SQL source.
function installLegacyContracts(pg: ReturnType<typeof isolatedPostgres>) {
  pg.db(`ALTER TABLE reservations ADD COLUMN location_id uuid REFERENCES locations(id);
    ALTER TABLE reservations ADD COLUMN sale_order_item_id uuid REFERENCES sale_order_items(id);
    ALTER TABLE sales ADD COLUMN quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL;
    ALTER TABLE sales ADD COLUMN subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
    ALTER TABLE sale_orders ADD COLUMN quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL;
    ALTER TABLE transactions ADD COLUMN sale_order_id uuid REFERENCES sale_orders(id);
    ALTER TABLE sale_order_items ADD COLUMN shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL;
    ${['sales','purchases','transactions','inventory_levels','pos_register_sessions'].map(table =>
      `ALTER TABLE ${table} ADD FOREIGN KEY(location_id) REFERENCES locations(id);`).join('\n')}
    ALTER TABLE shipments ADD FOREIGN KEY(origin_location_id) REFERENCES locations(id);
    ALTER TABLE inventory_levels ADD FOREIGN KEY(catalog_item_id) REFERENCES catalog_items(id);
    ALTER TABLE quotations ADD FOREIGN KEY(deal_id) REFERENCES deals(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD FOREIGN KEY(deal_id) REFERENCES deals(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL;
    ALTER TABLE sale_order_items ADD FOREIGN KEY(sale_order_id) REFERENCES sale_orders(id) ON DELETE CASCADE;
    ALTER TABLE sale_order_item_units ADD FOREIGN KEY(sale_order_item_id) REFERENCES sale_order_items(id) ON DELETE CASCADE;
    ALTER TABLE sale_order_item_units ADD FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE SET NULL;
    ALTER TABLE quotation_items ADD FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE;
    ALTER TABLE messages ADD FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
    ALTER TABLE task_comments ADD FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    ALTER TABLE task_categories ADD FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    ALTER TABLE deal_owners ADD FOREIGN KEY(deal_id) REFERENCES deals(id) ON DELETE CASCADE;
    ALTER TABLE shipments ADD FOREIGN KEY(sale_order_id) REFERENCES sale_orders(id);
    ALTER TABLE shipments ADD FOREIGN KEY(sale_id) REFERENCES sales(id);
    ALTER TABLE shipment_location_pings ADD FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;
    ALTER TABLE accounting_sale_refunds ADD FOREIGN KEY(sale_id) REFERENCES sales(id);
    ALTER TABLE invoice_reminders ADD FOREIGN KEY(sale_id) REFERENCES sales(id);
    ALTER TABLE pos_register_receipts ADD FOREIGN KEY(sale_id) REFERENCES sales(id);
    ALTER TABLE pos_register_sessions ADD UNIQUE(id,site_id);
    ALTER TABLE records ADD COLUMN category_id uuid, ADD COLUMN title text,
      ADD COLUMN description text, ADD COLUMN data jsonb, ADD COLUMN status text;`)
  // Use the actual forward correction that removed purchase_items' weak FK.
  const purchase = migration('20260930000100_harden_purchase_permissions.sql')
  pg.db(purchase.slice(purchase.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS purchases_id_site_id_key'))
    .split('COMMIT;')[0])
  const register = migration('20261016171200_pos_register_ledger.sql')
  const registerFk = register.match(/FOREIGN KEY \(session_id,site_id\) REFERENCES public.pos_register_sessions\(id,site_id\)/)?.[0]
  if (!registerFk) throw new Error('Missing real register relationship')
  pg.db(`ALTER TABLE pos_register_movements ADD ${registerFk}; ALTER TABLE pos_register_receipts ADD ${registerFk};`)
  const records = migration('20260916020700_records_access_hardening.sql')
  pg.db(records.slice(records.indexOf('REVOKE INSERT, UPDATE ON public.records'))
    .split('DROP POLICY IF EXISTS record_categories_select')[0])
}

export function installReviewFixture(pg: ReturnType<typeof isolatedPostgres>, corrected = true) {
  const scope = migration('20261020030000_location_enforcement_scope.sql')
  installEnforcementFixture({ ...pg, db(sql: string) {
    if (sql === scope) installLegacyContracts(pg)
    return pg.db(sql)
  } })
  if (corrected) for (const file of reviewMigrations) pg.db(migration(file))
}
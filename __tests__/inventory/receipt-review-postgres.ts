import { ids } from "./movements-postgres"
import { coordination, receiving } from "./receiving-responsibility-postgres"
import {
  ordersMigration, partialMigration, projectionMigration, stockMigration, transferBootstrap, transferSql,
} from "./transfer-orders-postgres"
import { migration } from "./movements-postgres"

export const boundary = transferSql("20261113210400_inventory_receipt_write_boundary.sql")
export const accountingFix = transferSql("20261113210500_accounting_preserve_received_bill_lines.sql")
export const partialReceipts = transferSql("20261113210200_partial_bill_inventory_receipts.sql")
const historicalFunction = (file: string, name: string) => {
  const source = transferSql(file)
  const start = source.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`))
  if (start < 0) throw new Error(`Missing historical function ${name}`)
  const end = source.indexOf("$$;", start)
  if (end < 0) throw new Error(`Missing historical function end ${name}`)
  return source.slice(start, end + 3)
}
const licensing = "20261019220003_startup_trial_licensing.sql"

// Core schema predates the migration history. Only unrelated table shapes and
// the plan provider are fixtures; install the actual historical role, license,
// write guards and RPC wrapper, not lookalike permissive trigger stubs.
export const setupReviewDatabase = (db: (sql: string) => string, wrapped = true, canonical: string | null = null) => {
  db(`DROP SCHEMA IF EXISTS inventory_receipt_private CASCADE;
    DROP SCHEMA IF EXISTS location_acl_private CASCADE;`)
  db(transferBootstrap)
  if (canonical) db(`UPDATE public.purchases SET location_id='${canonical}' WHERE id='${ids.bill}';`)
  db(`
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT current_setting('role',true); $$;
    ALTER TABLE public.site_members ADD COLUMN created_at timestamptz DEFAULT now();
    CREATE TABLE public.site_ownership(site_id uuid,user_id uuid);
    CREATE FUNCTION public.effective_site_plan(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'enterprise'::text; $$;
    ${historicalFunction(licensing, "site_member_has_effective_license")}
    ${historicalFunction(licensing, "current_user_site_role")}
    CREATE TABLE public.companies(id uuid PRIMARY KEY);
    ALTER TABLE public.purchases ADD COLUMN title text DEFAULT 'Bill',
      ADD COLUMN vendor_company_id uuid, ADD COLUMN currency text DEFAULT 'USD',
      ADD COLUMN purchase_date timestamptz DEFAULT now(), ADD COLUMN due_date date,
      ADD COLUMN notes text, ADD COLUMN amount numeric DEFAULT 0,
      ADD COLUMN amount_due numeric DEFAULT 0, ADD COLUMN payments jsonb DEFAULT '[]',
      ADD COLUMN accounting_state text DEFAULT 'pending';
    ALTER TABLE public.purchase_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE public.purchase_items ADD COLUMN name text DEFAULT 'Item',
      ADD COLUMN unit_cost numeric DEFAULT 10, ADD COLUMN subtotal numeric;
    UPDATE public.purchase_items SET subtotal=round(quantity*unit_cost,2);
    UPDATE public.purchases p SET amount=(SELECT sum(subtotal) FROM public.purchase_items WHERE purchase_id=p.id),
      amount_due=(SELECT sum(subtotal) FROM public.purchase_items WHERE purchase_id=p.id);
    CREATE SCHEMA location_acl_private;
    REVOKE ALL ON SCHEMA location_acl_private FROM PUBLIC,anon,authenticated,service_role;
    CREATE TABLE location_acl_private.roots(table_name text PRIMARY KEY,location_column text);
    INSERT INTO location_acl_private.roots VALUES ('purchases','location_id');
    CREATE TABLE location_acl_private.links(child_table text,child_column text,parent_table text,
      required boolean,same_location boolean);
    INSERT INTO location_acl_private.links VALUES ('purchase_items','purchase_id','purchases',true,false);
    ${historicalFunction("20261020030000_location_enforcement_scope.sql", "current_user_has_location_restrictions")}
  `)
  // Install the latest historical accounting body, including due-date support.
  db(historicalFunction("20261006210000_financial_due_dates.sql", "accounting_update_purchase_items"))
  db(`REVOKE ALL ON FUNCTION public.accounting_update_purchase_items(uuid,uuid,timestamptz,jsonb,jsonb) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.accounting_update_purchase_items(uuid,uuid,timestamptz,jsonb,jsonb) TO authenticated,service_role;`)
  if (wrapped) db(transferSql("20261020030003_location_enforcement_rpc_boundary.sql"))
  db(transferSql("20261021010001_location_scope_write_guards.sql"))
  db(migration()); db(coordination); db(receiving)
  db(ordersMigration); db(projectionMigration); db(partialMigration)
  db(partialReceipts); db(stockMigration)
  db(boundary); db(accountingFix)
  db(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.purchases,public.purchase_items TO authenticated,service_role;
    GRANT SELECT ON public.site_members,public.site_member_location_restrictions,public.sites TO authenticated;
    GRANT SELECT ON public.site_ownership TO authenticated;`)
}

export const partialCall = (quantity = 1, request: string, location = ids.target) =>
  `SELECT public.receive_bill_inventory_lines('${ids.site}','${ids.bill}','${request}',
    '${location}','${ids.owner}','[{"purchaseItemId":"00000000-0000-4000-8000-000000000050","quantity":${quantity}}]');`

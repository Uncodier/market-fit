import { ids, installSiteFixture, migration, uuid } from '../security/isolated-postgres'

export const registerMigrations = [
  '20261016171200_pos_register_ledger.sql',
  '20261016171300_pos_register_rpcs.sql',
  '20261016171400_pos_register_sales_receipts.sql',
]
export const registerIds = {
  location: uuid(100), otherLocation: uuid(101), inactiveLocation: uuid(102), secondLocation: uuid(103),
  session: uuid(110), secondSession: uuid(111), sale: uuid(120), secondSale: uuid(121), payment: uuid(130),
}
export const openSql = (session = registerIds.session, location = registerIds.location, amount = '100', currency = 'USD') =>
  `SELECT public.pos_register_open('${ids.site}','${location}','${currency}',${amount},'${session}')`
export const moveSql = (kind = 'cash_in', amount = '10', request = uuid(140), session = registerIds.session, reason = 'Float') =>
  `SELECT public.pos_register_move('${session}','${kind}',${amount},'${reason}','${request}')`
export const closeSql = (counted = '100', request = uuid(150), session = registerIds.session, notes = 'Counted') =>
  `SELECT public.pos_register_close('${session}',${counted},'${notes}','${request}')`
export const summarySql = (session = registerIds.session) => `SELECT public.pos_register_summary('${session}')`

export const payment = (overrides: Record<string, unknown> = {}) => ({
  register_session_id: registerIds.session, payment_id: registerIds.payment, recorded_by: ids.owner,
  method: 'cash', amount: 30, tendered: 50, change: 20, status: 'completed',
  date: '1999-01-01', ...overrides,
})
export const savePayments = (payments: unknown[], sale = registerIds.sale) =>
  `UPDATE public.sales SET payments='${JSON.stringify(payments)}'::jsonb WHERE id='${sale}'`

export function installRegisterFixture(db: (sql: string) => string) {
  installSiteFixture(db)
  db(`ALTER TABLE public.site_members ADD COLUMN license_suspended boolean NOT NULL DEFAULT false;
    CREATE TABLE public.settings(site_id uuid PRIMARY KEY REFERENCES public.sites,currency text);
    CREATE TABLE public.locations(id uuid PRIMARY KEY,site_id uuid NOT NULL REFERENCES public.sites,
      name text,is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE public.sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites,
      location_id uuid REFERENCES public.locations,currency text NOT NULL DEFAULT 'USD',source text DEFAULT 'pos',
      amount numeric DEFAULT 100,amount_due numeric DEFAULT 100,status text DEFAULT 'pending',
      payments jsonb DEFAULT '[]',sale_date date DEFAULT '1999-01-01',updated_at timestamptz DEFAULT now(),
      accounting_state text DEFAULT 'pending');
    INSERT INTO public.settings VALUES ('${ids.site}','USD'),('${ids.otherSite}','EUR');
    INSERT INTO public.locations(id,site_id,is_active) VALUES
      ('${registerIds.location}','${ids.site}',true),('${registerIds.otherLocation}','${ids.otherSite}',true),
      ('${registerIds.inactiveLocation}','${ids.site}',false),('${registerIds.secondLocation}','${ids.site}',true);
    INSERT INTO public.sales(id,site_id,location_id) VALUES
      ('${registerIds.sale}','${ids.site}','${registerIds.location}'),
      ('${registerIds.secondSale}','${ids.site}','${registerIds.location}');
    GRANT SELECT ON public.settings, public.locations TO postgres,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.sales TO postgres,authenticated,service_role;
    ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_sales_read ON public.sales FOR SELECT TO authenticated USING (public.user_can(site_id,'select'));
    CREATE POLICY fixture_sales_insert ON public.sales FOR INSERT TO authenticated WITH CHECK (public.user_can(site_id,'insert'));
    CREATE POLICY fixture_sales_update ON public.sales FOR UPDATE TO authenticated
      USING (public.user_can(site_id,'update')) WITH CHECK (public.user_can(site_id,'update'));
    CREATE POLICY fixture_sales_delete ON public.sales FOR DELETE TO authenticated USING (public.user_can(site_id,'delete'));
    UPDATE public.sales SET payments='[{"amount":5,"method":"cash"}]' WHERE id='${registerIds.secondSale}';`)
  // Use the deployed license-aware role function, not an always-authorized mock.
  const roles = migration('20261007220000_site_license_enforcement.sql')
  db(roles.slice(roles.indexOf('CREATE OR REPLACE FUNCTION public.current_user_site_role(')).split('$$;')[0] + '$$;')
  db('ALTER FUNCTION public.current_user_site_role(uuid) OWNER TO postgres;')
  // Existing accounting preservation/freshness triggers must continue to run.
  const lifecycle = migration('20260929223200_accounting_source_lifecycle.sql')
  for (const name of ['accounting_preserve_legacy_receipt', 'accounting_touch_source']) {
    db(lifecycle.slice(lifecycle.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`)).split('$$;')[0] + '$$;')
  }
  db(`CREATE TRIGGER accounting_00_sales_legacy_receipt BEFORE UPDATE OF payments ON public.sales
      FOR EACH ROW EXECUTE FUNCTION public.accounting_preserve_legacy_receipt();
    CREATE TRIGGER accounting_sales_freshness BEFORE UPDATE ON public.sales
      FOR EACH ROW EXECUTE FUNCTION public.accounting_touch_source();`)
  for (const file of registerMigrations) db(migration(file))
}
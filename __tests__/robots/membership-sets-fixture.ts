import { readFileSync } from 'node:fs'
import path from 'node:path'
import { migration, uuid } from '../security/isolated-postgres'
import { installRobotReadFixture, robotActors as a } from './read-rls-postgres-fixture'

// This overlay never edits the shared fixture. Real repository licensing bodies
// include the deployed late-payment seat path; no permission function is mocked.
export function installMembershipSetsFixture(db: (sql: string) => string) {
  installRobotReadFixture(db)
  db(migration('20261126195001_bound_robot_read_permissions.sql'))
  db(`ALTER TABLE public.billing ADD COLUMN id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN stripe_customer_id text, ADD COLUMN subscription_end_date timestamptz,
    ADD COLUMN auto_renew boolean;
    CREATE TABLE public.stripe_subscription_invoice_settlements(invoice_id text PRIMARY KEY);
    CREATE TABLE public.site_retired_stripe_subscriptions(site_id uuid, subscription_id text);`)
  const late = migration('20261125200000_stripe_late_renewal_access.sql')
  db(late.slice(late.indexOf('CREATE TABLE public.stripe_late_renewal_access'), late.indexOf('-- Only access readers')))
  const month = migration('20261125213000_individual_late_payment_access_month.sql')
  db(month.slice(month.indexOf('CREATE TABLE public.late_payment_access_months'), month.indexOf('-- Change only')))
  db(late.slice(late.indexOf('CREATE FUNCTION public.site_member_has_access_seat'), late.indexOf('DO $access_readers$'))
    .replace('a.period_end > t.checked_at', 'public.late_payment_access_end(a) > t.checked_at'))
  db(`DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.current_user_site_role(uuid)'::regprocedure),
    'public.site_member_has_effective_license(', 'public.site_member_has_access_seat('); END $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres;
    ALTER FUNCTION public.site_member_has_access_seat(uuid) OWNER TO postgres;
    ALTER FUNCTION public.bound_stripe_late_renewal_access(uuid,uuid,text,text,timestamptz) OWNER TO postgres;
    ALTER FUNCTION public.late_payment_access_end(public.stripe_late_renewal_access) OWNER TO postgres;
    DROP POLICY legacy_allow ON public.remote_instances;
    DROP POLICY ownership_select ON public.site_ownership;
    CREATE POLICY "Authenticated users can view site ownership" ON public.site_ownership
      FOR SELECT TO authenticated USING (true);
    CREATE TABLE public.assets(id uuid PRIMARY KEY, site_id uuid, instance_id uuid,
      file_path text, name text, file_type text, created_at timestamptz);
    ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.assets TO authenticated,anon,service_role;
    CREATE POLICY location_acl_enforcement ON public.assets AS RESTRICTIVE TO authenticated
      USING (NOT (SELECT public.current_user_has_location_restrictions()));
    CREATE POLICY instance_ownership_anon_guard ON public.assets AS RESTRICTIVE TO anon USING(false);
    CREATE INDEX robot_fixture_site_idx ON public.remote_instances(site_id);
    CREATE INDEX robot_fixture_member_idx ON public.site_members(user_id,site_id);
    CREATE INDEX robot_fixture_owner_idx ON public.sites(user_id);
    CREATE INDEX robot_fixture_coowner_idx ON public.site_ownership(user_id);
  `)
  db(readFileSync(path.join(__dirname, 'membership-sets-catalog.sql'), 'utf8'))
  db(migration('20261111223000_instance_asset_summaries.sql'))
  db(`ALTER FUNCTION public.get_instance_asset_summaries(uuid,uuid[]) OWNER TO postgres;
    INSERT INTO public.assets SELECT '${uuid(700)}','${a.site}','${uuid(500)}',
      'test.png','Image','image/png','2026-11-01';
    INSERT INTO public.assets SELECT '${uuid(701)}','${a.site}','${uuid(502)}',
      'hidden.png','Hidden','image/png','2026-11-01';`)
}

export function seedMembershipScale(db: (sql: string) => string, rows: number) {
  db(`INSERT INTO public.remote_instances(id,site_id,user_id,created_by)
    SELECT md5('robot-scale-'||i)::uuid,'${a.site}',
      CASE WHEN i%2=0 THEN '${a.assigned}'::uuid ELSE '${a.owner}'::uuid END,NULL
    FROM generate_series(1,${rows}) g(i);
    INSERT INTO public.instance_logs(id,site_id,instance_id)
      SELECT md5('log-'||id)::uuid,site_id,id FROM public.remote_instances
        WHERE id NOT IN (SELECT instance_id FROM public.instance_logs WHERE instance_id IS NOT NULL);
    INSERT INTO public.assets
      SELECT md5('asset-'||id||'-'||i)::uuid,site_id,id,'asset-'||i,
        'Synthetic asset',CASE WHEN i%2=0 THEN 'image/png' ELSE 'text/plain' END,
        '2026-11-01'::timestamptz FROM public.remote_instances CROSS JOIN generate_series(1,4) g(i);
    ANALYZE public.remote_instances; ANALYZE public.instance_logs; ANALYZE public.assets;
    ANALYZE public.sites; ANALYZE public.site_members; ANALYZE public.site_ownership;`)
}
import { actorSql, isolatedPostgres, migration, uuid } from './isolated-postgres'

export const locationIds = {
  site: uuid(1), otherSite: uuid(2), owner: uuid(10), admin: uuid(11),
  member: uuid(12), viewer: uuid(13), foreign: uuid(15), coOwner: uuid(16),
  pendingUser: uuid(17), rejectedUser: uuid(18),
  adminMember: uuid(101), memberRow: uuid(102), viewerMember: uuid(103),
  coOwnerMember: uuid(104), pendingMember: uuid(105), rejectedMember: uuid(106),
  foreignMember: uuid(107), location: uuid(201), secondLocation: uuid(202), foreignLocation: uuid(203),
}
export const locationMigration = migration('20261020020000_location_access_foundation.sql')
export const locationActor = (sql: string, user = locationIds.owner, role = 'authenticated') => actorSql(sql, user, role)
export const replaceLocations = (locations: string[], member = locationIds.memberRow, site = locationIds.site) =>
  `SELECT public.replace_site_member_location_restrictions('${site}','${member}',ARRAY[${locations.map(id => `'${id}'`).join(',')}]::uuid[])`

// Use exact checked-in role, effective-plan and chronological-license functions.
// Only pre-existing table shapes/auth.uid are synthetic; no permission mocks.
const functionBody = (file: string, declaration: string) => {
  const source = migration(file)
  const start = source.indexOf(declaration)
  if (start < 0) throw new Error(`Missing prerequisite function: ${declaration}`)
  return source.slice(start).split('$$;')[0] + '$$;'
}
export function installLocationFixture(pg: ReturnType<typeof isolatedPostgres>) {
  const i = locationIds
  pg.db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
    $$;
    CREATE TABLE public.sites(id uuid PRIMARY KEY,user_id uuid,archived_at timestamptz);
    CREATE TABLE public.site_ownership(site_id uuid REFERENCES sites,user_id uuid,PRIMARY KEY(site_id,user_id));
    CREATE TABLE public.site_members(id uuid PRIMARY KEY,site_id uuid REFERENCES sites,user_id uuid,
      role text NOT NULL,status text DEFAULT 'pending',email text,
      manually_disabled boolean NOT NULL DEFAULT false,license_suspended boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now(), UNIQUE(site_id,user_id));
    CREATE TABLE public.locations(id uuid PRIMARY KEY,site_id uuid REFERENCES sites,
      name text NOT NULL DEFAULT 'Test location',is_active boolean DEFAULT true);
    CREATE TABLE public.billing(site_id uuid PRIMARY KEY,plan text,status text DEFAULT 'active',
      stripe_subscription_id text,paid_subscription_invoice_id text,paid_subscription_period_start timestamptz,
      paid_subscription_period_end timestamptz,subscription_status text,trial_started_at timestamptz,trial_ends_at timestamptz);
    CREATE TABLE public.site_startup_trials(site_id uuid PRIMARY KEY,started_at timestamptz,ends_at timestamptz,converted_at timestamptz);
    GRANT SELECT ON public.sites,public.site_members,public.locations TO authenticated;
    ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
    CREATE POLICY existing_member_read ON public.site_members FOR SELECT TO authenticated USING (true);
    INSERT INTO public.sites VALUES ('${i.site}','${i.owner}',NULL),('${i.otherSite}','${i.foreign}',NULL);
    INSERT INTO public.billing(site_id,plan) VALUES ('${i.site}','enterprise'),('${i.otherSite}','enterprise');
    INSERT INTO public.site_members(id,site_id,user_id,role,status,email,created_at) VALUES
      ('${i.adminMember}','${i.site}','${i.admin}','admin','active','admin@example.test','2026-01-01'),
      ('${i.memberRow}','${i.site}','${i.member}','collaborator','active','member@example.test','2026-01-02'),
      ('${i.viewerMember}','${i.site}','${i.viewer}','marketing','active','viewer@example.test','2026-01-03'),
      ('${i.coOwnerMember}','${i.site}','${i.coOwner}','collaborator','active','coowner@example.test','2026-01-04'),
      ('${i.pendingMember}','${i.site}',NULL,'collaborator','pending','invite@example.test','2026-01-05'),
      ('${i.rejectedMember}','${i.site}','${i.rejectedUser}','collaborator','rejected','rejected@example.test','2026-01-06'),
      ('${i.foreignMember}','${i.otherSite}','${i.foreign}','collaborator','active','foreign@example.test','2026-01-01');
    INSERT INTO public.site_ownership VALUES ('${i.site}','${i.coOwner}');
    INSERT INTO public.locations(id,site_id) VALUES ('${i.location}','${i.site}'),
      ('${i.secondLocation}','${i.site}'),('${i.foreignLocation}','${i.otherSite}');`)
  pg.db(functionBody('20261019220000_startup_trial_schema.sql', 'CREATE FUNCTION public.effective_site_plan('))
  pg.db(functionBody('20261019220003_startup_trial_licensing.sql', 'CREATE FUNCTION public.site_member_has_effective_license('))
  pg.db(functionBody('20261019220003_startup_trial_licensing.sql', 'CREATE OR REPLACE FUNCTION public.current_user_site_role('))
  pg.db(functionBody('20261007220000_site_license_enforcement.sql', 'CREATE OR REPLACE FUNCTION public.lock_site_license('))
  pg.db(locationMigration)
}

export const locationSecuritySnapshot = `SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname)
  FROM pg_policies p WHERE schemaname='public' AND tablename IN ('locations','site_members')`

export function installLocationMemberGuard(pg: ReturnType<typeof isolatedPostgres>) {
  pg.db(functionBody('20261019220003_startup_trial_licensing.sql', 'CREATE OR REPLACE FUNCTION public.get_site_member_license('))
  pg.db(functionBody('20261007223500_manual_member_deactivation.sql', 'CREATE OR REPLACE FUNCTION public.guard_member_license('))
  pg.db(`CREATE TRIGGER license_10_guard_member BEFORE INSERT OR UPDATE OR DELETE ON public.site_members
    FOR EACH ROW EXECUTE FUNCTION public.guard_member_license()`)
}

export async function waitForLocationBarrier(pg: ReturnType<typeof isolatedPostgres>, name: string) {
  const deadline = Date.now() + 5000
  while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}'
    AND pid <> pg_backend_pid() AND wait_event='PgSleep'`) !== '1') {
    if (Date.now() > deadline) throw new Error(`Transaction barrier timed out: ${name}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from './isolated-postgres'
import { enforcementIds as i, installEnforcementFixture, restrictEnforcementMember } from './location-enforcement-fixture'

const policies = migration('20261020030002_location_enforcement_policies.sql')
const privateAnon = migration('20261020030005_location_enforcement_private_anon.sql')
const describePg = postgresAvailable ? describe : describe.skip

describePg('location rollout: private coordinator ownership under a non-superuser', () => {
  const pg = isolatedPostgres()
  beforeAll(() => {
    pg.start()
    pg.db('CREATE ROLE apps_migration_coordinator; CREATE ROLE other_infrastructure_owner; CREATE ROLE inherited_reader;')
  })
  afterAll(() => pg.stop())

  function install(beforePolicies = '', beforeAnon = '') {
    let postgres = false
    installEnforcementFixture({ ...pg, db(sql: string) {
      if (sql === policies) {
        // Model application-owned objects separately from coordinator-owned data.
        // Local PostgreSQL has no Supabase policy delegation for storage.objects,
        // so storage ownership is not a claim about hosted supautils behavior.
        pg.db(`DO $$ DECLARE r record; BEGIN
          FOR r IN SELECT c.oid,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname IN ('public','location_acl_private','storage') AND c.relkind IN ('r','p','v') LOOP
            EXECUTE format('ALTER %s %s OWNER TO postgres',CASE WHEN r.relkind='v' THEN 'VIEW' ELSE 'TABLE' END,r.oid::regclass);
          END LOOP;
          FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname IN ('public','location_acl_private') LOOP
            EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.oid::regprocedure);
          END LOOP;
        END $$;
        ALTER SCHEMA public OWNER TO postgres; ALTER SCHEMA location_acl_private OWNER TO postgres;
        GRANT USAGE ON SCHEMA auth,storage TO postgres;
        CREATE TABLE public.apps_migration_feedback(id integer PRIMARY KEY,payload text);
        ALTER TABLE public.apps_migration_feedback ENABLE ROW LEVEL SECURITY;
        CREATE POLICY coordinator_only ON public.apps_migration_feedback TO apps_migration_coordinator USING(true);
        INSERT INTO public.apps_migration_feedback VALUES(1,'Private migration result');
        ALTER TABLE public.apps_migration_feedback OWNER TO apps_migration_coordinator;
        GRANT SELECT ON public.apps_migration_feedback TO service_role;
        ${beforePolicies}`)
        postgres = true
      }
      if (sql === privateAnon && beforeAnon) pg.db(beforeAnon)
      return pg.db(postgres ? `SET ROLE postgres; ${sql}` : sql)
    } })
  }

  test('complete rollout preserves infrastructure and enforces application and storage policies', () => {
    install()
    expect(pg.db(`SELECT rolsuper FROM pg_roles WHERE rolname='postgres'`)).toBe('f')
    expect(() => pg.db('SET ROLE postgres; ALTER TABLE apps_migration_feedback ENABLE ROW LEVEL SECURITY'))
      .toThrow(/must be owner of table apps_migration_feedback/)
    expect(pg.db(`SELECT pg_get_userbyid(relowner)||':'||relrowsecurity FROM pg_class
      WHERE oid='public.apps_migration_feedback'::regclass`)).toBe('apps_migration_coordinator:true')
    expect(pg.db(`SELECT policyname FROM pg_policies WHERE tablename='apps_migration_feedback'`)).toBe('coordinator_only')
    expect(pg.call('SELECT payload FROM apps_migration_feedback', i.owner, 'service_role')).toBe('Private migration result')
    for (const role of ['anon','authenticated']) {
      expect(() => pg.call('SELECT payload FROM apps_migration_feedback', i.member, role)).toThrow(/permission denied/)
      expect(() => pg.call("INSERT INTO apps_migration_feedback VALUES(2,'Injected')", i.member, role)).toThrow(/permission denied/)
    }
    expect(pg.call('SELECT count(*) FROM deals', i.member)).toBe('3')
    restrictEnforcementMember(pg)
    expect(pg.call('SELECT count(*) FROM deals', i.member)).toBe('1')
    expect(pg.call('SELECT count(*) FROM deals', i.owner, 'anon')).toBe('0')
    expect(pg.call('SELECT count(*) FROM storage.objects', i.member)).toBe('0')
    expect(pg.db(`SELECT count(*) FROM pg_policies WHERE tablename='reports'
      AND policyname IN ('location_acl_enforcement','location_acl_private_anon')`)).toBe('2')
  })

  const driftCases = [
    ['authenticated table read', 'GRANT SELECT ON apps_migration_feedback TO authenticated;'],
    ['anonymous table write', 'GRANT INSERT ON apps_migration_feedback TO anon;'],
    ['PUBLIC read', 'GRANT SELECT ON apps_migration_feedback TO PUBLIC;'],
    ['authenticated column read', 'GRANT SELECT(payload) ON apps_migration_feedback TO authenticated;'],
    ['anonymous column write', 'GRANT UPDATE(payload) ON apps_migration_feedback TO anon;'],
    ['disabled RLS', 'ALTER TABLE apps_migration_feedback DISABLE ROW LEVEL SECURITY;'],
    ['unexpected owner', 'ALTER TABLE apps_migration_feedback OWNER TO postgres;'],
    ['operational registration', "INSERT INTO location_acl_private.roots VALUES('apps_migration_feedback','id');"],
  ]
  test.each(driftCases)('step 3 rejects %s and rolls back all policies', (_name, drift) => {
    expect(() => install(drift)).toThrow(/Review private infrastructure boundary/)
    expect(pg.db(`SELECT count(*) FROM pg_policies WHERE policyname LIKE 'location_acl_%'`)).toBe('0')
    expect(pg.db('SELECT editing_enabled FROM location_access_rollout')).toBe('f')
  })

  test.each(driftCases)('step 6 rechecks %s and rolls back anonymous policies', (_name, drift) => {
    expect(() => install('', drift)).toThrow(/Review private infrastructure boundary/)
    expect(pg.db(`SELECT count(*) FROM pg_policies WHERE policyname='location_acl_private_anon'`)).toBe('0')
    expect(pg.db('SELECT editing_enabled FROM location_access_rollout')).toBe('f')
  })

  test('inherited browser access is not a safe exception', () => {
    try {
      expect(() => install(`GRANT SELECT ON apps_migration_feedback TO inherited_reader;
        GRANT inherited_reader TO authenticated;`)).toThrow(/Review private infrastructure boundary/)
    } finally {
      pg.db('REVOKE inherited_reader FROM authenticated')
    }
  })

  test('another foreign-owned private table is not silently skipped', () => {
    expect(() => install(`CREATE TABLE public.another_private_table(id integer);
      ALTER TABLE public.another_private_table ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.another_private_table OWNER TO other_infrastructure_owner;`))
      .toThrow(/must be owner of table another_private_table/)
    expect(pg.db(`SELECT count(*) FROM pg_policies WHERE policyname LIKE 'location_acl_%'`)).toBe('0')
  })
})

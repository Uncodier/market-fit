/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { installRobotReadFixture, robotActors as a, robotRows as r } from './read-rls-postgres-fixture'

const change = () => migration('20261126195001_bound_robot_read_permissions.sql')
const tables = ['remote_instances', 'instance_logs'] as const
const selection = (table: string) => `SELECT id FROM public.${table} ORDER BY id`
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Socket-only PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('Candidate A Robots read policy in real socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(pg.start, 30_000)
  beforeEach(() => installRobotReadFixture(pg.db), 30_000)
  afterAll(pg.stop)

  const read = (table: string, user: string, role = 'authenticated') => pg.call(selection(table), user, role)
  const snapshot = () => pg.db(`
    SELECT jsonb_agg(row_to_json(p) ORDER BY polrelid,polname) FROM pg_policy p
      WHERE NOT (polrelid IN ('public.remote_instances'::regclass,'public.instance_logs'::regclass)
        AND polname='instance_ownership_select');
    SELECT jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid),proowner,proacl)
      ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace;
    SELECT jsonb_agg(jsonb_build_array(oid::regclass::text,relacl,relrowsecurity,relforcerowsecurity)
      ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace;
    SELECT jsonb_agg(row_to_json(t) ORDER BY oid) FROM pg_trigger t WHERE NOT tgisinternal;
  `)

  it('preserves exact visible IDs for every actor/role and all unrelated catalog objects', () => {
    const cases: Array<[string, number[], number[], string?]> = [
      [a.owner, [500,501,502,503], [600,601,602,603]],
      [a.coOwner, [500,501,502,503], [600,601,602,603]],
      [a.admin, [500,501,502,503], [600,601,602,603]],
      [a.collaborator, [500,501,502,503], [600,601,602,603]],
      [a.marketing, [500,501,502,503], [600,601,602,603]],
      [a.legacy, [500,501,502,503], [600,601,602,603]],
      [a.assigned, [500,501], [600,601]],
      [a.foreign, [504], [611]],
      ...[a.inactive,a.pending,a.disabled,a.unlicensed,a.archivedOwner,a.lapsedMember,
        a.locationRestricted].map(user => [user, [], []] as [string, number[], number[]]),
      [a.owner, [], [], 'anon'],
      [a.owner, [500,501,502,503,504,505,506,507],
        Array.from({ length: 14 }, (_, i) => 600+i), 'service_role'],
    ]
    const verify = () => {
      for (const table of tables) expect(pg.db(`SET ROLE authenticated;
        SET request.jwt.claims='{"role":"authenticated"}'; ${selection(table)}`)).toBe('')
      for (const [user, parents, logs, role] of cases) {
        expect(read('remote_instances', user, role)).toBe(parents.map(uuid).join('\n'))
        expect(read('instance_logs', user, role)).toBe(logs.map(uuid).join('\n'))
        expect(pg.call(`SELECT count(*) FROM public.instance_logs WHERE site_id='${a.site}'`, user, role))
          .toBe(String(logs.filter(id => ![605,608,611,612,613].includes(id)).length))
      }
    }
    verify()
    const untouched = snapshot()
    pg.db(change())
    verify()
    expect(snapshot()).toBe(untouched)
  })

  it('retains same-site hidden-parent denial, null/missing parents, cross-site equality and other guards', () => {
    const verify = () => {
      for (const id of [602,603,604,605,606,607,608,609,610]) {
        expect(pg.call(`SELECT id FROM public.instance_logs WHERE id='${uuid(id)}'`, a.assigned)).toBe('')
      }
      // Owned, same-site parent hidden solely by another restrictive policy.
      expect(pg.call(`SELECT id FROM public.remote_instances WHERE id='${r.blocked}'`, a.assigned)).toBe('')
      expect(pg.call(`SELECT id FROM public.instance_logs WHERE instance_id='${r.blocked}'`, a.owner)).toBe('')
    }
    verify(); pg.db(change()); verify()
  })

  it('rechecks revoked membership, license, archival, ownership and location permissions on new statements', () => {
    const denials: Array<[string, string]> = [
      [a.assigned, `UPDATE public.site_members SET status='inactive' WHERE user_id='${a.assigned}'`],
      [a.assigned, `UPDATE public.site_members SET manually_disabled=true WHERE user_id='${a.assigned}'`],
      [a.assigned, `UPDATE public.billing SET status='inactive' WHERE site_id='${a.site}'`],
      [a.assigned, `UPDATE public.sites SET archived_at=now() WHERE id='${a.site}'`],
      [a.assigned, `UPDATE public.remote_instances SET user_id=NULL,created_by=NULL WHERE site_id='${a.site}'`],
      [a.collaborator, `UPDATE public.site_members SET restrict_to_assigned_only=true WHERE user_id='${a.collaborator}'`],
      [a.assigned, `INSERT INTO public.site_member_location_restrictions SELECT site_id,id FROM public.site_members WHERE user_id='${a.assigned}'`],
    ]
    const verify = () => {
      for (const [user, revoke] of denials) {
        for (const table of tables) {
          expect(read(table, user)).not.toBe('')
          expect(pg.db(`BEGIN; ${revoke}; ${actorSql(selection(table), user)}; ROLLBACK;`)).toBe('')
        }
      }
    }
    verify(); pg.db(change()); verify()
  })

  it('preserves allowed writes, operation denials, attribution and hidden-row update/delete behavior', () => {
    const trial = (sql: string, user = a.assigned) => pg.db(`BEGIN; ${actorSql(sql, user)}; ROLLBACK;`)
    const verify = () => {
      expect(trial(`UPDATE public.remote_instances SET payload='changed' WHERE id='${r.own}' RETURNING id`)).toBe(r.own)
      expect(trial(`UPDATE public.instance_logs SET payload='changed' WHERE id='${uuid(600)}' RETURNING id`)).toBe(uuid(600))
      expect(trial(`UPDATE public.remote_instances SET payload='changed' WHERE id='${r.hidden}' RETURNING id`)).toBe('')
      expect(trial(`DELETE FROM public.instance_logs WHERE id='${uuid(600)}' RETURNING id`)).toBe('')
      expect(trial(`UPDATE public.instance_logs SET payload='changed' RETURNING id`, a.marketing)).toBe('')
      expect(() => trial(`UPDATE public.remote_instances SET user_id='${a.owner}' WHERE id='${r.own}'`)).toThrow(/immutable/)
      expect(() => trial(`INSERT INTO public.instance_logs(id,site_id,instance_id) VALUES ('${uuid(650)}','${a.site}','${r.hidden}')`)).toThrow(/row-level security/)
      expect(() => trial(`INSERT INTO public.remote_instances(id,site_id,user_id) VALUES ('${uuid(550)}','${a.site}','${a.owner}')`)).toThrow(/attribution/)
      expect(trial(`INSERT INTO public.remote_instances(id,site_id) VALUES ('${uuid(550)}','${a.site}') RETURNING user_id`)).toBe(a.assigned)
    }
    verify(); pg.db(change()); verify()
  })

  it.each([
    ['parent predicate', 'ALTER POLICY instance_ownership_select ON public.remote_instances USING (true)'],
    ['child predicate', 'ALTER POLICY instance_ownership_select ON public.instance_logs USING (true)'],
    ['policy role', 'ALTER POLICY instance_ownership_select ON public.instance_logs TO PUBLIC'],
    ['permissive policy', `DROP POLICY instance_ownership_select ON public.remote_instances;
      CREATE POLICY instance_ownership_select ON public.remote_instances FOR SELECT TO authenticated
      USING (instance_row_access(site_id,user_id,created_by) AND user_can(site_id,'select') IS TRUE)`],
    ['policy command/check', `DROP POLICY instance_ownership_select ON public.remote_instances;
      CREATE POLICY instance_ownership_select ON public.remote_instances AS RESTRICTIVE TO authenticated
      USING (instance_row_access(site_id,user_id,created_by) AND user_can(site_id,'select') IS TRUE) WITH CHECK (true)`],
    ['missing policy', 'DROP POLICY instance_ownership_select ON public.instance_logs'],
    ['disabled parent RLS', 'ALTER TABLE public.remote_instances DISABLE ROW LEVEL SECURITY'],
    ['disabled child RLS', 'ALTER TABLE public.instance_logs DISABLE ROW LEVEL SECURITY'],
    ['helper body', `CREATE OR REPLACE FUNCTION public.instance_row_access(p_site uuid,p_user uuid,p_created uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT true $$`],
    ['helper volatility', 'ALTER FUNCTION public.user_can(uuid,text) VOLATILE'],
    ['helper security mode', 'ALTER FUNCTION public.instance_row_access(uuid,uuid,uuid) SECURITY INVOKER'],
    ['helper config', 'ALTER FUNCTION public.instance_row_access(uuid,uuid,uuid) SET search_path=public'],
    ['helper ACL', 'GRANT EXECUTE ON FUNCTION public.instance_row_access(uuid,uuid,uuid) TO anon'],
    ['helper owner', 'ALTER FUNCTION public.instance_row_access(uuid,uuid,uuid) OWNER TO auditor'],
  ])('fails closed atomically on %s drift', (_name, drift) => {
    pg.db(drift)
    const before = pg.db(`SELECT jsonb_agg(row_to_json(p) ORDER BY polrelid,polname) FROM pg_policy p`)
    expect(() => pg.db(change())).toThrow(/Unexpected Robots/)
    expect(pg.db(`SELECT jsonb_agg(row_to_json(p) ORDER BY polrelid,polname) FROM pg_policy p`)).toBe(before)
  })

  it('rejects replay instead of accepting a different baseline', () => {
    pg.db(change())
    expect(() => pg.db(change())).toThrow(/Unexpected Robots SELECT policy/)
  })

  it('removes redundant user_can calls without changing remaining ownership calls or results', () => {
    // Function statistics count real executions without rewriting/instrumenting
    // the pinned STABLE helpers. Timings are not a production latency benchmark.
    const measure = (table: string) => {
      pg.db('SELECT pg_stat_reset()')
      const count = pg.db(`SET track_functions='all';
        ${actorSql(`SELECT count(*) FROM public.${table} WHERE site_id='${a.site}';`, a.assigned)}
        RESET ROLE; SELECT pg_stat_force_next_flush();`)
      const stats = JSON.parse(pg.db(`SELECT jsonb_object_agg(funcname,calls)
        FROM pg_stat_user_functions WHERE funcname IN ('user_can','instance_row_access')`))
      return { count, stats }
    }
    const before = tables.map(measure)
    pg.db(change())
    const after = tables.map(measure)
    for (let i = 0; i < tables.length; i++) {
      expect(after[i].count).toBe(before[i].count)
      expect(after[i].stats.instance_row_access).toBe(before[i].stats.instance_row_access)
      expect(after[i].stats.user_can).toBeLessThan(before[i].stats.user_can)
      expect(after[i].stats.user_can).toBe(after[i].stats.instance_row_access)
    }
    if (process.env.REPORT_ROBOTS_CALLS === '1') console.info(JSON.stringify({ before, after }))
  })

  it('abandons a contested policy lock within the short timeout without partially changing either policy', async () => {
    const before = snapshot()
    const holder = pg.concurrent(`BEGIN; SET application_name='robots-read-lock-test';
      LOCK TABLE public.instance_logs IN ACCESS SHARE MODE; SELECT pg_sleep(4); COMMIT;`)
    for (let i = 0; i < 100; i++) {
      if (pg.db(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
        WHERE a.application_name='robots-read-lock-test' AND l.relation='public.instance_logs'::regclass
          AND l.granted`) === '1') break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    const started = Date.now()
    expect(() => pg.db(change())).toThrow(/lock timeout/)
    expect(Date.now() - started).toBeLessThan(3500)
    await holder
    expect(snapshot()).toBe(before)
    // A successful retry proves the aborted transaction retained both baselines.
    pg.db(change())
  }, 10_000)
})
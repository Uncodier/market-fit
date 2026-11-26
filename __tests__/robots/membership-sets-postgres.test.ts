/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { robotActors as a, robotRows as r } from './read-rls-postgres-fixture'
import { installMembershipSetsFixture, seedMembershipScale } from './membership-sets-fixture'

const change = () => migration('20261126201001_bound_robot_membership_sets.sql')
const tables = ['remote_instances','instance_logs','assets']
const actors = [a.owner,a.coOwner,a.admin,a.collaborator,a.marketing,a.legacy,a.assigned,
  a.foreign,a.inactive,a.pending,a.disabled,a.unlicensed,a.archivedOwner,a.lapsedMember,a.locationRestricted]
const summary = (ids = `ARRAY['${r.own}','${r.created}','${r.hidden}','${r.unknown}','${r.blocked}','${r.crossSite}']::uuid[]`) =>
  `SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY instance_id),'[]')
   FROM public.get_instance_asset_summaries('${a.site}',${ids}) x`
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Socket-only PostgreSQL required')

;(postgresAvailable ? describe : describe.skip)('Robots actor-only membership sets, real PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(pg.start, 30_000)
  beforeEach(() => installMembershipSetsFixture(pg.db), 30_000)
  afterAll(pg.stop)
  const read = (table: string, user: string, role = 'authenticated') =>
    pg.call(`SELECT id FROM public.${table} ORDER BY id`,user,role)
  const untouched = () => pg.db(`SELECT jsonb_agg(row_to_json(p) ORDER BY polrelid,polname)
    FROM pg_policy p WHERE NOT (polrelid='public.remote_instances'::regclass AND
      polname IN ('instance_ownership_select','remote_instances_access_policy'));
    SELECT pg_get_expr(polwithcheck,polrelid) FROM pg_policy WHERE
      polrelid='public.remote_instances'::regclass AND polname='remote_instances_access_policy';
    SELECT jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid),proowner,proacl)
      ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace;
    SELECT jsonb_agg(jsonb_build_array(oid::regclass::text,relacl,relrowsecurity,relforcerowsecurity)
      ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace;
    SELECT jsonb_agg(row_to_json(t) ORDER BY oid) FROM pg_trigger t WHERE NOT tgisinternal;`)

  it('preserves exact IDs/counts/RPC payloads for all actors and roles, and unrelated catalog objects', () => {
    const capture = () => actors.flatMap(user => [
      ...tables.map(table => read(table,user)), pg.call(summary(),user),
      ...tables.map(table => pg.call(`SELECT count(*) FROM public.${table} WHERE site_id='${a.site}'`,user)),
    ]).concat(['anon','service_role'].flatMap(role => tables.map(table => read(table,a.owner,role))))
    expect(read('remote_instances',a.assigned)).toBe([r.own,r.created].join('\n'))
    expect(read('remote_instances',a.legacy)).toBe([r.own,r.created,r.hidden,r.unknown].join('\n'))
    const before = capture(); const catalog = untouched()
    pg.db(change())
    expect(capture()).toEqual(before); expect(untouched()).toBe(catalog)
    for (const table of tables) expect(pg.db(`SET ROLE authenticated;
      SET request.jwt.claims='{"role":"authenticated"}'; SELECT id FROM public.${table}`)).toBe('')
    expect(() => pg.call(summary(),a.owner,'anon')).toThrow(/permission denied/)
  })

  it('matches the original helper across NULL/false/true restrictions, null attribution and co-owner states', () => {
    const verify = () => {
      const visible: string[] = []
      for (const flag of ['NULL','false','true']) {
        for (const actor of [a.assigned,a.coOwner,a.legacy]) {
          const setup = `UPDATE public.site_members SET restrict_to_assigned_only=${flag} WHERE user_id='${actor}';`
          const expected = pg.db(`BEGIN; ${setup} ${actorSql(`SELECT id FROM public.remote_instances
            WHERE public.instance_row_access(site_id,user_id,created_by) ORDER BY id`,actor)}; ROLLBACK;`)
          expect(pg.db(`BEGIN; ${setup} ${actorSql('SELECT id FROM public.remote_instances ORDER BY id',actor)}; ROLLBACK;`))
            .toBe(expected)
          visible.push(expected)
        }
      }
      return visible
    }
    const before=verify(); pg.db(change()); expect(verify()).toEqual(before)
    for (const changeState of [
      `DELETE FROM public.site_members WHERE user_id='${a.coOwner}'`,
      `UPDATE public.site_members SET status='inactive' WHERE user_id='${a.coOwner}'`,
      `UPDATE public.site_members SET manually_disabled=true WHERE user_id='${a.coOwner}'`,
    ]) expect(pg.db(`BEGIN; ${changeState}; ${actorSql('SELECT id FROM public.remote_instances',a.coOwner)}; ROLLBACK;`)).toBe('')
  })

  it('rechecks fresh membership/license/ownership/archival/location revocations without caching authorization', () => {
    const changes: Array<[string,string]> = [
      [a.assigned,`UPDATE public.site_members SET status='inactive' WHERE user_id='${a.assigned}'`],
      [a.assigned,`UPDATE public.site_members SET manually_disabled=true WHERE user_id='${a.assigned}'`],
      [a.assigned,`UPDATE public.billing SET status='inactive' WHERE site_id='${a.site}'`],
      [a.assigned,`UPDATE public.sites SET archived_at=now() WHERE id='${a.site}'`],
      [a.assigned,`UPDATE public.remote_instances SET user_id=NULL,created_by=NULL WHERE site_id='${a.site}'`],
      [a.collaborator,`UPDATE public.site_members SET restrict_to_assigned_only=true WHERE user_id='${a.collaborator}'`],
      [a.assigned,`INSERT INTO public.site_member_location_restrictions SELECT site_id,id FROM public.site_members WHERE user_id='${a.assigned}'`],
    ]
    const verify = () => changes.forEach(([user,revoke]) => tables.forEach(table => {
      expect(read(table,user)).not.toBe('')
      expect(pg.db(`BEGIN; ${revoke}; ${actorSql(`SELECT id FROM public.${table}`,user)}; ROLLBACK;`)).toBe('')
    }))
    verify(); pg.db(change()); verify()
  })

  it('retains INSERT/UPDATE/DELETE eligibility, checks, RETURNING and immutable attribution', () => {
    const trial = (sql: string,user = a.assigned) => pg.db(`BEGIN; ${actorSql(sql,user)}; ROLLBACK;`)
    const capture = () => actors.flatMap(user => tables.slice(0,2).flatMap(table => [
      trial(`UPDATE public.${table} SET payload='changed' RETURNING id`,user),
      trial(`DELETE FROM public.${table} RETURNING id`,user),
    ]))
    const verify = () => {
      expect(trial(`INSERT INTO public.remote_instances(id,site_id) VALUES ('${uuid(900)}','${a.site}') RETURNING user_id`)).toBe(a.assigned)
      expect(trial(`INSERT INTO public.instance_logs(id,site_id,instance_id) VALUES ('${uuid(900)}','${a.site}','${r.own}') RETURNING id`)).toBe(uuid(900))
      expect(() => trial(`INSERT INTO public.instance_logs(id,site_id,instance_id) VALUES ('${uuid(900)}','${a.site}','${r.hidden}')`)).toThrow(/row-level security/)
      expect(() => trial(`UPDATE public.remote_instances SET user_id='${a.owner}' WHERE id='${r.own}'`)).toThrow(/immutable/)
    }
    const before=capture(); verify(); pg.db(change()); expect(capture()).toEqual(before); verify()
  })

  it('preserves the deployed late-renewal seat grant and its reversal denial', () => {
    pg.db(`UPDATE public.billing SET stripe_customer_id='cus_fixture',subscription_status='canceled',
      auto_renew=false,subscription_end_date=now()-interval '1 hour' WHERE site_id='${a.lapsedSite}';
      INSERT INTO public.stripe_subscription_invoice_settlements VALUES ('in_fixture');
      INSERT INTO public.stripe_late_renewal_access
        (invoice_id,site_id,billing_id,customer_id,subscription_id,charge_id,payment_intent_id,
         plan,period_start,period_end,ended_at,paid_at)
        SELECT 'in_fixture',site_id,id,stripe_customer_id,stripe_subscription_id,'ch_fixture','pi_fixture',
          'enterprise',now()-interval '2 hours',now()+interval '1 day',subscription_end_date,
          now()-interval '30 minutes' FROM public.billing WHERE site_id='${a.lapsedSite}';`)
    const verify=() => {
      expect(read('remote_instances',a.lapsedMember)).toBe(r.lapsed)
      expect(pg.db(`BEGIN; INSERT INTO public.stripe_late_renewal_reversals VALUES ('ch_fixture');
        ${actorSql('SELECT id FROM public.remote_instances',a.lapsedMember)}; ROLLBACK;`)).toBe('')
    }
    verify(); pg.db(change()); verify()
  })

  it('retains the bounded invoker RPC validation, duplicates, ties, missing/cross-site/hidden parents', () => {
    const verify = () => {
      expect(pg.call(summary(`ARRAY[]::uuid[]`),a.assigned)).toBe('[]')
      expect(pg.call(summary(`ARRAY['${r.own}','${r.own}',NULL]::uuid[]`),a.assigned))
        .toBe(pg.call(summary(`ARRAY['${r.own}']::uuid[]`),a.assigned))
      for (const ids of ['NULL::uuid[]',`array_fill('${r.own}'::uuid,ARRAY[101])`])
        expect(() => pg.call(summary(ids),a.assigned)).toThrow(/at most 100/)
      expect(pg.call(summary(`ARRAY['${r.hidden}','${r.blocked}','${r.crossSite}','${uuid(999)}',NULL]::uuid[]`),a.assigned)).toBe('[]')
      expect(() => pg.call(`SELECT * FROM public.get_instance_asset_summaries(NULL,ARRAY[]::uuid[])`,a.assigned)).toThrow(/at most 100/)
    }
    verify(); pg.db(change()); verify()
  })

  it.each([
    ['ownership policy',`ALTER POLICY instance_ownership_select ON public.remote_instances USING(true)`],
    ['permissive policy',`ALTER POLICY remote_instances_access_policy ON public.remote_instances USING(true)`],
    ['write check',`ALTER POLICY remote_instances_access_policy ON public.remote_instances WITH CHECK(true)`],
    ['policy role',`ALTER POLICY instance_ownership_select ON public.remote_instances TO PUBLIC`],
    ['member policy',`ALTER POLICY license_members_access ON public.site_members USING(true)`],
    ['new membership guard',`CREATE POLICY new_guard ON public.sites AS RESTRICTIVE FOR SELECT TO authenticated USING(false)`],
    ['RLS',`ALTER TABLE public.site_members DISABLE ROW LEVEL SECURITY`],
    ['helper config',`ALTER FUNCTION public.instance_row_access(uuid,uuid,uuid) SET search_path=public`],
    ['helper ACL',`GRANT EXECUTE ON FUNCTION public.instance_row_access(uuid,uuid,uuid) TO anon`],
    ['helper owner',`ALTER FUNCTION public.user_can(uuid,text) OWNER TO auditor`],
  ])('aborts atomically on %s drift', (_name,drift) => {
    pg.db(drift); const before=untouched()
    const policies=pg.db('SELECT jsonb_agg(row_to_json(p) ORDER BY oid) FROM pg_policy p')
    expect(() => pg.db(change())).toThrow(/Unexpected Robots/)
    expect(untouched()).toBe(before)
    expect(pg.db('SELECT jsonb_agg(row_to_json(p) ORDER BY oid) FROM pg_policy p')).toBe(policies)
  })

  it('rejects replay', () => { pg.db(change()); expect(() => pg.db(change())).toThrow(/Unexpected Robots/) })

  it('abandons a contested parent lock atomically and permits a subsequent retry', async () => {
    const before=untouched()
    const holder=pg.concurrent(`BEGIN; SET application_name='robot-membership-lock';
      LOCK TABLE public.remote_instances IN ACCESS SHARE MODE; SELECT pg_sleep(4); COMMIT;`)
    for (let i=0;i<100;i++) {
      if (pg.db(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
        WHERE a.application_name='robot-membership-lock' AND l.relation='public.remote_instances'::regclass
          AND l.granted`) === '1') break
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    expect(()=>pg.db(change())).toThrow(/lock timeout/)
    await holder
    expect(untouched()).toBe(before)
    pg.db(change())
  },10_000)

  it.each([100,1000])('bounds ownership/capability execution at %i instances and improves the unchanged RPC', rows => {
    seedMembershipScale(pg.db,rows)
    const ids=pg.db(`SELECT 'ARRAY['||string_agg(quote_literal(id),',')||']::uuid[]'
      FROM (SELECT id FROM public.remote_instances WHERE site_id='${a.site}' ORDER BY id LIMIT 100) x`)
    const queries=[`SELECT count(*) FROM public.remote_instances WHERE site_id='${a.site}'`,
      `SELECT count(*) FROM public.instance_logs WHERE site_id='${a.site}'`,summary(ids)]
    const measure=(sql: string) => {
      pg.db('SELECT pg_stat_reset()')
      const started=Date.now()
      const result=pg.db(`SET track_functions='all'; ${actorSql(sql,a.assigned)};
        RESET ROLE; SELECT pg_stat_force_next_flush();`)
      const ms=Date.now()-started
      const calls=JSON.parse(pg.db(`SELECT coalesce(jsonb_object_agg(funcname,calls),'{}')
        FROM pg_stat_user_functions WHERE funcname IN ('instance_row_access','user_can','current_user_site_role')`))
      return {result,ms,calls}
    }
    const before=queries.map(measure); pg.db(change()); const after=queries.map(measure)
    after.forEach((value,i) => {
      expect(value.result).toBe(before[i].result)
      expect(value.calls.instance_row_access || 0).toBe(0)
      expect(value.calls.user_can).toBeLessThan(before[i].calls.user_can)
      if (i<2) expect(value.calls.user_can).toBeLessThanOrEqual(4)
    })
    const plan=pg.call(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${queries[0]}`,a.assigned)
    expect(plan).toContain('hashed SubPlan')
    if (process.env.REPORT_ROBOTS_CALLS==='1') console.info(JSON.stringify({rows,
      before:before.map(({ms,calls})=>({ms,calls})),after:after.map(({ms,calls})=>({ms,calls}))}))
  },30_000)
})
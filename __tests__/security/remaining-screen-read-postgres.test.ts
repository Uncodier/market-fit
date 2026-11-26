/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable, uuid } from './isolated-postgres'
import { leadActors as a } from '../leads/read-rls-postgres-fixture'
import { installRemainingScreens, screenActors, screenTables } from './remaining-screen-postgres-fixture'

const change = () => migration('20261126201000_bound_remaining_screen_membership.sql')
if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('Remaining screen bounded membership (real PostgreSQL)', () => {
  const pg = isolatedPostgres()
  beforeAll(pg.start, 30_000)
  beforeEach(() => installRemainingScreens(pg.db), 30_000)
  afterAll(pg.stop)
  const visible = (table: string, actor = a.assigned, role = 'authenticated') =>
    pg.call(`SELECT id FROM public.${table} ORDER BY id`, actor, role)
  const snapshot = () => screenActors.flatMap(actor => screenTables.map(table => visible(table, actor)))
  const attempt = (sql: string, actor = a.assigned, preparation = '', role = 'authenticated') => {
    try {
      return pg.db(`BEGIN; ${preparation} ${actorSql(sql, actor, role)}; ROLLBACK;`)
    } catch (error) {
      const text = String(error)
      if (/row-level security/.test(text)) return 'RLS_DENIED'
      if (/permission denied/.test(text)) return 'PERMISSION_DENIED'
      throw error
    }
  }

  it('preserves ownership, every member role/status, NULL flags, archival, license and location boundaries', () => {
    const before = snapshot()
    expect(visible('requirements').split('\n')).toEqual([uuid(501)])
    expect(visible('requirements', a.legacy).split('\n')).toEqual([uuid(502)])
    expect(visible('content').split('\n')).toEqual([500, 501, 503, 506].map(uuid))
    expect(visible('requirements', a.disabled)).toBe('')
    expect(visible('requirements', a.unlicensed)).toBe('')
    expect(visible('requirements', a.archivedOwner)).toBe('')
    expect(visible('requirements', a.lapsedMember)).toBe('')
    expect(visible('content', a.locationRestricted)).toBe('')
    expect(visible('deals', a.locationRestricted)).toContain(uuid(508))
    expect(visible('deals', a.locationRestricted)).not.toContain(uuid(509))
    pg.db(change())
    expect(snapshot()).toEqual(before)
  })

  it('preserves anon, service SQL/JWT roles and NULL identities, including wrapper behavior', () => {
    const samples = () => screenTables.flatMap(table => ['anon', 'authenticated', 'service_role'].flatMap(role =>
      [null, a.assigned].flatMap(actor => [role, 'service_role'].map(jwtRole => {
        const sql = `SELECT id FROM public.${table} ORDER BY id`
        return pg.db(`SET ROLE ${role}; SET request.jwt.claims='${JSON.stringify({ sub: actor, role: jwtRole })}'; ${sql}`)
      }))))
    const before = samples()
    pg.db(change())
    expect(samples()).toEqual(before)
  })

  it('preserves cross-site/direct content writes and all implicit new-row checks', () => {
    const writes = () => screenTables.flatMap(table => screenActors.flatMap(actor => {
      const parent = table === 'deal_owners' ? 'deal_id' : 'site_id'
      const foreign = table === 'deal_owners' ? uuid(503) : a.otherSite
      const own = table === 'deal_owners' ? uuid(501) : a.site
      return [
        attempt(`INSERT INTO public.${table}(id,${parent},user_id) VALUES ('${uuid(950)}','${own}','${actor}') RETURNING id`, actor),
        attempt(`INSERT INTO public.${table}(id,${parent},user_id) VALUES ('${uuid(950)}','${foreign}','${actor}') RETURNING id`, actor),
        attempt(`UPDATE public.${table} SET ${parent}='${foreign}' WHERE id='${uuid(501)}' RETURNING id`, actor),
        attempt(`UPDATE public.${table} SET user_id='${a.foreign}' WHERE id='${uuid(501)}' RETURNING id`, actor),
        attempt(`DELETE FROM public.${table} WHERE id='${uuid(501)}' RETURNING id`, actor),
      ]
    }))
    const before = writes()
    expect(attempt(`INSERT INTO public.content(id,site_id,author_id) VALUES ('${uuid(950)}','${a.otherSite}','${a.assigned}') RETURNING id`)).toBe(uuid(950))
    expect(attempt(`INSERT INTO public.requirements(id,site_id,user_id) VALUES ('${uuid(950)}','${a.otherSite}','${a.assigned}')`)).toBe('RLS_DENIED')
    pg.db(change())
    expect(writes()).toEqual(before)
    expect(attempt(`INSERT INTO public.content(id,site_id,author_id) VALUES ('${uuid(950)}','${a.otherSite}','${a.assigned}') RETURNING id`)).toBe(uuid(950))
  }, 30_000)

  it('preserves write admission for anonymous/service roles and NULL subjects', () => {
    const samples = () => screenTables.flatMap(table => ['anon', 'authenticated', 'service_role'].flatMap(role =>
      [null, a.assigned].map(actor => {
        const parent = table === 'deal_owners' ? 'deal_id' : 'site_id'
        const own = table === 'deal_owners' ? uuid(501) : a.site
        const preparation = `SET request.jwt.claims='${JSON.stringify({ sub: actor, role })}'`
        const outcome = attempt(`${preparation}; INSERT INTO public.${table}(id,${parent},user_id)
          VALUES ('${uuid(950)}','${own}','${a.assigned}') RETURNING id`, a.assigned, '', role)
        // The unchanged helper forbids anon EXECUTE. Hoisting its expression
        // changes this INSERT's 42501 text, not admission; assert the exact
        // function error separately rather than swallowing arbitrary failures.
        if (table === 'deals' && role === 'anon' && outcome === 'PERMISSION_DENIED') {
          expect(() => pg.db(`BEGIN; SET ROLE anon; ${preparation};
            INSERT INTO public.deals(id,site_id,user_id) VALUES
            ('${uuid(950)}','${a.site}','${a.assigned}'); ROLLBACK;`))
            .toThrow(/permission denied for function is_deal_owner/)
          return 'RLS_DENIED'
        }
        return outcome
      })))
    const before = samples()
    pg.db(change())
    expect(samples()).toEqual(before)
  })

  it('refreshes revocations in subsequent statements without cached membership', () => {
    const preparations = [
      `UPDATE public.site_members SET status='inactive' WHERE user_id='${a.assigned}';`,
      `UPDATE public.site_members SET manually_disabled=true WHERE user_id='${a.assigned}';`,
      `UPDATE public.billing SET status='inactive' WHERE site_id='${a.site}';`,
      `UPDATE public.sites SET archived_at=now() WHERE id='${a.site}';`,
      `DELETE FROM public.deal_owners WHERE user_id='${a.assigned}';`,
      `DELETE FROM public.site_ownership WHERE user_id='${a.coOwner}';`,
    ]
    const samples = () => preparations.flatMap(preparation => [a.assigned, a.coOwner].flatMap(actor =>
      screenTables.map(table => attempt(`SELECT id FROM public.${table} ORDER BY id`, actor, preparation))))
    const before = samples()
    expect(attempt('SELECT count(*) FROM public.requirements', a.assigned, preparations[0])).toBe('0')
    // Content's direct attribution intentionally survives membership revocation.
    expect(attempt('SELECT id FROM public.content ORDER BY id', a.assigned, preparations[0])).toContain(uuid(501))
    pg.db(change())
    expect(samples()).toEqual(before)
  })

  it('rechecks a prepared read after membership changes and actor switches in the same session', () => {
    const sample = () => pg.db(`BEGIN;
      ${actorSql(`PREPARE screen_read AS SELECT id FROM public.requirements ORDER BY id; EXECUTE screen_read;`, a.assigned)}
      RESET ROLE;
      UPDATE public.site_members SET status='inactive' WHERE user_id='${a.assigned}';
      ${actorSql('EXECUTE screen_read;', a.assigned)}
      ${actorSql('EXECUTE screen_read;', a.foreign)}
      ROLLBACK;`)
    const before = sample()
    expect(before.split('\n')).toEqual([uuid(501), uuid(503)])
    pg.db(change())
    expect(sample()).toEqual(before)
  })

  it('keeps helper definitions, owners, ACLs, security settings and unrelated policies intact', () => {
    const helpers = () => pg.db(`SELECT oid,pg_get_functiondef(oid),proowner,proacl,prosecdef,proconfig
      FROM pg_proc WHERE oid IN ('public.is_deal_owner(uuid,uuid)'::regprocedure,
        'app_auth.is_service_role_or_user_condition(boolean)'::regprocedure) ORDER BY oid`)
    const guards = () => pg.db(`SELECT row_to_json(p) FROM pg_policy p
      WHERE polname IN ('location_guard','anonymous_guard') ORDER BY oid`)
    const before = [helpers(), guards()]
    expect(pg.call(`SELECT public.is_deal_owner('${uuid(509)}','${a.locationRestricted}')`, a.locationRestricted)).toBe('f')
    expect(pg.call(`SELECT public.is_deal_owner('${uuid(508)}','${a.assigned}')`, a.locationRestricted)).toBe('f')
    pg.db(change())
    expect([helpers(), guards()]).toEqual(before)
    expect(pg.call(`SELECT public.is_deal_owner('${uuid(508)}','${a.locationRestricted}')`, a.locationRestricted)).toBe('t')
  })

  it('bounds sites/member scans at 1k and 4k candidates without changing results', () => {
    type Node = { 'Relation Name'?: string; 'Actual Loops': number; Plans?: Node[] }
    const scans = (node: Node): number => (['sites', 'site_members'].includes(node['Relation Name'] ?? '') ? node['Actual Loops'] : 0)
      + (node.Plans ?? []).reduce((sum, child) => sum + scans(child), 0)
    const measure = () => screenTables.map(table => scans(JSON.parse(pg.call(
      `EXPLAIN (ANALYZE,TIMING OFF,FORMAT JSON) SELECT id FROM public.${table}`, a.assigned))[0].Plan))
    const seed = (start: number, end: number) => {
      for (const table of screenTables.filter(t => t !== 'deal_owners')) pg.db(`
        INSERT INTO public.${table}(id,site_id,user_id) SELECT md5('scale-'||i)::uuid,'${a.site}','${a.owner}'
          FROM generate_series(${start},${end}) g(i); ANALYZE public.${table};`)
      pg.db(`INSERT INTO public.deal_owners SELECT md5('scale-'||i)::uuid,md5('scale-'||i)::uuid,'${a.owner}'
        FROM generate_series(${start},${end}) g(i); ANALYZE public.deal_owners;`)
    }
    seed(1, 1000)
    const beforeRows = screenTables.map(table => visible(table))
    const before = measure()
    expect(before.every(loops => loops > 1000)).toBe(true)
    pg.db(change())
    const after = measure()
    expect(after.every(loops => loops < 100)).toBe(true)
    expect(screenTables.map(table => visible(table))).toEqual(beforeRows)
    seed(1001, 4000)
    const larger = measure()
    expect(larger.every(loops => loops < 100)).toBe(true)
    expect(screenTables.map(table => visible(table))).toEqual(beforeRows)
    console.info('Remaining screens membership scan loops', { tables: screenTables, before, after, larger })
  }, 30_000)

  it.each(screenTables)('rejects baseline drift on %s atomically', table => {
    const policy = pg.db(`SELECT polname FROM pg_policy WHERE polrelid='public.${table}'::regclass AND polpermissive`)
    pg.db(`ALTER POLICY ${policy} ON public.${table} USING(false)`)
    const before = pg.db('SELECT row_to_json(p) FROM pg_policy p ORDER BY oid')
    expect(() => pg.db(change())).toThrow(/Unexpected membership policy/)
    expect(pg.db('SELECT row_to_json(p) FROM pg_policy p ORDER BY oid')).toEqual(before)
  })
})
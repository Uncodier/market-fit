/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { installMembershipSetsFixture, seedMembershipScale } from './membership-sets-fixture'
import { robotActors as actor, robotRows as row } from './read-rls-postgres-fixture'

const change = migration('20261128034000_batch_instance_asset_counts.sql')
const site = `'${actor.site}'::uuid`
const batch = (ids: string[]) => `ARRAY[${ids.map(id => `'${id}'`).join(',')}]::uuid[]`
const rpc = (ids: string, scope = site) => `SELECT * FROM public.get_instance_asset_summaries(${scope}, ${ids})`
const args = batch([row.own, row.created, row.hidden, row.crossSite, uuid(999), row.own])

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Socket-only PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('batched asset counts under invoker RLS', () => {
  const pg = isolatedPostgres()
  const results = (user: string, role = 'authenticated') => pg.call(`SELECT to_jsonb(x) FROM (${rpc(args)}) x ORDER BY instance_id`, user, role)
  let baseline: string[]
  const capture = () => [actor.owner, actor.assigned, actor.foreign, actor.locationRestricted].map(user => results(user))
    .concat(results(actor.owner, 'service_role'))

  beforeAll(() => {
    pg.start()
    installMembershipSetsFixture(pg.db)
    pg.db(migration('20261126201001_bound_robot_membership_sets.sql'))
    // Same-date text previews sort by ID; the latest visible image is older than all three.
    pg.db(`INSERT INTO public.assets (id,site_id,instance_id,file_path,file_type,created_at) VALUES
      ${[1, 2, 3].map(n => `('${uuid(710+n)}',${site},'${row.own}','doc-${n}','text/plain','2026-11-03')`).join(',')},
      ('${uuid(714)}',${site},'${row.own}','recent.png','image/png','2026-11-02'),
      ('${uuid(715)}',${site},'${row.own}','private.png','image/png','2026-11-04'),
      ('${uuid(716)}','${actor.otherSite}','${row.own}','wrong-site.png','image/png','2026-11-05');
      CREATE POLICY asset_fixture_denial ON public.assets AS RESTRICTIVE TO authenticated USING (id <> '${uuid(715)}');`)
    baseline = capture()
    pg.db(change)
  }, 30_000)
  afterAll(pg.stop)

  it('matches complete legacy payloads without synthesizing hidden or missing instances', () => {
    expect(capture()).toEqual(baseline)
    const rows = results(actor.assigned).split('\n').map(line => JSON.parse(line))
    expect(rows.map(r => r.instance_id)).toEqual([row.own, row.created])
    expect(rows[0]).toMatchObject({ asset_count: 5, avatar_path: 'recent.png' })
    expect(rows[0].recent_assets.map((a: { file_path: string }) => a.file_path)).toEqual(['doc-3','doc-2','doc-1'])
    expect(rows[1]).toEqual({ instance_id: row.created, asset_count: 0, recent_assets: [], avatar_path: null })
    expect(results(actor.foreign)).toBe('')
    expect(() => results(actor.owner, 'anon')).toThrow(/permission denied for function/)
  })

  it('keeps invoker execution, NULL argument errors and the raw 100-element limit', () => {
    expect(pg.db(`SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_instance_asset_summaries(uuid,uuid[])'::regprocedure`)).toBe('f')
    for (const query of [rpc('NULL'), rpc(args, 'NULL'), rpc(`array_fill('${row.own}'::uuid,ARRAY[101])`)]) {
      expect(() => pg.call(`\\set VERBOSITY verbose\n${query}`)).toThrow(/22023/)
    }
    for (const ids of [batch([]), 'ARRAY[NULL]::uuid[]']) expect(pg.call(rpc(ids))).toBe('')
    expect(pg.call(`SELECT count(*) FROM (${rpc(`array_fill('${row.own}'::uuid,ARRAY[100])`)}) x`)).toBe('1')
  })

  it('executes the count aggregate once for a full batch', () => {
    seedMembershipScale(pg.db, 200)
    const ids = pg.db(`SELECT md5('robot-scale-'||i)::uuid FROM generate_series(1,100) g(i)`).split('\n')
    // EXPLAIN of a PL/pgSQL call only shows Function Scan. Inspect its actual return query.
    const body = change.split('RETURN QUERY')[1].split(';')[0]
      .replaceAll('p_site_id', site).replaceAll('p_instance_ids', batch(ids))
    const plan = JSON.parse(pg.call(`EXPLAIN (ANALYZE, FORMAT JSON) ${body}`, actor.owner))[0].Plan
    type Plan = { 'Node Type': string; 'Group Key'?: string[]; 'Actual Loops': number; Plans?: Plan[] }
    const nodes = (p: Plan): Plan[] => [p, ...(p.Plans ?? []).flatMap(nodes)]
    expect(plan['Actual Rows']).toBe(100)
    expect(nodes(plan).filter(p => p['Node Type'] === 'Aggregate' &&
      p['Group Key']?.some(k => k.endsWith('.instance_id'))).map(p => p['Actual Loops'])).toEqual([1])
  })
})
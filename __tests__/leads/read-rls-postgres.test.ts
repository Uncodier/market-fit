/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { actorSql, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { installLeadReadFixture, leadActors as a, seedLeadReadScale } from './read-rls-postgres-fixture'

interface PlanNode {
  'Node Type': string
  'Relation Name'?: string
  'Actual Loops': number
  Plans?: PlanNode[]
}

interface Explain {
  Plan: PlanNode
  'Execution Time': number
}

const siteFilter = `l.site_id='${a.site}'`
const listSql = `SELECT l.id,l.name,l.created_at,company.data FROM public.leads l
  LEFT JOIN LATERAL (SELECT jsonb_build_object('name',c.name) AS data FROM public.companies c
    WHERE c.id=l.company_id LIMIT 1) company ON true
  WHERE ${siteFilter} ORDER BY l.created_at DESC LIMIT 1000`
const countSql = `SELECT count(*) FROM public.leads l WHERE ${siteFilter}`
const listAndCountSql = `WITH page AS (${listSql}), visible AS (${countSql})
  SELECT (SELECT count FROM visible) AS total, count(*) AS returned, jsonb_agg(page) AS leads FROM page`
const filename = '20261123183000_bound_leads_rls_membership.sql'
const change = () => migration(filename)

it('matches the canonical migration when the schema repository is checked out', () => {
  const canonical = resolve(process.cwd(), '../makinari-db-scheme/supabase/migrations', filename)
  expect(change()).toContain('ALTER POLICY leads_unified ON public.leads')
  if (existsSync(canonical)) expect(readFileSync(canonical, 'utf8')).toBe(change())
})

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)]
}

function authorizationScans(plan: PlanNode) {
  return nodes(plan).filter(node => ['sites', 'site_members', 'site_ownership'].includes(node['Relation Name'] ?? ''))
    .reduce((sum, node) => sum + node['Actual Loops'], 0)
}

function explain(call: ReturnType<typeof isolatedPostgres>['call'], sql: string, actor = a.collaborator): Explain {
  return JSON.parse(call(`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${sql}`, actor))[0]
}

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Socket-only PostgreSQL binaries required')

;(postgresAvailable ? describe : describe.skip)('Leads read plan in socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(pg.start, 30_000)
  beforeEach(() => installLeadReadFixture(pg.db), 30_000)
  afterAll(pg.stop)

  it('changes thousands of parent-policy scans into small per-actor sets for the list and exact total', () => {
    seedLeadReadScale(pg.db)
    expect(pg.call(countSql, a.collaborator)).toBe('6096')
    const baseline = [listSql, countSql].map(sql => explain(pg.call, sql))
    for (const sample of baseline) expect(authorizationScans(sample.Plan)).toBeGreaterThan(1000)
    pg.db(change())
    expect(pg.call(countSql, a.collaborator)).toBe('6096')
    const optimized = [listSql, countSql].map(sql => explain(pg.call, sql))
    for (const sample of optimized) expect(authorizationScans(sample.Plan)).toBeLessThan(100)
    // PostgREST can count separately inside the list request. Even then, the
    // total is not capped at the page size and neither plan rescans per lead.
    const summary = pg.call(`SELECT total, returned FROM (${listAndCountSql}) result`, a.collaborator)
    expect(summary).toBe('6096|1000')
    expect(authorizationScans(explain(pg.call, listAndCountSql).Plan)).toBeLessThan(100)
    if (process.env.REPORT_LEADS_PLANS === '1') {
      console.info([baseline, optimized].map(samples => samples.map(plan => ({
        parentScans: authorizationScans(plan.Plan), ms: plan['Execution Time'],
      }))))
    }
  }, 30_000)

  it('bounds sparse assigned-only reads without exposing the other leads in the site', () => {
    pg.db(`INSERT INTO public.leads(id,site_id,user_id,assignee_id,company_id,created_at)
      SELECT md5('assigned-read-'||i)::uuid, '${a.site}', '${a.owner}',
        CASE WHEN i<=57 THEN '${a.assigned}'::uuid ELSE NULL END,
        '${uuid(300)}', now()-i*interval '1 second' FROM generate_series(1,3052) g(i);
      ANALYZE public.leads; ANALYZE public.sites; ANALYZE public.site_members;`)
    const selection = `SELECT l.id FROM public.leads l WHERE ${siteFilter} ORDER BY l.id`
    const before = pg.call(selection, a.assigned)
    expect(before.split('\n')).toHaveLength(59)
    expect(pg.call(countSql, a.owner)).toBe('3056')
    const baseline = [listSql, countSql].map(sql => explain(pg.call, sql, a.assigned))
    for (const sample of baseline) expect(authorizationScans(sample.Plan)).toBeGreaterThan(3000)

    pg.db(change())

    expect(pg.call(selection, a.assigned)).toBe(before)
    expect(pg.call(countSql, a.owner)).toBe('3056')
    expect(pg.call(`SELECT total, returned FROM (${listAndCountSql}) result`, a.assigned)).toBe('59|59')
    for (const actor of [a.assigned, a.owner]) {
      for (const sql of [listSql, countSql, listAndCountSql]) {
        expect(authorizationScans(explain(pg.call, sql, actor).Plan)).toBeLessThan(100)
      }
    }
  }, 30_000)

  it('preserves visible rows and exact filtered totals for every access class', () => {
    const selection = 'SELECT id FROM public.leads ORDER BY id;'
    const cases: Array<[string, string[], string?]> = [
      [a.owner, [100, 101, 102, 103].map(uuid)],
      [a.coOwner, [100, 101, 102, 103].map(uuid)],
      [a.admin, [100, 101, 102, 103].map(uuid)],
      [a.collaborator, [100, 101, 102, 103].map(uuid)],
      [a.marketing, [100, 101, 102, 103].map(uuid)],
      [a.assigned, [100, 101].map(uuid)],
      [a.legacy, [uuid(102)]],
      [a.foreign, [uuid(104)]],
      [a.inactive, []], [a.locationRestricted, []], [a.pending, []], [a.disabled, []],
      [a.unlicensed, []], [a.archivedOwner, []], [a.lapsedMember, []], [a.owner, [], 'anon'],
      [a.owner, [100, 101, 102, 103, 104, 105, 106, 107].map(uuid), 'service_role'],
    ]
    const verify = () => {
      for (const [user, expected, role] of cases) expect(pg.call(selection, user, role)).toBe(expected.join('\n'))
      expect(pg.call(`${countSql} AND l.segment_id='${uuid(400)}'`, a.assigned)).toBe('1')
    }
    verify()
    pg.db(change())
    verify()
  })

  it('preserves implicit new-row checks and evaluates membership and location changes afresh', () => {
    const inTransaction = (sql: string, user: string, preparation = '') =>
      pg.db(`BEGIN; ${preparation} ${actorSql(sql, user)}; ROLLBACK;`)
    const verify = () => {
      expect(inTransaction(`UPDATE public.leads SET name='Updated' WHERE id='${uuid(100)}' RETURNING id`, a.assigned)).toBe(uuid(100))
      expect(inTransaction(`DELETE FROM public.leads WHERE id='${uuid(103)}' RETURNING id`, a.assigned)).toBe('')
      expect(inTransaction(`INSERT INTO public.leads(id,site_id,user_id) VALUES
        ('${uuid(110)}','${a.site}','${a.assigned}') RETURNING id`, a.assigned)).toBe(uuid(110))
      expect(() => inTransaction(`UPDATE public.leads SET assignee_id=NULL WHERE id='${uuid(100)}'`, a.assigned)).toThrow(/row-level security/)
      expect(() => inTransaction(`UPDATE public.leads SET site_id='${a.otherSite}' WHERE id='${uuid(101)}'`, a.assigned)).toThrow(/row-level security/)
      expect(() => inTransaction(`INSERT INTO public.leads(id,site_id,user_id) VALUES
        ('${uuid(110)}','${a.otherSite}','${a.assigned}')`, a.assigned)).toThrow(/row-level security/)
      expect(inTransaction(countSql, a.coOwner,
        `UPDATE public.site_members SET status='inactive' WHERE user_id='${a.coOwner}';`)).toBe('0')
      expect(inTransaction(countSql, a.assigned,
        `UPDATE public.billing SET status='inactive' WHERE site_id='${a.site}';`)).toBe('0')
      expect(inTransaction(countSql, a.locationRestricted,
        `DELETE FROM public.site_member_location_restrictions;`)).toBe('4')
    }
    verify()
    pg.db(change())
    verify()
  })

  it('does not overwrite an unexpected policy', () => {
    pg.db('ALTER POLICY leads_unified ON public.leads USING (false);')
    expect(() => pg.db(change())).toThrow(/Unexpected leads_unified policy/)
    expect(pg.call(countSql, a.owner)).toBe('0')
  })
})
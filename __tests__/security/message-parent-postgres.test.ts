/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable, uuid } from './isolated-postgres'
import { leadActors as a } from '../leads/read-rls-postgres-fixture'
import { installMessageParentFixture, seedMessageParentScale } from './message-parent-postgres-fixture'

const change = () => migration('20261126201002_bound_message_parent_lookup.sql')
const message = (id: number) => `md5('message-${uuid(id)}')::uuid`
const actors = [a.owner, a.coOwner, a.assigned, a.collaborator, a.legacy, a.inactive,
  a.disabled, a.pending, a.unlicensed, a.foreign, a.locationRestricted, a.archivedOwner, a.lapsedMember]
type Plan = { 'Relation Name'?: string; Alias?: string; 'Node Type': string; 'Index Cond'?: string;
  'Actual Loops': number; 'Actual Rows': number; 'Rows Removed by Filter'?: number; Plans?: Plan[] }
const flatten = (node: Plan): Plan[] => [node, ...(node.Plans ?? []).flatMap(flatten)]

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('PostgreSQL binaries required')
;(postgresAvailable ? describe : describe.skip)('Message parent lookup under real PostgreSQL RLS', () => {
  const pg = isolatedPostgres()
  beforeAll(pg.start, 30_000)
  beforeEach(() => installMessageParentFixture(pg.db), 30_000)
  afterAll(pg.stop)
  const policyCatalog = () => pg.db(`SELECT jsonb_agg(to_jsonb(p) ORDER BY polrelid,polname)
    FROM (SELECT polrelid,polname,polcmd,polroles,polpermissive,polwithcheck,
      CASE WHEN (polrelid='public.messages'::regclass AND polname='messages_unified_access_policy')
        OR (polrelid='public.conversations'::regclass AND polname='conversations_unified_access_policy')
        THEN NULL ELSE polqual END AS polqual FROM pg_policy) p`)
  const visible = (actor: string, role = 'authenticated') =>
    pg.call('SELECT id FROM public.messages ORDER BY id', actor, role)
  const hasMessage = (id: number, actor = a.assigned) =>
    pg.call(`SELECT count(*) FROM public.messages WHERE id=${message(id)}`, actor)

  it('matches applied policy across identities, direct branches, parent RLS and cross-site leads', () => {
    const nullIdentity = (role: string) => pg.db(`SET ROLE ${role};
      SET request.jwt.claims='{"role":"${role}"}'; SELECT id FROM public.messages ORDER BY id`)
    const snapshot = () => [...actors.map(actor => visible(actor)),
      ...actors.map(actor => pg.call('SELECT id FROM public.conversations ORDER BY id', actor)),
      ...['anon', 'service_role'].map(role => visible(a.owner, role)),
      ...['authenticated', 'anon'].map(nullIdentity)]
    const verify = () => {
      for (const id of [600, 601, 603, 604]) expect(hasMessage(id)).toBe('1')
      for (const id of [602, 605, 606, 607, 608, 609, 610, 611]) expect(hasMessage(id)).toBe('0')
      for (const id of [700, 701, 702]) expect(visible(a.assigned)).toContain(uuid(id))
      expect(visible(a.assigned)).not.toContain(uuid(703))
      expect(hasMessage(602, a.coOwner)).toBe('1')
      expect(hasMessage(608, a.owner)).toBe('0')
      expect(pg.call(`SELECT count(*) FROM public.conversations WHERE id='${uuid(606)}'`, a.assigned)).toBe('1')
      expect(nullIdentity('authenticated').split('\n')).toHaveLength(16)
      expect(nullIdentity('anon')).toBe('')
    }
    verify()
    const before = snapshot()
    const policies = policyCatalog()
    pg.db(change()); verify(); expect(snapshot()).toEqual(before)
    expect(policyCatalog()).toBe(policies)
    // Reinstall the applied baseline, then compare a visible lead from another site.
    const baseline = migration('20261126195000_bound_chat_task_membership.sql')
    pg.db(baseline.slice(baseline.indexOf('ALTER POLICY conversations_unified_access_policy'), baseline.indexOf('COMMIT;')))
    pg.db(`INSERT INTO public.site_members(site_id,user_id,role,status,restrict_to_assigned_only)
      VALUES ('${a.otherSite}','${a.assigned}','collaborator','active',true);
      INSERT INTO public.billing(site_id,status,plan) VALUES ('${a.otherSite}','active','enterprise');`)
    expect(hasMessage(607)).toBe('1')
    const crossSite = snapshot(); pg.db(change())
    expect(snapshot()).toEqual(crossSite); expect(hasMessage(607)).toBe('1')
  })

  it('keeps implicit insert/update checks, delete visibility and fresh revocation', () => {
    const attempt = (sql: string, setup = '') => pg.db(`BEGIN; ${setup} ${actorSql(sql, a.assigned)}; ROLLBACK;`)
    const verify = () => {
      for (const parent of [600, 601, 603, 604]) {
        expect(attempt(`INSERT INTO public.messages(id,conversation_id) VALUES ('${uuid(800)}','${uuid(parent)}') RETURNING id`)).toBe(uuid(800))
      }
      expect(attempt(`INSERT INTO public.conversations(id,site_id,lead_id)
        VALUES ('${uuid(800)}','${a.site}','${uuid(100)}') RETURNING id`)).toBe(uuid(800))
      expect(() => attempt(`INSERT INTO public.conversations(id,site_id,lead_id)
        VALUES ('${uuid(800)}','${a.site}','${uuid(103)}')`)).toThrow(/row-level security/)
      expect(() => attempt(`UPDATE public.conversations SET lead_id='${uuid(103)}'
        WHERE id='${uuid(600)}'`)).toThrow(/row-level security/)
      for (const parent of [602, 605, 606, 608, 609]) {
        expect(() => attempt(`INSERT INTO public.messages(id,conversation_id) VALUES ('${uuid(800)}','${uuid(parent)}')`)).toThrow(/row-level security/)
        expect(() => attempt(`UPDATE public.messages SET conversation_id='${uuid(parent)}' WHERE id=${message(600)}`)).toThrow(/row-level security/)
      }
      expect(attempt(`UPDATE public.messages SET conversation_id='${uuid(603)}' WHERE id=${message(600)} RETURNING id`)).not.toBe('')
      expect(attempt(`UPDATE public.messages SET conversation_id='${uuid(600)}' WHERE id=${message(602)} RETURNING id`)).toBe('')
      expect(attempt(`DELETE FROM public.messages WHERE id=${message(600)} RETURNING id`)).not.toBe('')
      expect(attempt(`DELETE FROM public.messages WHERE id=${message(602)} RETURNING id`)).toBe('')
      for (const column of ['user_id', 'agent_id', 'visitor_id']) {
        expect(attempt(`INSERT INTO public.messages(id,${column}) VALUES ('${uuid(800)}','${a.assigned}') RETURNING id`)).toBe(uuid(800))
      }
      for (const setup of [`UPDATE public.site_members SET status='inactive' WHERE user_id='${a.assigned}';`,
        `UPDATE public.billing SET status='inactive' WHERE site_id='${a.site}';`,
        `UPDATE public.sites SET archived_at=now() WHERE id='${a.site}';`]) {
        expect(attempt(`SELECT count(*) FROM public.messages WHERE id=${message(600)}`, setup)).toBe('0')
      }
    }
    verify(); pg.db(change()); verify()
  })

  it('bounds parent work for threads, broad reads and complete lateral inbox embeds on multiple sites', () => {
    seedMessageParentScale(pg.db)
    const queries = {
      thread: `SELECT id,content FROM public.messages WHERE conversation_id=md5('inbox-1')::uuid ORDER BY created_at DESC,id DESC LIMIT 100`,
      leadThread: `SELECT id,content FROM public.messages WHERE conversation_id='${uuid(600)}' ORDER BY created_at DESC,id DESC LIMIT 100`,
      batch: `SELECT id,content FROM public.messages WHERE conversation_id IN (
        ${Array.from({ length: 21 }, (_, i) => `md5('inbox-${i + 1}')::uuid`).join(',')})
        ORDER BY created_at DESC,id DESC LIMIT 100`,
      broad: 'SELECT id FROM public.messages ORDER BY id',
      embed: `SELECT inbox.id,l.name,m.content FROM (SELECT * FROM public.conversations
        WHERE site_id='${a.site}' AND is_archived=false AND status<>'pending'
        ORDER BY last_message_at DESC NULLS LAST,created_at DESC,id DESC LIMIT 21) inbox
        LEFT JOIN public.leads l ON l.id=inbox.lead_id
        LEFT JOIN LATERAL (SELECT content FROM public.messages WHERE conversation_id=inbox.id
          ORDER BY created_at DESC,id DESC LIMIT 1) m ON true ORDER BY inbox.id`,
    }
    const samples = [a.owner, a.assigned].flatMap(actor => Object.entries(queries).map(([name, sql]) => ({ actor, name, sql })))
    const rows = () => samples.map(s => pg.call(`SELECT count(*),md5(jsonb_agg(to_jsonb(r))::text) FROM (${s.sql}) r`, s.actor))
    const explain = (s: typeof samples[number]) => JSON.parse(pg.call(`EXPLAIN (ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) ${s.sql}`, s.actor))[0]
    const parentNodes = (plan: Plan) => flatten(plan).filter(n => n['Relation Name'] === 'conversations' && n.Alias === 'c')
    const work = (nodes: Plan[]) => nodes.reduce((sum, n) => sum + n['Actual Loops'] * (n['Actual Rows'] + (n['Rows Removed by Filter'] ?? 0)), 0)
    const before = rows()
    for (const sample of samples) {
      const result = explain(sample)
      expect(work(parentNodes(result.Plan))).toBeGreaterThan(12000)
      console.info(`message-parent BEFORE ${sample.actor === a.owner ? 'owner' : 'restricted'} ${sample.name}: parent work=${work(parentNodes(result.Plan))}, execution=${result['Execution Time']}ms`)
    }
    pg.db(change())
    expect(rows()).toEqual(before)
    for (const sample of samples) {
      const result = explain(sample)
      const parents = parentNodes(result.Plan)
      expect(parents.length).toBeGreaterThan(0)
      for (const parent of parents) {
        expect(parent['Node Type']).toBe('Index Scan')
        expect(parent['Index Cond']).toContain('conversation_id')
        expect(parent['Actual Rows'] + (parent['Rows Removed by Filter'] ?? 0)).toBeLessThanOrEqual(1)
      }
      const bounds: Record<string, number> = { thread: 3, leadThread: 4, batch: 63, embed: 21, broad: 37000 }
      const bound = bounds[sample.name]
      expect(work(parents)).toBeLessThanOrEqual(bound)
      expect(work(parents)).toBeGreaterThan(0)
      if (sample.name === 'leadThread' && sample.actor === a.assigned) {
        const lead = flatten(result.Plan).filter(n => n['Relation Name'] === 'leads'
          && n['Index Cond']?.includes('c.lead_id') && n['Actual Loops'] > 0)
        expect(lead.length).toBeGreaterThan(0)
        // Both the message predicate and the conversation's own RLS check the
        // same lead by primary key; neither may materialize actor-wide leads.
        expect(work(lead)).toBeLessThanOrEqual(8)
        expect(flatten(result.Plan).filter(n => n['Relation Name'] === 'leads' && n['Actual Loops'] > 0)
          .every(n => n['Node Type'] === 'Index Scan' && n['Index Cond']?.includes('lead_id'))).toBe(true)
      }
      console.info(`message-parent ${sample.actor === a.owner ? 'owner' : 'restricted'} ${sample.name}: parent work=${work(parents)}, execution=${result['Execution Time']}ms`)
    }
  }, 120_000)

  it('bounds conversation lead checks even when the lead branch determines visibility', () => {
    seedMessageParentScale(pg.db)
    const queries = [
      `SELECT id FROM public.conversations WHERE id='${uuid(600)}'`,
      `SELECT id FROM public.conversations WHERE site_id='${a.site}' ORDER BY id LIMIT 100`,
    ]
    const rows = () => queries.map(sql => pg.call(sql, a.assigned))
    const plan = (sql: string) => JSON.parse(pg.call(`EXPLAIN (ANALYZE,TIMING OFF,FORMAT JSON) ${sql}`, a.assigned))[0].Plan
    const leads = (root: Plan) => flatten(root).filter(n => n['Relation Name'] === 'leads' && n['Actual Loops'] > 0)
    const before = rows()
    expect(leads(plan(queries[0])).some(n => n['Actual Rows'] > 12000)).toBe(true)
    pg.db(change())
    expect(rows()).toEqual(before)
    for (const sql of queries) {
      const checks = leads(plan(sql))
      expect(checks.length).toBeGreaterThan(0)
      for (const check of checks) {
        expect(check['Node Type']).toBe('Index Scan')
        expect(check['Index Cond']).toContain('lead_id')
        expect(check['Actual Rows'] + (check['Rows Removed by Filter'] ?? 0)).toBeLessThanOrEqual(1)
        expect(check['Actual Loops']).toBeLessThanOrEqual(33)
      }
    }
  }, 30_000)

  it.each([
    'ALTER POLICY messages_unified_access_policy ON public.messages USING(false)',
    'ALTER POLICY messages_unified_access_policy ON public.messages WITH CHECK(true)',
    'ALTER POLICY messages_unified_access_policy ON public.messages TO authenticated',
  ])('rejects baseline drift atomically: %s', sql => {
    pg.db(sql)
    const catalog = () => pg.db(`SELECT row_to_json(p) FROM pg_policy p WHERE polrelid='public.messages'::regclass ORDER BY polname`)
    const before = catalog()
    expect(() => pg.db(change())).toThrow(/Unexpected messages parent policy/)
    expect(catalog()).toBe(before)
  })

  it('rejects conversation policy drift before changing either policy', () => {
    pg.db('ALTER POLICY conversations_unified_access_policy ON public.conversations USING(false)')
    const before = visible(a.assigned)
    expect(() => pg.db(change())).toThrow(/Unexpected conversations parent policy/)
    expect(visible(a.assigned)).toBe(before)
  })
})
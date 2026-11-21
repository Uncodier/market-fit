/** @jest-environment node */
import { ids, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { agent, assign, guardMigration, insert, installAgents, other, site, verbose } from './supervisor-postgres-fixture'

const pg = isolatedPostgres()
const check = (sql: string) => expect(() => pg.db(verbose(sql))).toThrow(/23514: Invalid agent supervisor hierarchy/)
const parent = (id: number) => pg.db(`SELECT supervisor FROM public.agents WHERE id=${agent(id)}`)
const beforeRows = `SELECT id, xmin, site_id, supervisor FROM public.agents ORDER BY id`

;(postgresAvailable ? describe : describe.skip)('agent supervisor integrity in disposable PostgreSQL', () => {
  let original: string, migrated: string
  beforeAll(() => {
    pg.start()
    installAgents(pg.db)
    // Dirty but FK-valid history is present BEFORE executing the full migration.
    pg.db(`${insert(101, 101)}; ${insert(102, null, other)}; ${insert(103, 102)};
      ${insert(104)}; ${insert(105, 104)}; ${assign(104, 105)}; ${insert(106, null, other)};`)
    original = pg.db(beforeRows)
    pg.db(`SET ROLE postgres; ${guardMigration}`)
    migrated = pg.db(beforeRows)
  }, 30000)
  afterAll(() => pg.stop())

  it('does not rewrite, backfill or quarantine legacy data; only changed edges are checked', () => {
    expect(migrated).toBe(original)
    expect(pg.db('SELECT count(*) FROM agent_hierarchy_private.site_fences')).toBe('0')
    pg.db(`UPDATE public.agents SET name='profile edit', supervisor=supervisor, site_id=site_id WHERE id IN
      (${agent(101)}, ${agent(103)}, ${agent(104)})`)
    expect(pg.db('SELECT count(*) FROM agent_hierarchy_private.site_fences')).toBe('0')
    check(insert(107, 101)) // Do not join a pre-existing loop.
    check(insert(107, 103)) // Do not join a chain that escapes the site one hop later.
    check(insert(107, 104))
    pg.db(`${assign(101, null)}; ${assign(103, null)}; ${assign(104, null)}; ${insert(107, 105)}`)
    expect(parent(107)).toBe(uuid(105))
  })

  it('checks new draft/template INSERTs, permits roots and preserves the original FK and PK errors', () => {
    pg.call(`INSERT INTO public.agents(id, site_id, name, role, configuration)
      VALUES (${agent(201)}, '${site}', 'Independent root', 'support', '{"agentOrigin":"independent"}')`)
    pg.call(`INSERT INTO public.agents(id, site_id, name, role, supervisor)
      VALUES (${agent(202)}, '${site}', 'Template setup', 'support', ${agent(201)})`)
    expect(parent(202)).toBe(uuid(201))
    for (const invalid of [insert(203, 203), insert(203, 106)]) {
      expect(() => pg.call(invalid)).toThrow('Invalid agent supervisor hierarchy')
    }
    expect(() => pg.db(verbose(insert(203, 999)))).toThrow(/23503:[\s\S]*agents_supervisor_fkey/)
    expect(() => pg.db(verbose(insert(202)))).toThrow(/23505:/)
    expect(() => pg.db(verbose(`DELETE FROM public.agents WHERE id=${agent(201)}`))).toThrow(/23503:/)
  })

  it('rejects direct/indirect cycles, accepts valid multirow flips and checks forward references', () => {
    pg.db(`INSERT INTO public.agents(id, supervisor, site_id) VALUES
      (${agent(303)},${agent(302)},'${site}'), (${agent(302)},${agent(301)},'${site}'), (${agent(301)},NULL,'${site}')`)
    check(assign(301, 301)); check(assign(302, 303)); check(assign(301, 303))
    check(`INSERT INTO public.agents(id, supervisor, site_id) VALUES
      (${agent(304)},${agent(305)},'${site}'), (${agent(305)},${agent(304)},'${site}')`)
    check(`UPDATE public.agents SET supervisor = CASE WHEN id=${agent(301)} THEN ${agent(303)} ELSE ${agent(301)} END
      WHERE id IN (${agent(301)}, ${agent(303)})`)
    expect(parent(301)).toBe('')
    pg.db(`UPDATE public.agents SET supervisor = CASE WHEN id=${agent(301)} THEN ${agent(302)} ELSE NULL END
      WHERE id IN (${agent(301)}, ${agent(302)})`)
    expect(parent(301)).toBe(uuid(302))
    pg.db(assign(301, null))
  })

  it('checks both incoming and outgoing edges on transfers; permits a whole-tree move in one statement', () => {
    pg.db(`${insert(401)}; ${insert(402, 401)}; ${insert(403)}`)
    const move = (ids: number[]) => `UPDATE public.agents SET site_id='${other}' WHERE id IN (${ids.map(agent).join(',')})`
    check(move([401])); check(move([402]))
    pg.db(`${move([403])}; ${move([401, 402])};`)
    expect(pg.db(`SELECT count(*) FROM public.agents WHERE site_id='${other}' AND id IN (${agent(401)},${agent(402)},${agent(403)})`)).toBe('3')
    expect(parent(402)).toBe(uuid(401))
  })

  it('stops after 128 ancestors, failing closed rather than truncating the walk', () => {
    const chain = Array.from({ length: 129 }, (_, i) => `(${agent(500 + i)}, '${site}', ${i ? agent(499 + i) : 'NULL'})`)
    pg.db(`INSERT INTO public.agents(id, site_id, supervisor) VALUES ${chain.join(',')}`)
    check(insert(629, 628))
    pg.db(insert(629, 627))
    expect(parent(629)).toBe(uuid(627))
  })

  it('checks incoming edges even when the same UUID is reused by a different root in one command', () => {
    pg.db(`${insert(651)}; ${insert(652, 651)};`)
    check(`WITH moved AS (UPDATE public.agents SET id=${agent(653)} WHERE id=${agent(651)} RETURNING site_id)
      INSERT INTO public.agents(id, site_id) SELECT ${agent(651)}, '${other}' FROM moved`)
    check(`WITH removed AS (DELETE FROM public.agents WHERE id=${agent(651)} RETURNING site_id)
      INSERT INTO public.agents(id, site_id) SELECT ${agent(651)}, '${other}' FROM removed`)
    expect(pg.db(`SELECT site_id FROM public.agents WHERE id=${agent(651)}`)).toBe(site)
  })

  it('preserves site deletion cascades with and without an existing hierarchy fence', () => {
    const tenants = [uuid(661), uuid(662)]
    pg.db(`INSERT INTO public.sites(id) VALUES ('${tenants[0]}'), ('${tenants[1]}');
      ${insert(663, null, tenants[0])}; ${insert(664, null, tenants[1])}; ${insert(665, 664, tenants[1])}`)
    const sites = tenants.map(id => `'${id}'`).join(',')
    const fences = `SELECT count(*) FROM agent_hierarchy_private.site_fences WHERE site_id IN (${sites})`
    expect(pg.db(fences)).toBe('1')
    pg.db(`DELETE FROM public.sites WHERE id IN (${sites})`)
    expect(pg.db(fences)).toBe('0')
    expect(pg.db(`SELECT count(*) FROM public.agents WHERE site_id IN (${sites})`)).toBe('0')
  })

  it('does not create a privileged read surface or return hidden ancestors to a caller', () => {
    pg.db(`${insert(701)}; ${insert(702, 701)}; UPDATE public.agents SET user_id='${ids.foreign}' WHERE id=${agent(702)};`)
    expect(pg.call(`SELECT count(*) FROM public.agents WHERE id IN (${agent(702)},${agent(106)})`)).toBe('0')
    const denial = () => pg.db(verbose(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${ids.owner}"}'; ${assign(701, 702)}`))
    expect(denial).toThrow(/23514: Invalid agent supervisor hierarchy[\s\S]*CONSTRAINT NAME:  agents_supervisor_hierarchy/)
    expect(denial).not.toThrow(uuid(702))
    expect(pg.call(`${assign(106, 701)} RETURNING id`)).toBe('') // RLS still owns the write boundary.
    expect(() => pg.call(insert(703, null, other))).toThrow(/row-level security/)
    for (const role of ['anon', 'authenticated', 'service_role']) {
      expect(pg.db(`SELECT has_schema_privilege('${role}','agent_hierarchy_private','USAGE'),
        has_table_privilege('${role}','agent_hierarchy_private.install_marker','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
        has_table_privilege('${role}','agent_hierarchy_private.site_fences','SELECT,INSERT,UPDATE,DELETE'),
        has_function_privilege('${role}','agent_hierarchy_private.check_supervisor()','EXECUTE')`)).toBe('f|f|f|f')
    }
    expect(parent(701)).toBe('')
  })
})
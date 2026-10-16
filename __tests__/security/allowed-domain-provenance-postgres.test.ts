/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, postgresAvailable, uuid } from './isolated-postgres'
import { domainSecuritySnapshot, installDomainFixture, otherRequirement, provenanceSql,
  requirement, secondRequirement } from './allowed-domain-provenance-fixture'

const suite = postgresAvailable ? describe : describe.skip
const insert = (domain: string, source = 'harness', reference: string | null = requirement, site = ids.site) =>
  `INSERT INTO public.allowed_domains(site_id,domain,source,requirement_id)
    VALUES ('${site}','${domain}','${source}',${reference ? `'${reference}'` : 'NULL'})`

suite('allowed-domain provenance in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  const row = (domain: string) => JSON.parse(pg.db(
    `SELECT row_to_json(d) FROM public.allowed_domains d WHERE domain='${domain}'`,
  ))
  const harness = (domain = 'generated.example.test', reference = requirement) =>
    pg.call(insert(domain, 'harness', reference), ids.owner, 'service_role')

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => { installDomainFixture(pg.db); pg.db(provenanceSql) })

  it('applies without data reclassification and preserves existing RLS, grants and archival protection', () => {
    installDomainFixture(pg.db)
    const before = pg.db('SELECT jsonb_agg(to_jsonb(d) ORDER BY domain) FROM public.allowed_domains d')
    const security = pg.db(domainSecuritySnapshot)
    pg.db(provenanceSql)
    expect(pg.db(domainSecuritySnapshot)).toBe(security)
    const after = JSON.parse(pg.db('SELECT jsonb_agg(to_jsonb(d) ORDER BY domain) FROM public.allowed_domains d'))
    expect(after).toEqual(JSON.parse(before).map((d: object) => ({ ...d, source: 'unknown', requirement_id: null })))
    expect(row('preview.vercel.app').source).toBe('unknown')
  })

  it('accepts manual user writes and legacy inserts without provenance', () => {
    pg.call(insert('user.vercel.app', 'user', null))
    pg.call(`INSERT INTO public.allowed_domains(site_id,domain) VALUES ('${ids.site}','legacy.example.test')`)
    expect(row('user.vercel.app')).toMatchObject({ source: 'user', requirement_id: null })
    expect(row('legacy.example.test')).toMatchObject({ source: 'unknown', requirement_id: null })
    pg.call("UPDATE public.allowed_domains SET domain='edited.example.test' WHERE domain='legacy.example.test'")
    expect(row('edited.example.test').source).toBe('unknown')
    expect(() => pg.call("UPDATE public.allowed_domains SET source='user' WHERE domain='edited.example.test'"))
      .toThrow('server managed')
    expect(() => pg.call("UPDATE public.allowed_domains SET source='unknown' WHERE domain='user.vercel.app'"))
      .toThrow('server managed')
  })

  it('allows service-role inserts through JWT role or SQL role without weakening constraints', () => {
    harness()
    // Direct SQL service jobs may have no JWT. Other sessions have a trusted service JWT.
    pg.db(`SET ROLE service_role; ${insert('sql-job.example.test')}`)
    pg.db(`SET request.jwt.claim.role='service_role'; ${insert('jwt-job.example.test')}`)
    for (const domain of ['generated.example.test', 'sql-job.example.test', 'jwt-job.example.test']) {
      expect(row(domain)).toMatchObject({ site_id: ids.site, source: 'harness', requirement_id: requirement })
    }
    expect(() => pg.call(insert('foreign.example.test', 'harness', otherRequirement), ids.owner, 'service_role'))
      .toThrow('allowed_domains_requirement_site_fkey')
    expect(() => pg.call(insert('missing.example.test', 'harness', uuid(999)), ids.owner, 'service_role'))
      .toThrow('allowed_domains_requirement_site_fkey')
    expect(() => pg.call(insert('invalid.example.test', 'automatic', null), ids.owner, 'service_role'))
      .toThrow('allowed_domains_source_check')
    expect(() => pg.db(`INSERT INTO public.allowed_domains(site_id,domain,source) VALUES ('${ids.site}','null.example.test',NULL)`))
      .toThrow('null value in column "source"')
  })

  it.each(['authenticated', 'anon'])('rejects automatic labels and requirement references from %s', role => {
    // Give anon permissive access in this fixture only: the guard must not depend
    // on existing RLS/grants happening to reject an automatic provenance write.
    if (role === 'anon') pg.db(`GRANT SELECT ON public.sites TO anon;
      GRANT SELECT, INSERT, UPDATE ON public.allowed_domains TO anon;
      CREATE POLICY anon_test ON public.allowed_domains TO anon USING (true) WITH CHECK (true);`)
    for (const [source, reference] of [['harness', null], ['user', requirement], ['unknown', requirement]] as const) {
      expect(() => pg.call(insert('spoof.example.test', source, reference), ids.owner, role)).toThrow('server managed')
    }
  })

  it('does not trust mismatched browser/service role claims', () => {
    expect(() => pg.db(`SET ROLE authenticated; SET request.jwt.claims='{"role":"service_role","sub":"${ids.owner}"}';
      ${insert('forged-jwt.example.test')}`)).toThrow('server managed')
    expect(() => pg.db(`SET ROLE service_role; SET request.jwt.claim.role='authenticated';
      ${insert('browser-claim.example.test')}`)).toThrow('server managed')
    expect(() => pg.db(insert('no-role.example.test'))).toThrow('server managed')
  })

  it('blocks browser relabeling, reassociation and copying automatic provenance to a new domain/site', () => {
    harness()
    const before = row('generated.example.test')
    const changes = ["source='user'", "source='unknown'", 'requirement_id=NULL',
      `requirement_id='${secondRequirement}'`, "domain='copied.example.test'", `site_id='${ids.otherSite}'`]
    for (const change of changes) {
      expect(() => pg.call(`UPDATE public.allowed_domains SET ${change} WHERE domain='generated.example.test'`))
        .toThrow('server managed')
      expect(row('generated.example.test')).toEqual(before)
    }
    expect(() => pg.call("UPDATE public.allowed_domains SET source='harness' WHERE domain='manual.example.test'"))
      .toThrow('server managed')
    expect(() => pg.call(`UPDATE public.allowed_domains SET requirement_id='${requirement}' WHERE domain='manual.example.test'`))
      .toThrow('server managed')
    // Ordinary updates which preserve automatic identity/provenance still work.
    pg.call("UPDATE public.allowed_domains SET created_at='2026-10-03' WHERE domain='generated.example.test'")
    expect(row('generated.example.test').source).toBe('harness')
  })

  it('retains same-site integrity after domain edits and parent requirement moves', () => {
    harness()
    expect(() => pg.call(`UPDATE public.allowed_domains SET site_id='${ids.otherSite}'
      WHERE domain='generated.example.test'`, ids.owner, 'service_role')).toThrow('allowed_domains_requirement_site_fkey')
    expect(() => pg.db(`UPDATE public.requirements SET site_id='${ids.otherSite}' WHERE id='${requirement}'`))
      .toThrow('allowed_domains_requirement_site_fkey')
    pg.call(`UPDATE public.allowed_domains SET requirement_id='${secondRequirement}'
      WHERE domain='generated.example.test'`, ids.owner, 'service_role')
    expect(row('generated.example.test').requirement_id).toBe(secondRequirement)
  })

  it.each(['authenticated', 'service_role'])('preserves domains and labels when a requirement is deleted by %s', role => {
    harness()
    const before = row('generated.example.test')
    pg.call(`DELETE FROM public.requirements WHERE id='${requirement}'`, ids.owner, role)
    expect(row('generated.example.test')).toEqual({ ...before, requirement_id: null })
    expect(() => pg.call("UPDATE public.allowed_domains SET source='user' WHERE domain='generated.example.test'"))
      .toThrow('server managed')
  })

  it.each(['user', 'unknown', 'harness'])('ON CONFLICT DO NOTHING keeps existing %s provenance and timestamps', source => {
    const reference = source === 'harness' ? secondRequirement : null
    pg.call(insert('existing.example.test', source, reference), ids.owner, 'service_role')
    const before = row('existing.example.test')
    for (let attempt = 0; attempt < 2; attempt++) {
      pg.call(`${insert('existing.example.test')} ON CONFLICT (site_id,domain) DO NOTHING`, ids.owner, 'service_role')
    }
    expect(row('existing.example.test')).toEqual(before)
  })

  it('preserves cross-site and anonymous access denial plus the existing archived-site guard', () => {
    expect(pg.call("SELECT count(*) FROM public.allowed_domains", ids.foreign)).toBe('0')
    expect(() => pg.call(insert('cross-site.example.test', 'user', null), ids.foreign)).toThrow('row-level security')
    expect(() => pg.call(insert('anonymous.example.test', 'user', null), ids.owner, 'anon')).toThrow('permission denied')
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(() => harness('archived.example.test')).toThrow('An active site is required')
  })

  it('removes direct trigger-function execution from browser roles', () => {
    expect(pg.db(`SELECT has_function_privilege('authenticated','public.guard_allowed_domain_provenance()','EXECUTE'),
      has_function_privilege('anon','public.guard_allowed_domain_provenance()','EXECUTE')`)).toBe('f|f')
  })

  it('preserves existing browser domain deletion under RLS without allowing automatic creation', () => {
    harness()
    expect(pg.call("DELETE FROM public.allowed_domains WHERE domain='generated.example.test' RETURNING domain",
      ids.foreign)).toBe('')
    expect(pg.call("DELETE FROM public.allowed_domains WHERE domain='generated.example.test' RETURNING domain"))
      .toBe('generated.example.test')
    expect(() => pg.call(insert('generated.example.test'))).toThrow('server managed')
    pg.call(insert('generated.example.test', 'user', null))
    expect(row('generated.example.test')).toMatchObject({ source: 'user', requirement_id: null })
  })

  it('rejects a registration racing with a committed requirement site move', async () => {
    const move = pg.concurrent(`SET application_name='provenance-parent-move'; BEGIN;
      UPDATE public.requirements SET site_id='${ids.otherSite}' WHERE id='${requirement}';
      SELECT pg_sleep(0.8); COMMIT;`)
    try {
      const deadline = Date.now() + 5000
      while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid()
        AND application_name = 'provenance-parent-move' AND wait_event = 'PgSleep'`) !== '1') {
        if (Date.now() > deadline) throw new Error('Parent move did not reach its transaction barrier')
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      await expect(pg.concurrent(actorSql(insert('racing.example.test'), ids.owner, 'service_role')))
        .rejects.toThrow('allowed_domains_requirement_site_fkey')
    } finally { await move }
    expect(pg.db("SELECT count(*) FROM public.allowed_domains WHERE domain='racing.example.test'")).toBe('0')
  }, 10000)

  it('ignores concurrent duplicate registrations without changing the first stored provenance', async () => {
    const writes = [requirement, secondRequirement].map(reference => pg.concurrent(actorSql(
      `${insert('concurrent.example.test', 'harness', reference)} ON CONFLICT (site_id,domain) DO NOTHING`,
      ids.owner, 'service_role',
    )))
    await Promise.all(writes)
    expect(pg.db("SELECT count(*) FROM public.allowed_domains WHERE domain='concurrent.example.test'")).toBe('1')
    expect([requirement, secondRequirement]).toContain(row('concurrent.example.test').requirement_id)
  })
})
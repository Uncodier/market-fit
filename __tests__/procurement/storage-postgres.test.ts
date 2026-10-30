/** @jest-environment node */
import { actorSql, actors, ids, installStorageFixture, isolatedPostgres, policy,
  postgresAvailable, saveSql, sqlJson, uuid } from './storage-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const latestSql = `SELECT row_to_json(v) FROM (
  SELECT revision,document,created_at,created_by FROM public.procurement_policy_versions
  WHERE site_id='${ids.site}' ORDER BY revision DESC LIMIT 1) v;`

describePg('immutable procurement policy storage: isolated PostgreSQL 17', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installStorageFixture(pg))
  const call = (sql: string, user = ids.owner, role = 'authenticated') =>
    pg.call(`\n\\set VERBOSITY verbose\n${sql}`, user, role)

  test('saves server-owned attribution, returns the exact RPC contract and preserves all revisions', () => {
    expect(call(latestSql)).toBe('')
    const first = JSON.parse(call(saveSql()))
    expect(Object.keys(first).sort()).toEqual(['created_at', 'created_by', 'document', 'revision'])
    expect(first).toMatchObject({ revision: 1, document: policy, created_by: ids.owner })
    expect(Number.isNaN(Date.parse(first.created_at))).toBe(false)
    const changed = { ...policy, settings: { nested: { name: 'Updated policy' } } }
    const second = JSON.parse(call(saveSql(1, changed), ids.admin))
    expect(second).toMatchObject({ revision: 2, document: changed, created_by: ids.admin })
    expect(Date.parse(second.created_at)).toBeGreaterThanOrEqual(Date.parse(first.created_at))
    expect(JSON.parse(call(latestSql))).toEqual(second)
    expect(JSON.parse(call(`SELECT jsonb_agg(to_jsonb(v) - 'site_id' ORDER BY revision)
      FROM public.procurement_policy_versions v;`))).toEqual([first, second])
    expect(JSON.parse(call(saveSql(0, policy, ids.otherSite), ids.foreign)).revision).toBe(1)
    expect(call('SELECT count(*) FROM public.procurement_policy_versions;')).toBe('2')
    expect(call('SELECT count(*) FROM public.procurement_policy_versions;', ids.foreign)).toBe('1')
  })

  test.each([ids.foreign, ids.inactive, actors.restricted, actors.unlicensed, actors.member, uuid(999)])(
    'denies private reads and RPC writes for unauthorized actor %s', user => {
      call(saveSql())
      expect(call(latestSql, user)).toBe('')
      expect(() => call(saveSql(1), user)).toThrow(/42501/)
      expect(pg.db('SELECT count(*) FROM public.procurement_policy_versions;')).toBe('1')
    }
  )

  test('denies archived sites, nonexistent sites and authenticated sessions without an actor', () => {
    call(saveSql())
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}';`)
    for (const user of [ids.owner, ids.admin]) {
      expect(call(latestSql, user)).toBe('')
      expect(() => call(saveSql(1), user)).toThrow(/42501/)
    }
    expect(() => call(saveSql(0, policy, uuid(777)))).toThrow(/42501/)
    expect(() => pg.db(`SET ROLE authenticated; SET request.jwt.claims='{}'; ${saveSql()}`))
      .toThrow(/access denied/)
  })

  test.each(['anon', 'service_role'])('does not grant table or RPC access to %s', role => {
    // Even a forged owner subject cannot overcome the database-role ACL.
    expect(() => call(saveSql(), ids.owner, role)).toThrow(/42501/)
    expect(() => call(latestSql, ids.owner, role)).toThrow(/42501/)
    expect(pg.db(`SELECT has_function_privilege('${role}',
      'public.save_procurement_policy(uuid,integer,jsonb)', 'EXECUTE');`)).toBe('f')
  })

  test('revokes default PUBLIC execution, explicitly grants only authenticated save and SELECT', () => {
    expect(pg.db(`SELECT count(*) FROM pg_proc p, aclexplode(p.proacl) a
      WHERE p.proname IN ('save_procurement_policy','reject_procurement_policy_history_mutation')
        AND a.grantee=0;`)).toBe('0')
    expect(pg.db(`SELECT has_function_privilege('authenticated',
      'public.reject_procurement_policy_history_mutation()', 'EXECUTE');`)).toBe('f')
    expect(pg.db(`SELECT has_table_privilege('authenticated', 'public.procurement_policy_versions', 'SELECT');`)).toBe('t')
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      expect(pg.db(`SELECT has_table_privilege('authenticated',
        'public.procurement_policy_versions', '${privilege}');`)).toBe('f')
    }
    expect(pg.db(`SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']
      FROM pg_proc WHERE oid='public.save_procurement_policy(uuid,integer,jsonb)'::regprocedure;`)).toBe('t')
  })

  test('blocks direct writes, forged audit fields and changes even by the table owner', () => {
    const first = call(saveSql())
    const insert = `INSERT INTO public.procurement_policy_versions
      VALUES ('${ids.site}',2,${sqlJson(policy)},'2000-01-01','${ids.foreign}');`
    expect(() => call(insert)).toThrow(/42501/)
    for (const statement of [
      `UPDATE public.procurement_policy_versions SET created_by='${ids.foreign}'`,
      "UPDATE public.procurement_policy_versions SET created_at='2000-01-01'",
      `UPDATE public.procurement_policy_versions SET document='{}',revision=999,site_id='${ids.otherSite}'`,
      'DELETE FROM public.procurement_policy_versions',
      'TRUNCATE public.procurement_policy_versions',
    ]) {
      expect(() => call(statement)).toThrow(/42501/)
      expect(() => pg.db(`SET ROLE postgres; ${statement}`)).toThrow(/history is immutable/)
    }
    expect(call(latestSql)).toBe(first)
    expect(() => call(saveSql(1, { ...policy, created_by: ids.foreign }))).toThrow(/23514/)
    pg.db('DELETE FROM public.fixture_members;')
    expect(() => pg.db(`DELETE FROM public.sites WHERE id='${ids.site}';`))
      .toThrow(/procurement_policy_versions_site_id_fkey/)
  })

  test.each([null, [], 'text', {}, { version: 2, settings: {}, rules: [] },
    { version: '1', settings: {}, rules: [] }, { version: 1, rules: [] },
    { version: 1, settings: null, rules: [] }, { version: 1, settings: [], rules: [] },
    { version: 1, settings: {} }, { version: 1, settings: {}, rules: {} }])(
    'enforces the versioned document envelope: %j', document => {
      expect(() => call(saveSql(0, document))).toThrow(/23514/)
      expect(pg.db('SELECT count(*) FROM public.procurement_policy_versions;')).toBe('0')
    }
  )

  test('rejects SQL NULL and invalid expected revisions without leaving partial history', () => {
    for (const revision of ['NULL', '-1']) {
      expect(() => call(`SELECT * FROM public.save_procurement_policy('${ids.site}',${revision},${sqlJson(policy)});`))
        .toThrow(/22023/)
    }
    expect(() => call(`SELECT * FROM public.save_procurement_policy('${ids.site}',0,NULL);`)).toThrow(/23502/)
    expect(JSON.parse(call(saveSql())).revision).toBe(1)
  })

  test('enforces the exact 256 KiB canonical UTF-8 byte limit, including multibyte text', () => {
    const document = (padding: string) => `jsonb_build_object('version',1,'settings',
      jsonb_build_object('padding',${padding}),'rules','[]'::jsonb)`
    const overhead = Number(pg.db(`SELECT octet_length(convert_to((${document("''")})::text,'UTF8'));`))
    const save = (padding: string, revision = 0) => `SELECT revision FROM public.save_procurement_policy(
      '${ids.site}',${revision},${document(padding)});`
    expect(call(save(`repeat('a',${262144 - overhead})`))).toBe('1')
    expect(() => call(save(`repeat('a',${262145 - overhead})`, 1))).toThrow(/23514/)
    expect(() => call(save("repeat('é',140000)", 1))).toThrow(/23514/)
    expect(pg.db('SELECT count(*) FROM public.procurement_policy_versions;')).toBe('1')
  })

  test('compares expected revision atomically and reports SQLSTATE 40001 for stale or future writes', () => {
    expect(() => call(saveSql(1))).toThrow(/40001/)
    call(saveSql())
    expect(() => call(saveSql())).toThrow(/40001/)
    expect(() => call(saveSql(9))).toThrow(/40001/)
    expect(JSON.parse(call(saveSql(1))).revision).toBe(2)
  })

  test.each([0, 1])('serializes concurrent saves starting at revision %s, including the first save', async expected => {
    if (expected) call(saveSql())
    const results = await Promise.allSettled([ids.owner, ids.admin].map(user => pg.concurrent(
      `\\set VERBOSITY verbose\n${actorSql(`BEGIN; ${saveSql(expected)} SELECT pg_sleep(0.2); COMMIT;`, user)}`
    )))
    const success = results.filter(result => result.status === 'fulfilled')
    const failure = results.filter(result => result.status === 'rejected')
    expect(success).toHaveLength(1)
    expect(failure).toHaveLength(1)
    expect((failure[0] as PromiseRejectedResult).reason.message).toMatch(/40001/)
    expect(pg.db('SELECT count(*) FROM public.procurement_policy_versions;')).toBe(String(expected + 1))
    expect(JSON.parse(call(latestSql)).revision).toBe(expected + 1)
  })

  test('rolls back an uncommitted save and ignores caller temporary objects/search paths', () => {
    call(`BEGIN; ${saveSql()} ROLLBACK;`)
    expect(call(latestSql)).toBe('')
    const saved = call(`CREATE TEMP TABLE procurement_policy_versions (revision integer);
      INSERT INTO procurement_policy_versions VALUES (999);
      SET search_path=pg_temp,public; ${saveSql()}`)
    expect(JSON.parse(saved)).toMatchObject({ revision: 1, created_by: ids.owner })
  })
})
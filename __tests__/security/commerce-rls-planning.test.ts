/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable, uuid } from './isolated-postgres'
import { checkedRestrictions, i, installReviewFixture } from './location-review-fixture'

const correction = migration('20261021233000_bound_commerce_rls_planning.sql')
const describePg = postgresAvailable ? describe : describe.skip
const tables = ['deals', 'subscriptions', 'quotations', 'sales', 'sale_orders', 'shipments', 'sale_order_items']

describePg('commerce RLS planning boundaries in isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.db('DROP SCHEMA IF EXISTS commerce_rls_private CASCADE')
    installReviewFixture(pg)
  })
  const install = () => pg.db(correction)
  const read = (actor: string) => tables.map(table => pg.call(
    `SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') FROM public.${table}`, actor,
  ))
  const policyShape = () => pg.db(`SELECT jsonb_agg(jsonb_build_object(
    'table',polrelid::regclass::text,'name',polname,'roles',polroles,
    'command',polcmd,'permissive',polpermissive) ORDER BY polrelid,polname)
    FROM pg_policy WHERE polrelid IN (${tables.map(table => `'public.${table}'::regclass`).join(',')})`)

  test('preserves visibility for managers, restricted members and foreign actors', () => {
    pg.call(checkedRestrictions([i.secondLocation]))
    const actors = [i.owner, i.admin, i.member, i.viewer, i.foreign, i.rejectedUser]
    const before = actors.map(read)
    const shape = policyShape()
    install()
    expect(actors.map(read)).toEqual(before)
    expect(policyShape()).toBe(shape)
    expect(pg.call(`SELECT count(*) FROM sale_orders WHERE id='${i.denied}'`, i.member)).toBe('0')
    expect(pg.call(`SELECT count(*) FROM sale_orders WHERE id='${i.other}'`, i.member)).toBe('0')
    expect(pg.call('SELECT count(*) FROM sale_orders', i.owner, 'service_role')).toBe('4')
    expect(pg.call('SELECT count(*) FROM sale_orders', uuid(999), 'anon')).toBe('0')
  })

  test.each([false, true])('keeps caller-visible parent policies and write checks (optimized=%s)', optimized => {
    pg.call(checkedRestrictions([i.secondLocation]))
    pg.db(`CREATE POLICY test_hide_parent ON public.sale_orders AS RESTRICTIVE
      FOR SELECT TO authenticated USING(id <> '${i.allowed}')`)
    if (optimized) install()
    expect(pg.call(`SELECT count(*) FROM sale_order_items WHERE id='${i.child}'`, i.member)).toBe('0')
    expect(() => pg.call(`INSERT INTO sale_order_items(site_id,sale_order_id)
      VALUES('${i.site}','${i.allowed}')`, i.member)).toThrow(/row-level security|Operational parent unavailable/)
    expect(() => pg.call(`INSERT INTO deals(site_id,location_id)
      VALUES('${i.site}','${i.secondLocation}')`, i.member)).toThrow(/row-level security/)
    expect(pg.call(`INSERT INTO deals(site_id,location_id,payload)
      VALUES('${i.site}','${i.location}','Allowed') RETURNING payload`, i.member)).toBe('Allowed')
    expect(() => pg.call(`INSERT INTO deals(site_id,location_id)
      VALUES('${i.site}','${i.foreignLocation}')`, i.member)).toThrow(/foreign key|row-level security/)
    expect(pg.call(`UPDATE deals SET payload='Changed' WHERE id='${i.allowed}' RETURNING payload`, i.member)).toBe('Changed')
    expect(pg.call(`UPDATE deals SET payload='Denied' WHERE id='${i.denied}' RETURNING id`, i.member)).toBe('')
    expect(pg.call(`DELETE FROM deals WHERE id='${i.allowed}' RETURNING id`, i.viewer)).toBe('')
  })

  test('revocation and archiving take effect after a previously successful read', () => {
    install()
    expect(pg.call('SELECT count(*) FROM sale_orders', i.member)).toBe('3')
    pg.db(`UPDATE site_members SET manually_disabled=true WHERE id='${i.memberRow}'`)
    expect(pg.call('SELECT count(*) FROM sale_orders', i.member)).toBe('0')
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${i.site}'`)
    expect(pg.call('SELECT count(*) FROM sale_orders', i.owner)).toBe('0')
  })

  test('preserves inherited scope and same-statement parent visibility', () => {
    pg.call(checkedRestrictions([i.secondLocation]))
    const capture = (sql: string) => {
      try { return { result: pg.call(`BEGIN; ${sql}; ROLLBACK;`, i.member) }; }
      catch (error) {
        const stderr = String((error as { stderr?: Buffer }).stderr || error)
        return { error: stderr.match(/ERROR:\s+([^\n]+)/)?.[1] || stderr }
      }
    }
    const inherited = `INSERT INTO quotations(site_id,deal_id)
      VALUES('${i.site}','${i.allowed}') RETURNING location_id`
    const sameStatement = `WITH parent AS (
      INSERT INTO deals(site_id,location_id) VALUES('${i.site}','${i.location}') RETURNING id
    ) INSERT INTO quotations(site_id,deal_id) SELECT '${i.site}',id FROM parent RETURNING location_id`
    const before = [capture(inherited), capture(sameStatement)]
    expect(before[0]).toEqual({ result: i.location })
    install()
    expect([capture(inherited), capture(sameStatement)]).toEqual(before)
  })

  test('private boolean helpers cannot bypass data permissions with a forged restriction argument', () => {
    pg.call(checkedRestrictions([i.secondLocation]))
    install()
    const args = pg.db(`SELECT string_agg(CASE WHEN a.attname='site_id' THEN '''${i.site}''::uuid'
        WHEN a.attname='location_id' THEN '''${i.secondLocation}''::uuid' ELSE 'NULL::uuid' END,
        ',' ORDER BY a.attnum)
      FROM pg_attribute a JOIN (SELECT DISTINCT refobjid,refobjsubid,objid FROM pg_depend
        WHERE classid='pg_policy'::regclass AND refclassid='pg_class'::regclass) d
        ON d.refobjid=a.attrelid AND d.refobjsubid=a.attnum
      JOIN commerce_rls_private.policy_originals b ON b.policy_oid=d.objid
      WHERE b.table_name='deals' AND d.refobjid=b.relation_oid AND a.attnum>0`)
    // Direct helper execution exposes only an invoker boolean. The actual policy
    // always supplies its own statement-level predicate, not this caller input.
    expect(pg.call(`SELECT commerce_rls_private.deals_location_check(false,${args})`, i.member)).toBe('t')
    expect(pg.call(`SELECT count(*) FROM deals WHERE id='${i.denied}'`, i.member)).toBe('0')
    expect(() => pg.call('SELECT * FROM commerce_rls_private.policy_originals', i.member)).toThrow(/permission denied/)
    expect(() => pg.call(`SELECT commerce_rls_private.deals_location_check(false,${args})`, uuid(999), 'anon'))
      .toThrow(/permission denied/)
    expect(pg.db(`SELECT bool_and(NOT p.prosecdef AND p.provolatile='s' AND NOT p.proisstrict
      AND p.proconfig=ARRAY['search_path=pg_catalog']) FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='commerce_rls_private'`)).toBe('t')
  })

  test('replay preserves the originals and rejects modified function or policy definitions', () => {
    install()
    const originals = pg.db('SELECT jsonb_agg(to_jsonb(b) ORDER BY table_name) FROM commerce_rls_private.policy_originals b')
    install()
    expect(pg.db('SELECT jsonb_agg(to_jsonb(b) ORDER BY table_name) FROM commerce_rls_private.policy_originals b')).toBe(originals)
    pg.db(`ALTER POLICY location_acl_enforcement ON deals USING(true)`)
    expect(() => install()).toThrow(/changed after optimization/)
  })

  test('rejects unsupported policy drift atomically rather than dropping authorization', () => {
    pg.db(`ALTER POLICY location_acl_enforcement ON deals WITH CHECK(false)`)
    expect(() => install()).toThrow(/Asymmetric/)
    expect(pg.db(`SELECT to_regnamespace('commerce_rls_private') IS NULL`)).toBe('t')
  })

  test('rejects renamed or replaced parent functions rather than silently rebinding textual bodies', () => {
    install()
    const before = policyShape()
    expect(() => pg.db(`BEGIN;
      ALTER FUNCTION public.user_can_access_location(uuid,uuid) RENAME TO original_location_check;
      CREATE FUNCTION public.user_can_access_location(uuid,uuid) RETURNS boolean
        LANGUAGE sql STABLE AS $$ SELECT true $$;
      ${correction}`)).toThrow(/dependency changed after optimization/)
    expect(policyShape()).toBe(before)
    expect(pg.call(`SELECT count(*) FROM sale_orders WHERE id='${i.other}'`, i.member)).toBe('0')
  })

  test('rejects pre-existing backup column grants instead of assuming table REVOKE clears them', () => {
    install()
    expect(() => pg.db(`BEGIN;
      GRANT SELECT(original_using) ON commerce_rls_private.policy_originals TO authenticated;
      ${correction}`)).toThrow(/Untrusted commerce policy backup access/)
    expect(() => pg.call('SELECT original_using FROM commerce_rls_private.policy_originals', i.member))
      .toThrow(/permission denied/)
  })

  test('reduces outer planning memory without replacing the parent RLS graph', () => {
    const query = `EXPLAIN (FORMAT JSON, MEMORY, SUMMARY) SELECT o.id,x.items FROM sale_orders o
      LEFT JOIN LATERAL(SELECT jsonb_agg(item.id) items FROM sale_order_items item
        WHERE item.sale_order_id=o.id AND item.site_id=o.site_id) x ON true
      WHERE o.site_id='${i.site}' LIMIT 100`
    const before = JSON.parse(pg.call(query, i.member))[0]
    install()
    const after = JSON.parse(pg.call(query, i.member))[0]
    expect(after.Planning['Memory Allocated']).toBeLessThan(before.Planning['Memory Allocated'])
    expect(after.Planning['Memory Allocated']).toBeLessThan(10 * 1024)
    expect(pg.call('SELECT count(*) FROM sale_order_items', i.member)).toBe('2')
  })
})
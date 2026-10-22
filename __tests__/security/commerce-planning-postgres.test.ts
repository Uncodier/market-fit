/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable } from './isolated-postgres'
import { commerceTables, installCommerceFixture, outcome, permissionSnapshot,
  planningMigration, policySnapshot, populateCommerceGraph } from './commerce-planning-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('bounded commerce location ACL: offline PostgreSQL 17', () => {
  const pg = isolatedPostgres()
  let fixture: ReturnType<typeof installCommerceFixture>
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => { fixture = installCommerceFixture(pg) })
  const apply = () => pg.db(planningMigration())

  test('preserves SELECT/INSERT/UPDATE/DELETE outcomes for all identity and license boundaries', () => {
    const { ids, extra } = fixture
    const actors = [ids.owner, ids.admin, ids.coOwner, ids.member, ids.viewer, ids.foreign,
      ids.rejectedUser, extra.inactive, extra.disabled, extra.suspended]
    const capture = () => {
      const results: Record<string, unknown> = {}
      for (const user of actors) results[user] = permissionSnapshot(pg, ids, user)
      for (const role of ['anon', 'service_role']) results[role] = permissionSnapshot(pg, ids, ids.owner, role)
      pg.db(`UPDATE billing SET plan='free' WHERE site_id='${ids.site}'`)
      results.invalidLicense = permissionSnapshot(pg, ids, extra.invalid)
      pg.db(`UPDATE billing SET plan='enterprise' WHERE site_id='${ids.site}'`)
      pg.db(`DELETE FROM site_member_location_restrictions WHERE site_member_id='${ids.memberRow}'`)
      results.unrestrictedMember = permissionSnapshot(pg, ids, ids.member)
      pg.db(`INSERT INTO site_member_location_restrictions(site_id,site_member_id,location_id)
        VALUES('${ids.site}','${ids.memberRow}','${ids.secondLocation}')`)
      return results
    }
    const before = capture()
    apply()
    expect(capture()).toEqual(before)
    const rows = (user: string, label: string) => (before[user] as Array<{ label: string; rows: string }>)
      .find(row => row.label === label)?.rows
    expect(rows(ids.member, 'deals:select')).toBe(ids.allowed)
    expect(rows(ids.member, 'sale_order_items:select')).toBe(ids.child)
    expect(rows(extra.disabled, 'deals:select')).toBe('')
    expect(rows(extra.inactive, 'deals:select')).toBe('')
    expect(rows(ids.owner, 'deals:select')).toContain(ids.unresolved)
    expect(rows(ids.member, 'deals:delete')).toBe('0')
  })

  test('copies exact expressions/dependencies while preserving every other policy and invoker privilege', () => {
    const before = JSON.parse(pg.db(policySnapshot)) as Array<Record<string, unknown>>
    const dependencies = JSON.parse(pg.db(`SELECT jsonb_object_agg(c.relname,cols) FROM (
      SELECT p.polrelid,array_agg(DISTINCT a.attname ORDER BY a.attname) cols
      FROM pg_policy p JOIN pg_depend d ON d.classid='pg_policy'::regclass AND d.objid=p.oid
      JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
      WHERE p.polname='location_acl_enforcement' AND d.refobjid=p.polrelid AND d.refobjsubid>0
      GROUP BY p.polrelid) d JOIN pg_class c ON c.oid=d.polrelid`))
    apply()
    const after = JSON.parse(pg.db(policySnapshot)) as Array<Record<string, unknown>>
    expect(after.filter(p => p.name !== 'location_acl_enforcement')).toEqual(
      before.filter(p => p.name !== 'location_acl_enforcement'))
    const saved = JSON.parse(pg.db(`SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name)
      FROM commerce_rls_private.policy_originals o`))
    expect(saved).toHaveLength(7)
    for (const table of commerceTables) {
      const original = before.find(p => p.table === table && p.name === 'location_acl_enforcement')!
      const bounded = after.find(p => p.table === table && p.name === 'location_acl_enforcement')!
      const backup = saved.find((p: { table_name: string }) => p.table_name === table)
      expect(backup.original_using).toBe(original.using)
      expect(backup.original_check).toBe(original.check)
      expect(backup.original_roles).toEqual(original.roles)
      expect(backup.original_command).toBe(original.command)
      expect(backup.original_permissive).toBe(original.permissive)
      expect(bounded.oid).toBe(original.oid)
      expect(bounded.roles).toEqual(original.roles)
      expect(bounded.permissive).toBe(false)
      expect(String(bounded.using).match(/current_user_has_location_restrictions\(\)/g)).toHaveLength(1)
      expect(bounded.using).toBe(bounded.check)
      const functionInfo = JSON.parse(pg.db(`SELECT jsonb_build_object('definer',prosecdef,'strict',proisstrict,
        'leakproof',proleakproof,'volatility',provolatile,'config',proconfig,'body',prosrc,
        'arguments',proargnames) FROM pg_proc WHERE oid=${backup.function_oid}`))
      expect(functionInfo).toMatchObject({ definer: false, strict: false, leakproof: false,
        volatility: 's', config: ['search_path=pg_catalog'] })
      expect(functionInfo.arguments).toHaveLength(dependencies[table].length + 1)
      expect(functionInfo.body).not.toMatch(/set_config|current_setting|INSERT|UPDATE|DELETE|row_security\s*=/i)
      expect(pg.db(`SELECT has_function_privilege('authenticated',${backup.function_oid},'EXECUTE')
        AND NOT has_function_privilege('anon',${backup.function_oid},'EXECUTE')
        AND NOT has_function_privilege('service_role',${backup.function_oid},'EXECUTE')`)).toBe('t')
    }
    for (const role of ['authenticated', 'anon', 'service_role']) {
      expect(() => pg.call('SELECT * FROM commerce_rls_private.policy_originals', fixture.ids.owner, role))
        .toThrow(/permission denied/)
    }
  })

  test('nullable gates retain SQL three-valued semantics, not STRICT or actor GUC caching', () => {
    apply()
    const { ids } = fixture
    expect(pg.call(`SELECT commerce_rls_private.deals_location_check(false,NULL,NULL)`, ids.member)).toBe('t')
    expect(pg.call(`SELECT commerce_rls_private.deals_location_check(NULL,'${ids.site}','${ids.location}')`, ids.member)).toBe('t')
    expect(pg.call(`SELECT commerce_rls_private.deals_location_check(NULL,'${ids.site}','${ids.secondLocation}') IS NULL`, ids.member)).toBe('t')
    expect(pg.call(`SELECT commerce_rls_private.deals_location_check(true,'${ids.site}',NULL)`, ids.member)).toBe('f')
    // Same session and prepared statement must observe a changed authenticated actor.
    expect(pg.db(`${actorSql('', ids.member)} PREPARE caller_rows AS SELECT count(*) FROM deals;
      EXECUTE caller_rows; SET request.jwt.claims='${JSON.stringify({ sub: ids.admin, role: 'authenticated' })}';
      EXECUTE caller_rows;`)).toBe('1\n3')
  })

  test('replay is exact and policy/function/config/grant drift aborts atomically', () => {
    apply()
    const before = pg.db(policySnapshot)
    const backups = pg.db('SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name) FROM commerce_rls_private.policy_originals o')
    apply()
    expect(pg.db(policySnapshot)).toBe(before)
    expect(pg.db('SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name) FROM commerce_rls_private.policy_originals o')).toBe(backups)
    const cases = [
      'ALTER POLICY location_acl_enforcement ON shipments WITH CHECK (false)',
      "ALTER FUNCTION commerce_rls_private.shipments_location_check(boolean,uuid,uuid,uuid,uuid) SET search_path=public",
      'ALTER FUNCTION commerce_rls_private.shipments_location_check(boolean,uuid,uuid,uuid,uuid) SECURITY DEFINER',
      'GRANT EXECUTE ON FUNCTION commerce_rls_private.shipments_location_check(boolean,uuid,uuid,uuid,uuid) TO anon',
    ]
    for (const sql of cases) {
      expect(() => pg.db(`BEGIN; ${sql}; ${planningMigration()}`)).toThrow(/changed after optimization/)
      expect(pg.db(policySnapshot)).toBe(before)
      expect(pg.db('SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name) FROM commerce_rls_private.policy_originals o')).toBe(backups)
    }
  })

  test.each([
    ['missing policy', 'DROP POLICY location_acl_enforcement ON shipments', /Unexpected restrictive/],
    ['asymmetric check', 'ALTER POLICY location_acl_enforcement ON shipments WITH CHECK(false)', /Asymmetric/],
    ['changed roles', 'ALTER POLICY location_acl_enforcement ON shipments TO anon', /Unexpected restrictive/],
    ['nonallowlisted column', 'ALTER POLICY location_acl_enforcement ON shipments USING(payload IS NULL) WITH CHECK(payload IS NULL)', /Unreviewed/],
    ['permissive policy', 'DROP POLICY location_acl_enforcement ON shipments; CREATE POLICY location_acl_enforcement ON shipments TO authenticated USING(true) WITH CHECK(true)', /Unexpected restrictive/],
  ])('refuses %s on a late target without leaving earlier replacements', (_name, sql, error) => {
    pg.db(sql)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(error)
    expect(pg.db(policySnapshot)).toBe(before)
    expect(pg.db("SELECT to_regnamespace('commerce_rls_private') IS NULL")).toBe('t')
  })

  test('refuses non-bypass owner views, including indirect dependents; allows invoker views', () => {
    pg.db(`CREATE ROLE commerce_view_owner; GRANT authenticated TO commerce_view_owner;
      CREATE VIEW commerce_inner WITH(security_invoker=true) AS SELECT * FROM sale_orders;
      CREATE VIEW commerce_outer AS SELECT * FROM commerce_inner;
      ALTER VIEW commerce_outer OWNER TO commerce_view_owner;
      GRANT SELECT ON sale_orders,commerce_inner,commerce_outer TO commerce_view_owner;
      GRANT SELECT ON commerce_inner,commerce_outer TO authenticated;`)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(/owner-context commerce view/)
    expect(pg.db(policySnapshot)).toBe(before)
    pg.db('ALTER VIEW commerce_outer SET (security_invoker=true)')
    apply()
    expect(outcome(pg, 'SELECT count(*) FROM commerce_outer', fixture.ids.member)).toEqual({ rows: '1', state: 'ok' })
  })

  test('column-level reads preserve explicit-column grants and parent privileges', () => {
    const { ids } = fixture
    pg.db(`REVOKE SELECT ON deals FROM authenticated;
      GRANT SELECT(id,site_id,location_id,payload) ON deals TO authenticated;
      REVOKE SELECT ON sale_orders FROM authenticated;
      GRANT SELECT(id,site_id,location_id,quotation_id,sale_id) ON sale_orders TO authenticated;
      REVOKE SELECT ON sale_order_items FROM authenticated;
      GRANT SELECT(id,site_id) ON sale_order_items TO authenticated;`)
    const select = () => ({ orders: outcome(pg, 'SELECT id FROM sale_orders ORDER BY id', ids.member),
      items: outcome(pg, 'SELECT id FROM sale_order_items ORDER BY id', ids.member) })
    const before = select()
    expect(before.orders.state).toBe('ok')
    expect(before.items.state).toBe('ok')
    apply()
    expect(select()).toEqual(before)
    expect(() => pg.call('SELECT payload FROM sale_orders', ids.member)).toThrow(/permission denied/)
    expect(() => pg.call('SELECT payload FROM sale_order_items', ids.member)).toThrow(/permission denied/)
  })

  test('refuses an altered global gate topology and non-UUID dependencies', () => {
    const original = pg.db(`SELECT pg_get_expr(polqual,polrelid) FROM pg_policy
      WHERE polrelid='shipments'::regclass AND polname='location_acl_enforcement'`)
    pg.db(`ALTER POLICY location_acl_enforcement ON shipments
      USING((${original}) AND site_id IS NOT NULL) WITH CHECK((${original}) AND site_id IS NOT NULL)`)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(/Unreviewed commerce ACL/)
    expect(pg.db(policySnapshot)).toBe(before)
    pg.db(`ALTER POLICY location_acl_enforcement ON shipments USING(${original}) WITH CHECK(${original});
      ALTER TABLE subscriptions ADD COLUMN payload_scope text;
      ALTER POLICY location_acl_enforcement ON subscriptions
      USING((NOT (SELECT public.current_user_has_location_restrictions())) OR
        (public.current_user_site_role(site_id)='owner' OR payload_scope IS NULL))
      WITH CHECK((NOT (SELECT public.current_user_has_location_restrictions())) OR
        (public.current_user_site_role(site_id)='owner' OR payload_scope IS NULL));`)
    expect(apply).toThrow(/Unreviewed commerce ACL/)
    expect(pg.db("SELECT to_regnamespace('commerce_rls_private') IS NULL")).toBe('t')
  })

  test.each(['schema', 'table'])('refuses an untrusted private %s owner', kind => {
    pg.db('CREATE SCHEMA commerce_rls_private')
    if (kind === 'schema') pg.db('ALTER SCHEMA commerce_rls_private OWNER TO authenticated')
    else pg.db(`CREATE TABLE commerce_rls_private.policy_originals(table_name text);
      ALTER TABLE commerce_rls_private.policy_originals OWNER TO authenticated;`)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(kind === 'schema' ? /Untrusted owner/ : /Untrusted commerce policy backup/)
    expect(pg.db(policySnapshot)).toBe(before)
    expect(pg.db(`SELECT count(*) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace
      WHERE n.nspname='commerce_rls_private'`)).toBe('0')
  })

  test.each(['unlisted', 'volatile'])('refuses an %s predicate function', kind => {
    if (kind === 'volatile') pg.db('ALTER FUNCTION public.current_user_site_role(uuid) VOLATILE')
    else pg.db(`CREATE FUNCTION public.synthetic_predicate(uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT true $$;
      ALTER POLICY location_acl_enforcement ON deals
      USING(NOT(SELECT public.current_user_has_location_restrictions()) OR
        (public.current_user_site_role(site_id)='owner' OR public.synthetic_predicate(site_id)))
      WITH CHECK(NOT(SELECT public.current_user_has_location_restrictions()) OR
        (public.current_user_site_role(site_id)='owner' OR public.synthetic_predicate(site_id)));`)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(/Unreviewed commerce ACL function/)
    expect(pg.db(policySnapshot)).toBe(before)
    expect(pg.db("SELECT to_regnamespace('commerce_rls_private') IS NULL")).toBe('t')
  })

  test.each([
    'REVOKE SELECT ON deals FROM authenticated',
    'REVOKE EXECUTE ON FUNCTION current_user_site_role(uuid) FROM PUBLIC,authenticated',
  ])('refuses missing original parent/function privilege: %s', sql => {
    pg.db(sql)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(/Missing authenticated parent privileges/)
    expect(pg.db(policySnapshot)).toBe(before)
    expect(pg.db("SELECT to_regnamespace('commerce_rls_private') IS NULL")).toBe('t')
  })

  test('does not permit temporary parent/function substitution', () => {
    apply()
    const { ids } = fixture
    expect(pg.db(`${actorSql('', ids.member)} CREATE TEMP TABLE deals(id uuid,site_id uuid,location_id uuid);
      INSERT INTO deals VALUES('${ids.denied}','${ids.site}','${ids.location}');
      SET search_path=pg_temp,public;
      SELECT count(*) FROM public.quotations WHERE id='${ids.denied}';`)).toBe('0')
  })

  test('bounds native planning allocation on empty and deep populated parent graphs', () => {
    const { ids } = fixture
    populateCommerceGraph(pg, ids)
    const query = `SELECT o.id,i.id,s.id FROM sale_orders o
      LEFT JOIN sale_order_items i ON i.sale_order_id=o.id LEFT JOIN sales s ON s.id=o.sale_id
      WHERE o.site_id='${ids.site}' ORDER BY o.created_at DESC LIMIT 100`
    const explain = (user: string, analyze = false) => JSON.parse(pg.call(
      `EXPLAIN (${analyze ? 'ANALYZE, ' : ''}SUMMARY, MEMORY, FORMAT JSON) ${query}`, user))[0]
    const before = explain(ids.member)
    const ownerBefore = explain(ids.admin)
    const restrictedRuntimeBefore = explain(ids.member, true)
    const unrestrictedRuntimeBefore = explain(ids.admin, true)
    const resultBefore = pg.call(query, ids.member)
    apply()
    const after = explain(ids.member)
    const ownerAfter = explain(ids.admin)
    const restrictedRuntimeAfter = explain(ids.member, true)
    const unrestrictedRuntimeAfter = explain(ids.admin, true)
    expect(pg.call(query, ids.member)).toBe(resultBefore)
    for (const [oldPlan, newPlan] of [[before, after], [ownerBefore, ownerAfter]]) {
      const oldMemory = oldPlan.Planning['Memory Allocated']
      const newMemory = newPlan.Planning['Memory Allocated']
      expect(oldMemory).toBeGreaterThan(newMemory * 4)
      expect(newMemory).toBeLessThan(32 * 1024)
    }
    pg.db(`SET session_replication_role=replica;
      ${commerceTables.map(table => `DELETE FROM ${table}`).join(';')}; SET session_replication_role=origin;`)
    expect(pg.call(query, ids.member)).toBe('')
    const emptyAfter = explain(ids.member)
    expect(emptyAfter.Planning['Memory Allocated']).toBeLessThan(32 * 1024)
    pg.db(`DO $restore$ DECLARE p record; BEGIN
      FOR p IN SELECT * FROM commerce_rls_private.policy_originals LOOP
        EXECUTE format('ALTER POLICY location_acl_enforcement ON public.%I USING(%s) WITH CHECK(%s)',
          p.table_name,p.original_using,p.original_check);
      END LOOP; END $restore$; DROP SCHEMA commerce_rls_private CASCADE;`)
    const emptyBefore = explain(ids.member)
    expect(emptyBefore.Planning['Memory Allocated']).toBeGreaterThan(emptyAfter.Planning['Memory Allocated'] * 4)
    // Timing is intentionally measured, not asserted: invoker parent lookups trade
    // executor work for bounded planning. No fragile wall-clock promise is made.
    console.info('offline commerce planner KiB', {
      restricted: [before.Planning, after.Planning],
      unrestricted: [ownerBefore.Planning, ownerAfter.Planning],
      empty: [emptyBefore.Planning, emptyAfter.Planning],
      restrictedExecutionMs: [restrictedRuntimeBefore['Execution Time'], restrictedRuntimeAfter['Execution Time']],
      unrestrictedExecutionMs: [unrestrictedRuntimeBefore['Execution Time'], unrestrictedRuntimeAfter['Execution Time']],
    })
  })
})
/** @jest-environment node */
import { isolatedPostgres, postgresAvailable } from './isolated-postgres'
import { policySnapshot } from './commerce-planning-fixture'
import { installOperationalFixture, operationalMigration, operationalSnapshot,
  operationalTables, populateOperationalGraph } from './operational-planning-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('residual operational ACL: socket-only PostgreSQL 17', () => {
  const pg = isolatedPostgres()
  let fixture: ReturnType<typeof installOperationalFixture>
  const apply = () => pg.db(operationalMigration())
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => { fixture = installOperationalFixture(pg) })

  test('preserves rows and all DML across owner/admin/restricted/cross-site/hidden-parent/license boundaries', () => {
    const { ids, extra } = fixture
    const capture = () => {
      const result: Record<string, ReturnType<typeof operationalSnapshot>> = {}
      for (const user of [ids.owner, ids.admin, ids.coOwner, ids.member, ids.viewer, ids.foreign,
        ids.rejectedUser, extra.inactive, extra.disabled, extra.suspended]) {
        result[user] = operationalSnapshot(pg, fixture, user)
      }
      for (const role of ['anon', 'service_role']) result[role] = operationalSnapshot(pg, fixture, ids.owner, role)
      pg.db(`UPDATE billing SET plan='free' WHERE site_id='${ids.site}'`)
      result.invalidLicense = operationalSnapshot(pg, fixture, extra.invalid)
      pg.db(`UPDATE billing SET plan='enterprise' WHERE site_id='${ids.site}';
        DELETE FROM site_member_location_restrictions WHERE site_member_id='${ids.memberRow}'`)
      result.unrestricted = operationalSnapshot(pg, fixture, ids.member)
      pg.db(`INSERT INTO site_member_location_restrictions(site_id,site_member_id,location_id)
        VALUES('${ids.site}','${ids.memberRow}','${ids.secondLocation}')`)
      return result
    }
    const before = capture()
    apply()
    expect(capture()).toEqual(before)
    const probe = (user: string, label: string) => before[user].find(p => p.label === label)!
    expect(probe(ids.member, 'messages:select').rows).toBe(ids.child)
    expect(probe(ids.member, 'tasks:select').rows).toBe(ids.allowed)
    expect(probe(ids.member, 'reservations:select').rows).toBe(ids.allowed)
    expect(probe(ids.member, 'tasks:move-denied').state).toBe('23514')
    expect(probe(ids.member, 'messages:insert-denied').state).toBe('42501')
    expect(probe(ids.member, 'tasks:insert').rows).toBe('1')
    expect(probe(ids.member, 'tasks:delete').rows).toBe('0')
    expect(probe(extra.disabled, 'tasks:select').rows).toBe('')
    // The legacy fixture's permissive old_projection grants this unrestricted
    // inactive actor message visibility. Preserve it, do not claim a new denial.
    expect(probe(extra.inactive, 'messages:select').rows).toContain(ids.child)
    expect(probe(ids.member, 'messages:select').rows).not.toContain(extra.hiddenLink)
    expect(probe(ids.member, 'messages:select').rows).not.toContain(extra.crossSite)
    expect(probe(ids.member, 'tasks:select').rows).not.toContain(extra.hiddenLink)
    expect(probe(ids.member, 'tasks:select').rows).not.toContain(extra.crossSite)
    expect(probe(ids.owner, 'tasks:select').rows).toContain(ids.unresolved)
  })

  test('preserves policy OIDs/roles/expressions, isolated backups, caller privileges and replay integrity', () => {
    const before = JSON.parse(pg.db(policySnapshot)) as Array<Record<string, unknown>>
    const commerce = pg.db('SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name) FROM commerce_rls_private.policy_originals o')
    apply()
    const after = JSON.parse(pg.db(policySnapshot)) as Array<Record<string, unknown>>
    expect(after.filter(p => p.name !== 'location_acl_enforcement' || !operationalTables.includes(p.table as never)))
      .toEqual(before.filter(p => p.name !== 'location_acl_enforcement' || !operationalTables.includes(p.table as never)))
    const saved = JSON.parse(pg.db('SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name) FROM operational_rls_private.policy_originals o'))
    expect(saved).toHaveLength(11)
    for (const record of saved) {
      const old = before.find(p => p.table === record.table_name && p.name === 'location_acl_enforcement')!
      expect(record.original_using).toBe(old.using)
      expect(record.original_check).toBe(old.check)
      expect(record.original_roles).toEqual(old.roles)
      expect(record.policy_oid).toBe(old.oid)
      expect(record.dependencies.every((d: { identity: string }) => !!d.identity)).toBe(true)
    }
    expect(pg.db(`SELECT bool_and(NOT f.prosecdef AND NOT f.proisstrict AND NOT f.proleakproof
      AND f.provolatile='s' AND f.proconfig=ARRAY['search_path=pg_catalog']
      AND has_function_privilege('authenticated',f.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',f.oid,'EXECUTE')
      AND NOT has_function_privilege('service_role',f.oid,'EXECUTE'))
      FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname='operational_rls_private'`)).toBe('t')
    expect(pg.db(`SELECT has_any_column_privilege('authenticated','operational_rls_private.policy_originals','SELECT,INSERT,UPDATE,REFERENCES')`)).toBe('f')
    apply()
    expect(JSON.parse(pg.db(policySnapshot))).toEqual(after)
    expect(pg.db('SELECT jsonb_agg(to_jsonb(o) ORDER BY table_name) FROM commerce_rls_private.policy_originals o')).toBe(commerce)
  })

  test('non-strict nullable gate and row arguments preserve the exact original boolean result; false alone is not authorization', () => {
    apply()
    const { ids } = fixture
    for (const table of operationalTables) {
      const saved = JSON.parse(pg.db(`SELECT to_jsonb(o) FROM operational_rls_private.policy_originals o WHERE table_name='${table}'`))
      const columns: string[] = JSON.parse(pg.db(`SELECT json_agg(a.attname ORDER BY a.attnum)
        FROM pg_attribute a JOIN pg_proc f ON f.oid=${saved.function_oid}
        WHERE a.attrelid='public.${table}'::regclass AND a.attnum>0 AND NOT a.attisdropped
          AND a.attname IN (${saved.function_body.match(/AS [a-z_]+/g).map((name: string) => `'${name.slice(3)}'`).join(',')})`))
      const projection = columns.map(column => `NULL::uuid AS ${column}`).join(',')
      for (const gate of ['NULL::boolean', 'true', 'false']) {
        const original = saved.original_using.replace('public.current_user_has_location_restrictions()', gate)
        expect(pg.call(`SELECT (SELECT (${original}) FROM (SELECT ${projection}) AS ${table})
          IS NOT DISTINCT FROM operational_rls_private.${table}_location_check(${gate},${columns.map(() => 'NULL::uuid').join(',')})`, ids.member)).toBe('t')
      }
    }
    expect(pg.call(`SELECT operational_rls_private.messages_location_check(false,NULL::uuid)`, ids.member)).toBe('t')
    expect(pg.call(`SELECT count(*) FROM public.messages WHERE id='${fixture.extra.hiddenLink}'`, ids.member)).toBe('0')
  })

  test.each([
    [`ALTER POLICY location_acl_enforcement ON tasks USING(true) WITH CHECK(true)`, /Unreviewed operational ACL dependencies/],
    [`ALTER POLICY location_acl_enforcement ON tasks WITH CHECK(false)`, /Asymmetric operational ACL/],
    [`ALTER POLICY location_acl_enforcement ON messages TO anon`, /Unexpected restrictive operational ACL/],
    [`ALTER TABLE reservations ALTER COLUMN operating_location_id TYPE text USING operating_location_id::text`, /cannot alter type/],
    [`REVOKE SELECT ON conversations FROM authenticated`, /Missing authenticated parent privileges/],
    [`REVOKE EXECUTE ON FUNCTION public.current_user_site_role(uuid) FROM PUBLIC,authenticated`, /Missing authenticated parent privileges/],
  ])('refuses unsupported installation atomically: %s', (change, error) => {
    if (String(change).includes('ALTER COLUMN')) { expect(() => pg.db(change)).toThrow(error); return }
    pg.db(change)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(error)
    expect(pg.db(policySnapshot)).toBe(before)
    expect(pg.db("SELECT to_regnamespace('operational_rls_private') IS NULL")).toBe('t')
  })

  test.each([
    `NOT (SELECT public.current_user_has_location_restrictions()) OR public.user_can(tasks.site_id,'select')`,
    `NOT (SELECT public.current_user_has_location_restrictions()) OR public.user_can_access_location(tasks.site_id,tasks.location_id)`,
    `NOT (SELECT public.current_user_has_location_restrictions()) OR (public.current_user_site_role(tasks.site_id)='owner' AND tasks.payload IS NULL)`,
    `(SELECT public.current_user_has_location_restrictions()) IS FALSE OR public.current_user_site_role(tasks.site_id)='owner'`,
    `NOT (SELECT public.current_user_has_location_restrictions()) OR (public.current_user_site_role(tasks.site_id)='owner' AND public.current_user_has_location_restrictions())`,
  ])('rejects unexpected function/dependency/global-prefix shapes, not arbitrary policies: %s', expression => {
    pg.db(`ALTER POLICY location_acl_enforcement ON tasks USING(${expression}) WITH CHECK(${expression})`)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(/Unreviewed operational ACL function|Unreviewed operational ACL dependencies/)
    expect(pg.db(policySnapshot)).toBe(before)
  })

  test('rejects same-named helper overloads by exact catalog signature', () => {
    pg.db(`CREATE FUNCTION public.user_can_access_location(text,text) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT true $$;
      ALTER POLICY location_acl_enforcement ON tasks USING(
        NOT (SELECT public.current_user_has_location_restrictions()) OR
        (public.current_user_site_role(tasks.site_id)='owner' AND
          public.user_can_access_location(tasks.site_id::text,tasks.location_id::text))) WITH CHECK(
        NOT (SELECT public.current_user_has_location_restrictions()) OR
        (public.current_user_site_role(tasks.site_id)='owner' AND
          public.user_can_access_location(tasks.site_id::text,tasks.location_id::text)))`)
    expect(apply).toThrow(/Unreviewed operational ACL function/)
  })

  test.each([
    `ALTER TABLE public.conversations RENAME TO conversations_replaced`,
    `REVOKE SELECT ON conversations FROM authenticated`,
    `ALTER FUNCTION operational_rls_private.messages_location_check(boolean,uuid) SECURITY DEFINER`,
    `GRANT EXECUTE ON FUNCTION operational_rls_private.messages_location_check(boolean,uuid) TO anon`,
    `GRANT SELECT(original_using) ON operational_rls_private.policy_originals TO authenticated`,
  ])('refuses replay after dependency/helper/private-ACL drift: %s', change => {
    apply()
    pg.db(change)
    expect(apply).toThrow(/changed after optimization|Untrusted operational policy backup|Missing operational ACL table/)
  })

  test.each([
    `CREATE SCHEMA operational_rls_private AUTHORIZATION authenticated`,
    `CREATE SCHEMA operational_rls_private; CREATE TABLE operational_rls_private.policy_originals(table_name text);
      ALTER TABLE operational_rls_private.policy_originals OWNER TO authenticated`,
    `CREATE SCHEMA operational_rls_private; CREATE TABLE operational_rls_private.policy_originals(table_name text)`,
  ])('rejects an untrusted or mismatched private schema/table: %s', change => {
    pg.db(change)
    const before = pg.db(policySnapshot)
    expect(apply).toThrow(/Untrusted owner|Untrusted operational policy backup|column .* does not exist/)
    expect(pg.db(policySnapshot)).toBe(before)
  })

  test('refuses a non-bypass owner-context view', () => {
    pg.db(`CREATE ROLE operational_view_owner;
      CREATE VIEW public.operational_owner_view AS SELECT id FROM public.tasks;
      ALTER VIEW public.operational_owner_view OWNER TO operational_view_owner`)
    expect(apply).toThrow(/Review owner-context operational view/)
    pg.db('DROP OWNED BY operational_view_owner; DROP ROLE operational_view_owner')
  })

  test('does not resolve parent reads against caller temporary tables', () => {
    apply()
    const { ids, extra } = fixture
    expect(pg.call(`CREATE TEMP TABLE conversations(id uuid,site_id uuid,location_id uuid,payload text);
      INSERT INTO conversations VALUES('${extra.hidden}','${ids.site}','${ids.location}',NULL);
      SET search_path=pg_temp,public;
      SELECT count(*) FROM public.messages WHERE id='${extra.hiddenLink}'`, ids.member)).toBe('0')
  })

  test('measures native planning memory/nodes and restricted execution on 20-row graphs before and after', () => {
    const { ids } = fixture
    populateOperationalGraph(pg, ids)
    const queries = {
      units: `SELECT u.id,i.id,s.id FROM sale_order_item_units u LEFT JOIN sale_order_items i ON i.id=u.sale_order_item_id
        LEFT JOIN shipments s ON s.id=u.shipment_id WHERE u.site_id='${ids.site}' LIMIT 100`,
      reservations: `SELECT r.id,i.id FROM reservations r LEFT JOIN sale_order_items i ON i.id=r.sale_order_item_id WHERE r.site_id='${ids.site}' LIMIT 100`,
      tasks: `SELECT t.id,c.id,d.id FROM tasks t LEFT JOIN conversations c ON c.id=t.conversation_id
        LEFT JOIN deals d ON d.id=t.deal_id WHERE t.site_id='${ids.site}' LIMIT 100`,
      messages: `SELECT m.id,c.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.site_id='${ids.site}' LIMIT 100`,
      unitsDeep: `SELECT u.id,i.id,sh.id,o.id,s.id,q.id,su.id FROM sale_order_item_units u
        LEFT JOIN sale_order_items i ON i.id=u.sale_order_item_id LEFT JOIN shipments sh ON sh.id=u.shipment_id
        LEFT JOIN sale_orders o ON o.id=i.sale_order_id LEFT JOIN sales s ON s.id=o.sale_id
        LEFT JOIN quotations q ON q.id=s.quotation_id LEFT JOIN subscriptions su ON su.id=s.subscription_id
        WHERE u.site_id='${ids.site}' LIMIT 100`,
      unitsEmpty: `SELECT u.id,i.id,sh.id FROM sale_order_item_units u
        LEFT JOIN sale_order_items i ON i.id=u.sale_order_item_id LEFT JOIN shipments sh ON sh.id=u.shipment_id
        WHERE u.site_id='${ids.site}' AND u.id='${fixture.extra.missing}' LIMIT 100`,
    }
    const nodeCount = (value: unknown): number => {
      if (!value || typeof value !== 'object') return 0
      return Number('Node Type' in value) + Object.values(value).reduce<number>((sum, next) => sum + nodeCount(next), 0)
    }
    const measure = () => Object.fromEntries(Object.entries(queries).map(([name, sql]) => {
      const explain = (user: string, analyze: boolean) => JSON.parse(pg.call(
        `EXPLAIN (${analyze ? 'ANALYZE, ' : ''}SUMMARY, MEMORY, FORMAT JSON) ${sql}`, user))[0]
      return [name, { plan: explain(ids.member, false), restricted: explain(ids.member, true),
        unrestricted: explain(ids.admin, true), rows: pg.call(sql, ids.member), nodes: 0 }]
    }))
    const tablePlans = () => Object.fromEntries(operationalTables.map(table => [table,
      JSON.parse(pg.call(`EXPLAIN (SUMMARY,MEMORY,FORMAT JSON) SELECT id FROM public.${table} LIMIT 100`, ids.member))[0]]))
    const allBefore = tablePlans()
    const before = measure()
    apply()
    const allAfter = tablePlans()
    const after = measure()
    for (const name of Object.keys(queries)) {
      expect(after[name].rows).toBe(before[name].rows)
      expect(after[name].plan.Planning['Memory Allocated']).toBeLessThan(32 * 1024)
      expect(after[name].plan.Planning['Memory Allocated']).toBeLessThanOrEqual(before[name].plan.Planning['Memory Allocated'])
      expect(nodeCount(after[name].plan.Plan)).toBeLessThan(nodeCount(before[name].plan.Plan))
    }
    expect(after.unitsEmpty.rows).toBe('')
    console.info('offline single-table planner before/after (KiB)', JSON.stringify(Object.fromEntries(operationalTables.map(table =>
      [table, [allBefore[table], allAfter[table]].map(plan => ({ planning: plan.Planning,
        planningMs: plan['Planning Time'], nodes: nodeCount(plan.Plan) }))])), null, 2))
    // No timing assertion: report actual executor trade-offs rather than promise speed.
    console.info('offline operational before/after (planner KiB, ms, nodes)', JSON.stringify(Object.fromEntries(Object.keys(queries).map(name =>
      [name, [before[name], after[name]].map(value => ({ planning: value.plan.Planning,
        planningMs: value.plan['Planning Time'], nodes: nodeCount(value.plan.Plan),
        restrictedExecutionMs: value.restricted['Execution Time'], unrestrictedExecutionMs: value.unrestricted['Execution Time'],
        actualRows: value.restricted.Plan['Actual Rows'] }))])), null, 2))
  })
})
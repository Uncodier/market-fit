/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid, migration, actorSql } from './isolated-postgres'
import { replaceLocations } from './location-access-fixture'
import { enforcementIds as i, installEnforcementFixture, restrictEnforcementMember } from './location-enforcement-fixture'

const describePg = postgresAvailable ? describe : describe.skip
describePg('location enforcement: actual isolated PostgreSQL policies', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installEnforcementFixture(pg))
  const member = (sql: string) => pg.call(sql, i.member)
  const count = (table: string) => member(`SELECT count(*) FROM public.${table}`)

  test('ready only after protections compile; foundation remains disabled beforehand', () => {
    installEnforcementFixture(pg, false)
    expect(pg.db('SELECT editing_enabled FROM location_access_rollout')).toBe('f')
    expect(() => pg.call(replaceLocations([i.secondLocation]))).toThrow(/not enabled/)
    pg.db(migration('20261020030009_location_enforcement_ready.sql'))
    expect(JSON.parse(pg.call(`SELECT read_site_location_restrictions('${i.site}')`)).editing_enabled).toBe(true)
  })

  test('empty exclusions preserve legacy role action, unknown roots and private projections', () => {
    expect(count('deals')).toBe('3')
    expect(count('reports')).toBe('1')
    expect(count('legacy_no_rls')).toBe('1')
    expect(member('SELECT current_user_has_location_restrictions()')).toBe('f')
    expect(member(`DELETE FROM deals WHERE id='${i.allowed}' RETURNING id`)).toBe('')
    expect(() => pg.call(`INSERT INTO deals(site_id) VALUES('${i.site}')`, i.viewer)).toThrow(/row-level security/)
  })

  test('all canonical roots exclude blocked and unknown locations without trusting UI filters', () => {
    restrictEnforcementMember(pg)
    for (const table of ['deals','quotations','subscriptions','tasks','conversations','records',
      'sale_orders','reservations','sales','purchases','transactions','inventory_levels','pos_register_sessions']) {
      expect(count(table)).toBe('1')
    }
    expect(count('locations')).toBe('2')
    expect(pg.call('SELECT count(*) FROM deals', i.owner)).toBe('3')
    expect(pg.call('SELECT count(*) FROM deals', i.admin)).toBe('3')
    expect(member(`SELECT count(*) FROM deals WHERE id='${i.denied}'`)).toBe('0')
  })

  test('direct children inherit parent AND policies and cannot point across tenants', () => {
    restrictEnforcementMember(pg)
    for (const table of ['purchase_items','messages','sale_order_items','sale_order_item_units','task_comments']) {
      expect(count(table)).toBe('1')
    }
    expect(() => member(`INSERT INTO purchase_items(site_id,purchase_id) VALUES('${i.site}','${i.denied}')`))
      .toThrow(/row-level security/)
    expect(() => pg.call(`INSERT INTO purchase_items(site_id,purchase_id) VALUES('${i.site}','${i.other}')`))
      .toThrow(/foreign key/)
    expect(() => member(`UPDATE purchase_items SET purchase_id='${i.denied}' WHERE id='${i.child}'`))
      .toThrow(/row-level security/)
  })

  test('same-site composite constraints preserve existing cascade and relationship-only nulling', () => {
    pg.call(`DELETE FROM purchases WHERE id='${i.allowed}'`)
    expect(pg.db(`SELECT count(*) FROM purchase_items WHERE id='${i.child}'`)).toBe('0')
    pg.call(`UPDATE sale_orders SET sale_id='${i.allowed}' WHERE id='${i.allowed}'`)
    pg.call(`DELETE FROM sales WHERE id='${i.allowed}'`)
    expect(pg.db(`SELECT (sale_id IS NULL)::text || ':' || site_id || ':' || location_id
      FROM sale_orders WHERE id='${i.allowed}'`)).toBe(`true:${i.site}:${i.location}`)
  })

  test('shipments require authorized origin AND commercial order; units cannot hide a blocked shipment', () => {
    pg.db(`UPDATE shipments SET sale_order_id=id WHERE id IN ('${i.allowed}','${i.denied}');
      INSERT INTO shipment_location_pings(id,site_id,shipment_id) VALUES
        ('${i.child}','${i.site}','${i.allowed}'),('${i.deniedChild}','${i.site}','${i.denied}');
      UPDATE sale_order_item_units SET shipment_id='${i.allowed}' WHERE id='${i.child}';`)
    restrictEnforcementMember(pg)
    expect(count('shipments')).toBe('1')
    expect(count('shipment_location_pings')).toBe('1')
    expect(count('sale_order_item_units')).toBe('1')
    expect(() => member(`UPDATE shipments SET sale_order_id='${i.denied}' WHERE id='${i.allowed}'`))
      .toThrow(/row-level security/)
    expect(() => member(`UPDATE sale_order_item_units SET shipment_id='${i.denied}' WHERE id='${i.child}'`))
      .toThrow(/row-level security/)
    expect(() => member(`UPDATE shipments SET origin_location_id='${i.secondLocation}' WHERE id='${i.allowed}'`))
      .toThrow(/row-level security/)
  })

  test('role action remains required even for allowed location and assignment policy is ANDed', () => {
    pg.call(replaceLocations([i.secondLocation], i.viewerMember))
    expect(pg.call('SELECT count(*) FROM deals', i.viewer)).toBe('1')
    expect(() => pg.call(`INSERT INTO deals(site_id,location_id) VALUES('${i.site}','${i.location}')`,i.viewer))
      .toThrow(/row-level security/)
    restrictEnforcementMember(pg)
    pg.db(`CREATE POLICY assignment_constraint ON deals AS RESTRICTIVE TO authenticated
      USING(id<>'${i.allowed}') WITH CHECK(id<>'${i.allowed}')`)
    expect(count('deals')).toBe('0')
    expect(member(`DELETE FROM purchases WHERE id='${i.allowed}' RETURNING id`)).toBe('')
  })

  test('legacy permissive ALL and direct no-site children cannot bypass role actions', () => {
    pg.call(replaceLocations([i.secondLocation], i.viewerMember))
    pg.db(`CREATE POLICY old_all_access ON inventory_levels FOR ALL TO authenticated USING(true) WITH CHECK(true)`)
    expect(() => pg.call(`UPDATE inventory_levels SET quantity=999 WHERE id='${i.allowed}' RETURNING id`,i.viewer))
      .not.toThrow()
    expect(pg.db(`SELECT quantity FROM inventory_levels WHERE id='${i.allowed}'`)).toBe('20')
    expect(() => pg.call(`INSERT INTO messages(conversation_id) VALUES('${i.allowed}')`,i.viewer)).toThrow(/row-level security/)
  })

  test('real assignment predicates remain callable from RLS without recursive quarantine', () => {
    restrictEnforcementMember(pg)
    pg.db(`CREATE POLICY exact_assignment ON deals AS RESTRICTIVE TO authenticated
      USING(public.is_deal_owner(id,auth.uid())) WITH CHECK(public.is_deal_owner(id,auth.uid()));
      CREATE POLICY exact_record_access ON records AS RESTRICTIVE TO authenticated
      USING(public.can_access_record_values(site_id,relations)) WITH CHECK(public.can_access_record_values(site_id,relations));`)
    expect(count('deals')).toBe('1')
    expect(count('records')).toBe('1')
    pg.db(`UPDATE site_members SET restrict_to_assigned_only=true WHERE id='${i.memberRow}'`)
    expect(count('records')).toBe('0')
  })

  test('inventory permits real local CRUD, not blocked/unknown/null/cross-site writes', () => {
    restrictEnforcementMember(pg)
    expect(member(`UPDATE inventory_levels SET quantity=25 WHERE id='${i.allowed}' RETURNING quantity`)).toBe('25')
    expect(member(`UPDATE inventory_levels SET quantity=99 WHERE id='${i.denied}' RETURNING id`)).toBe('')
    expect(() => member(`INSERT INTO inventory_levels(site_id,catalog_item_id,location_id,quantity)
      VALUES('${i.site}','${i.item}',NULL,5)`)).toThrow(/row-level security/)
    expect(() => pg.call(`INSERT INTO inventory_levels(site_id,catalog_item_id,location_id)
      VALUES('${i.site}','${i.item}','${i.foreignLocation}')`)).toThrow(/foreign key/)
    expect(() => pg.call(`INSERT INTO inventory_levels(site_id,catalog_item_id,location_id)
      VALUES('${i.site}','${i.otherItem}','${i.thirdLocation}')`)).toThrow(/foreign key/)
    expect(() => pg.call(`INSERT INTO deals(site_id,location_id) VALUES('${i.site}','${uuid(999)}')`)).toThrow(/foreign key/)
    expect(() => pg.db(`INSERT INTO deals(site_id,location_id) VALUES(NULL,'${i.location}')`)).toThrow(/check constraint/)
    expect(() => member(`UPDATE deals SET location_id='${i.secondLocation}' WHERE id='${i.allowed}'`)).toThrow(/row-level security/)
  })

  test('atomic transfer authorizes both ends and rolls back without losing source stock', () => {
    restrictEnforcementMember(pg)
    const transfer = (destination: string, quantity = 3) => member(`SELECT transfer_location_inventory(
      '${i.site}','${i.item}','${i.location}','${destination}',${quantity})`)
    expect(() => transfer(i.secondLocation)).toThrow(/access denied/)
    expect(member(`SELECT quantity FROM inventory_levels WHERE id='${i.allowed}'`)).toBe('20')
    expect(JSON.parse(transfer(i.thirdLocation))).toEqual({ from_quantity: 17,to_quantity: 3 })
    expect(() => transfer(i.thirdLocation, 100)).toThrow(/Insufficient/)
    expect(() => transfer(i.thirdLocation, -1)).toThrow(/positive/)
    expect(member(`SELECT quantity FROM inventory_levels WHERE id='${i.allowed}'`)).toBe('17')
  })

  test('concurrent transfers serialize without double spending or partial destination writes', async () => {
    restrictEnforcementMember(pg)
    const statement = actorSql(`SELECT transfer_location_inventory('${i.site}','${i.item}',
      '${i.location}','${i.thirdLocation}',15)`,i.member)
    const outcomes = await Promise.allSettled([pg.concurrent(statement),pg.concurrent(statement)])
    expect(outcomes.filter(result => result.status==='fulfilled')).toHaveLength(1)
    expect(outcomes.filter(result => result.status==='rejected')).toHaveLength(1)
    expect(member(`SELECT sum(quantity) FROM inventory_levels`)).toBe('20')
    expect(member(`SELECT quantity FROM inventory_levels WHERE id='${i.allowed}'`)).toBe('5')
  })

  test('root inheritance copies parent and rejects every conflicting parent including task lead', () => {
    restrictEnforcementMember(pg)
    expect(member(`INSERT INTO tasks(id,site_id,deal_id,conversation_id)
      VALUES('${i.newRow}','${i.site}','${i.allowed}','${i.allowed}') RETURNING location_id`)).toBe(i.location)
    expect(() => pg.call(`INSERT INTO tasks(site_id,deal_id,conversation_id)
      VALUES('${i.site}','${i.allowed}','${i.denied}')`)).toThrow(/parent locations must agree/)
    expect(() => member(`INSERT INTO tasks(site_id,deal_id,lead_id)
      VALUES('${i.site}','${i.allowed}','${i.allowed}')`)).toThrow(/row-level security/)
    expect(() => pg.call(`UPDATE deals SET location_id='${i.secondLocation}' WHERE id='${i.allowed}'`)).toThrow(/foreign key/)
  })

  test('unsupported private tables and owner-view bypass denied globally; leads notes never shared', () => {
    restrictEnforcementMember(pg)
    for (const table of ['reports','opaque_projection','leads','deal_leads','legacy_no_rls']) expect(count(table)).toBe('0')
    expect(count('private_deal_view')).toBe('0')
    expect(count('invoker_deal_view')).toBe('1')
    expect(member('SELECT count(*) FROM storage.objects')).toBe('0')
    expect(() => member(`INSERT INTO reports(site_id) VALUES('${i.site}')`)).toThrow(/row-level security/)
    pg.db(`INSERT INTO site_members(id,site_id,user_id,role,status) VALUES('${uuid(108)}','${i.otherSite}','${i.member}','admin','active')`)
    expect(member(`SELECT count(*) FROM reports WHERE site_id='${i.site}'`)).toBe('0')
    expect(member('SELECT current_user_has_location_restrictions()')).toBe('t')
  })

  test('privileged RPC quarantine preserves signatures/OUT/grants but blocks restricted bypass', () => {
    expect(member('SELECT private_rollup()')).toBe('1')
    expect(member('SELECT private_out()')).toBe('1')
    expect(member('SELECT private_inout(4)')).toBe('5')
    restrictEnforcementMember(pg)
    for (const call of ['private_rollup()','private_out()','private_rows()','private_inout(4)']) {
      expect(() => member(`SELECT ${call}`)).toThrow(/no authorized location projection/)
    }
    expect(member(`SELECT has_schema_privilege('authenticated','location_acl_private','USAGE')`)).toBe('f')
    expect(member(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='location_acl_private' AND has_function_privilege('authenticated',p.oid,'EXECUTE')`)).toBe('0')
    expect(() => member('SELECT service_only()')).toThrow(/permission denied/)
    expect(pg.call('SELECT service_only()', i.member,'service_role')).toBe('7')
  })

  test('anonymous private policy bypass is closed; independent minimal buyer/catalog contract remains', () => {
    expect(count('buyer_documents')).toBe('1')
    restrictEnforcementMember(pg)
    expect(count('buyer_documents')).toBe('0')
    expect(JSON.parse(pg.call(`SELECT buyer_document('${i.allowed}','${i.member}')`,i.member,'service_role')))
      .toEqual({ id: i.allowed,title: 'My purchase' })
    expect(pg.call(`SELECT buyer_document('${i.denied}','${i.member}')`,i.member,'service_role')).toBe('')
    expect(() => member(`SELECT buyer_document('${i.allowed}','${i.member}')`)).toThrow(/permission denied/)
    expect(pg.call('SELECT count(*) FROM deals', i.member, 'anon')).toBe('0')
    expect(pg.call('SELECT count(*) FROM conversations', i.member, 'anon')).toBe('0')
    expect(pg.call('SELECT count(*) FROM catalog_items', i.member, 'anon')).toBe('2')
    expect(() => pg.call('SELECT private_rollup()', i.member, 'anon')).toThrow(/permission denied/)
    expect(pg.call('SELECT private_rollup()', i.member, 'service_role')).toBe('1')
    expect(pg.call('SELECT count(*) FROM deals', i.member, 'service_role')).toBe('4')
    expect(pg.call('SELECT count(*) FROM storage.objects',i.member,'anon')).toBe('1')
    expect(pg.call('SELECT current_user_has_location_restrictions()',i.pendingUser)).toBe('f')
    expect(pg.call('SELECT private_rollup()',i.pendingUser)).toBe('1')
  })

  test('warm prepared statement rechecks restriction changes and role revocation', () => {
    expect(member(`PREPARE warm AS SELECT count(*) FROM deals; EXECUTE warm;
      RESET ROLE; INSERT INTO site_member_location_restrictions VALUES('${i.site}','${i.memberRow}','${i.secondLocation}');
      SET ROLE authenticated; EXECUTE warm;
      RESET ROLE; UPDATE site_members SET manually_disabled=true WHERE id='${i.memberRow}';
      SET ROLE authenticated; EXECUTE warm;`)).toBe('3\n1\n0')
    expect(member('SELECT current_user_has_location_restrictions()')).toBe('t')
  })

  test('only manager can resolve canonical scope and false readiness remains authoritative', () => {
    restrictEnforcementMember(pg)
    const assignment = `SELECT assign_location_scope('deals','${i.unresolved}','${i.site}','${i.location}')`
    expect(() => member(assignment)).toThrow(/Manager/)
    expect(JSON.parse(pg.call(assignment)).location_id).toBe(i.location)
    expect(count('deals')).toBe('2')
    expect(() => pg.call(assignment)).toThrow(/Unresolved root/)
  })
})
/** @jest-environment node */
import { actorSql, isolatedPostgres, postgresAvailable, uuid } from './isolated-postgres'
import { waitForLocationBarrier } from './location-access-fixture'
import { checkedRestrictions, i, installReviewFixture } from './location-review-fixture'

const describePg = postgresAvailable ? describe : describe.skip
describePg('location SQL review: real PostgreSQL legacy FK/grant contracts', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => installReviewFixture(pg))
  const member = (sql: string) => pg.call(sql, i.member)
  const relationships = (child: string, parent: string) => pg.db(`SELECT string_agg(conname,',' ORDER BY conname)
    FROM pg_constraint WHERE contype='f' AND conrelid='${child}'::regclass AND confrelid='${parent}'::regclass`)

  test('legacy embeds have one FK, retaining constraint hints including existing composite pairs', () => {
    const pairs = [
      ['sales','locations','sales_location_id_fkey'],
      ['inventory_levels','locations','inventory_levels_location_id_fkey'],
      ['inventory_levels','catalog_items','inventory_levels_catalog_item_id_fkey'],
      ['quotations','deals','quotations_deal_id_fkey'],
      ['sale_orders','sales','sale_orders_sale_id_fkey'],
      ['sale_order_items','sale_orders','sale_order_items_sale_order_id_fkey'],
      ['purchase_items','purchases','purchase_items_purchase_site_fkey'],
      ['pos_register_movements','pos_register_sessions','pos_register_movements_session_id_site_id_fkey'],
      ['pos_register_receipts','pos_register_sessions','pos_register_receipts_session_id_site_id_fkey'],
    ]
    for (const [child,parent,name] of pairs) expect(relationships(child,parent)).toBe(name)
    expect(relationships('reservations','locations')).toBe('location_acl_location_site_fk,reservations_location_id_fkey')
    expect(pg.db(`SELECT count(*) FROM pg_constraint WHERE contype='f' AND cardinality(conkey)=3`)).toBe('0')
  })

  test('new same-site writes, required parents and same-scope links are enforced for service too', () => {
    const service = (sql: string) => pg.call(sql, i.owner, 'service_role')
    expect(() => service(`INSERT INTO sales(site_id,location_id) VALUES('${i.site}','${i.foreignLocation}')`)).toThrow(/foreign key/)
    expect(() => service(`INSERT INTO purchase_items(site_id,purchase_id) VALUES('${i.site}','${i.other}')`)).toThrow(/Operational parent unavailable/)
    expect(() => service(`INSERT INTO purchase_items(site_id) VALUES('${i.site}')`)).toThrow(/Operational parent required/)
    expect(() => service(`INSERT INTO quotations(site_id,location_id,deal_id)
      VALUES('${i.site}','${i.location}','${i.denied}')`)).toThrow(/locations must agree/)
    expect(service(`INSERT INTO quotations(site_id,deal_id) VALUES('${i.site}','${i.allowed}') RETURNING location_id`)).toBe(i.location)
  })

  test('consolidation preserves child cascade and relationship-only SET NULL', () => {
    pg.call(`DELETE FROM purchases WHERE id='${i.allowed}'`)
    expect(pg.db(`SELECT count(*) FROM purchase_items WHERE id='${i.child}'`)).toBe('0')
    pg.call(`UPDATE sale_orders SET sale_id='${i.allowed}' WHERE id='${i.allowed}'`)
    pg.call(`DELETE FROM sales WHERE id='${i.allowed}'`)
    expect(pg.db(`SELECT (sale_id IS NULL)::text||':'||site_id||':'||location_id
      FROM sale_orders WHERE id='${i.allowed}'`)).toBe(`true:${i.site}:${i.location}`)
  })

  test('raw scope UPDATE cannot launder roots; manager RPC resolves exactly once', () => {
    expect(() => member(`UPDATE deals SET location_id='${i.location}' WHERE id='${i.unresolved}'`)).toThrow(/Manager scope assignment required/)
    expect(() => pg.call(`UPDATE deals SET location_id='${i.location}' WHERE id='${i.unresolved}'`)).toThrow(/Manager scope assignment required/)
    expect(() => member(`SET location_acl.approved='true'; UPDATE deals SET location_id='${i.location}' WHERE id='${i.unresolved}'`))
      .toThrow(/Manager scope assignment required/)
    const assign = `SELECT assign_location_scope('deals','${i.unresolved}','${i.site}','${i.location}')`
    expect(() => member(assign)).toThrow(/Manager/)
    expect(JSON.parse(pg.call(assign)).location_id).toBe(i.location)
    expect(() => pg.call(assign)).toThrow(/Unresolved root not found/)
    expect(pg.db('SELECT count(*) FROM location_acl_private.scope_assignments')).toBe('0')
    expect(() => member('INSERT INTO location_acl_private.scope_assignments DEFAULT VALUES')).toThrow(/permission denied/)
  })

  test('known scope and tenant identities are immutable for member, manager and service', () => {
    for (const [user,role] of [[i.member,'authenticated'],[i.owner,'authenticated'],[i.owner,'service_role']]) {
      for (const table of ['deals','sales','purchases','transactions','inventory_levels','pos_register_sessions']) {
        expect(() => pg.call(`UPDATE ${table} SET location_id='${i.secondLocation}' WHERE id='${i.allowed}'`,user,role)).toThrow(/immutable/)
        expect(() => pg.call(`UPDATE ${table} SET location_id=NULL WHERE id='${i.allowed}'`,user,role)).toThrow(/immutable/)
      }
      expect(() => pg.call(`UPDATE deals SET site_id='${i.otherSite}',location_id='${i.foreignLocation}' WHERE id='${i.allowed}'`,user,role))
        .toThrow(/identity is immutable/)
    }
  })

  test('hidden vs nonexistent parent produces identical denial before scope comparisons', () => {
    pg.call(checkedRestrictions([i.secondLocation]))
    const failure = (parent: string, location: string) => {
      try { member(`INSERT INTO quotations(site_id,location_id,deal_id) VALUES('${i.site}','${location}','${parent}')`) }
      catch (error) { return String(error).split('ERROR:')[1]?.split('CONTEXT:')[0]?.trim() }
      throw new Error('Expected denial')
    }
    expect(failure(i.denied,i.location)).toBe('Operational parent unavailable')
    expect(failure(i.denied,i.secondLocation)).toBe(failure(uuid(9999),i.location))
    expect(failure(i.other,i.location)).toBe(failure(i.denied,i.location))
  })

  test('records gets only INSERT(location_id), preserving deployed column-grant restrictions', () => {
    expect(member(`INSERT INTO records(site_id,title,location_id) VALUES('${i.site}','Valid','${i.location}') RETURNING location_id`)).toBe(i.location)
    expect(() => member(`INSERT INTO records(site_id,title,source_id) VALUES('${i.site}','Invalid','${i.allowed}')`)).toThrow(/permission denied/)
    expect(() => member(`UPDATE records SET location_id='${i.secondLocation}' WHERE id='${i.allowed}'`)).toThrow(/permission denied/)
    pg.call(checkedRestrictions([i.secondLocation]))
    expect(() => member(`INSERT INTO records(site_id,title,location_id) VALUES('${i.site}','Blocked','${i.secondLocation}')`)).toThrow(/row-level security/)
    expect(() => member(`INSERT INTO records(site_id,title) VALUES('${i.site}','Unresolved')`)).toThrow(/row-level security/)
  })

  test('checked replacement rejects stale no-op/clear, normalizes sets and closes legacy bypass', () => {
    expect(JSON.parse(pg.call(checkedRestrictions([i.secondLocation]))).revision).toBe(1)
    expect(() => pg.call(checkedRestrictions([]))).toThrow(/Location restrictions changed; reload before saving/)
    expect(() => pg.call(checkedRestrictions([i.secondLocation]))).toThrow(/Location restrictions changed/)
    expect(JSON.parse(pg.call(checkedRestrictions([i.secondLocation],[i.secondLocation,i.secondLocation]))).revision).toBe(1)
    expect(() => member(checkedRestrictions([],[i.secondLocation]))).toThrow(/manager/)
    expect(() => pg.call(`SELECT replace_site_member_location_restrictions('${i.site}','${i.memberRow}','{}')`)).toThrow(/permission denied/)
    expect(JSON.parse(pg.call(checkedRestrictions([],[i.secondLocation]))).revision).toBe(2)
  })

  test('two managers cannot overwrite the same expected set after waiting for lock', async () => {
    const first = pg.concurrent(actorSql(`BEGIN; SET application_name='review-cas';
      ${checkedRestrictions([i.secondLocation])}; SELECT pg_sleep(0.7); COMMIT;`))
    await waitForLocationBarrier(pg,'review-cas')
    const stale = pg.concurrent(actorSql(checkedRestrictions([i.location]),i.admin))
    await first
    await expect(stale).rejects.toThrow(/Location restrictions changed/)
    expect(pg.db(`SELECT location_id FROM site_member_location_restrictions WHERE site_member_id='${i.memberRow}'`)).toBe(i.secondLocation)
    expect(pg.db('SELECT count(*) FROM site_member_location_restriction_audit')).toBe('1')
  })

  test('per-site unscoped check fails closed after a previously-read role is revoked', () => {
    expect(member(`SELECT current_user_site_role('${i.site}')`)).toBe('collaborator')
    expect(member(`SELECT current_user_has_site_location_restrictions('${i.site}')`)).toBe('f')
    pg.db(`UPDATE site_members SET manually_disabled=true WHERE id='${i.memberRow}'`)
    expect(member(`SELECT current_user_has_site_location_restrictions('${i.site}')`)).toBe('t')
    expect(pg.call(`SELECT current_user_has_site_location_restrictions('${i.site}')`,i.foreign)).toBe('t')
    expect(pg.call(`SELECT current_user_has_site_location_restrictions('${i.site}')`)).toBe('f')
    // Personal/global paths retain their independently scoped predicate semantics.
    expect(member('SELECT current_user_has_location_restrictions()')).toBe('f')
  })

  test('inheritance keeps a SHARE lock that prevents non-key parent updates until commit', async () => {
    const insert = pg.concurrent(actorSql(`BEGIN; SET application_name='review-parent-share';
      INSERT INTO quotations(site_id,deal_id) VALUES('${i.site}','${i.allowed}'); SELECT pg_sleep(0.8); COMMIT;`))
    await waitForLocationBarrier(pg,'review-parent-share')
    const update = pg.concurrent(actorSql(`SET application_name='review-parent-update';
      UPDATE deals SET payload='Changed' WHERE id='${i.allowed}';`))
    const deadline = Date.now()+5000
    while (pg.db(`SELECT count(*) FROM pg_stat_activity WHERE application_name='review-parent-update'
      AND wait_event_type='Lock'`) !== '1') {
      if (Date.now()>deadline) throw new Error('Parent writer did not wait on SHARE lock')
      await new Promise(resolve => setTimeout(resolve,10))
    }
    await insert
    await update
  })

  test('concurrent initial assignment is observed by waiting parent inheritance, not stale scope', async () => {
    const assignment = pg.concurrent(actorSql(`BEGIN; SET application_name='review-assignment';
      SELECT assign_location_scope('deals','${i.unresolved}','${i.site}','${i.location}'); SELECT pg_sleep(0.7); COMMIT;`))
    await waitForLocationBarrier(pg,'review-assignment')
    const child = pg.concurrent(actorSql(`INSERT INTO quotations(site_id,location_id,deal_id)
      VALUES('${i.site}','${i.secondLocation}','${i.unresolved}')`))
    await assignment
    await expect(child).rejects.toThrow(/locations must agree/)
  })

  test('initial parent assignment cannot silently invalidate an unresolved linked child', () => {
    pg.call(`INSERT INTO quotations(site_id,deal_id) VALUES('${i.site}','${i.unresolved}')`)
    expect(() => pg.call(`SELECT assign_location_scope('deals','${i.unresolved}','${i.site}','${i.location}')`))
      .toThrow(/Operational parent scope is inconsistent/)
    expect(pg.db(`SELECT location_id IS NULL FROM deals WHERE id='${i.unresolved}'`)).toBe('t')
  })
})
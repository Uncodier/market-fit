/** @jest-environment node */
import { actorSql, actors, ids, isolatedPostgres, postgresAvailable, sqlJson, uuid } from './storage-fixture'
import { itemId, saveRequest, taxId } from './requests-fixture'
import { approve, openAward, recordQuote } from './commerce-fixture'
import { closeCase, evaluateRule, installReplenishmentFixture, installReplenishmentQueue, inventoryId, locationId, ruleDocument, saveRule, secondLocationId } from './replenishment-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('inventory replenishment with real isolated PostgreSQL 17', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => { installReplenishmentFixture(pg); installReplenishmentQueue(pg) })
  const evaluate = (rule: string) => JSON.parse(pg.call(evaluateRule(rule)))
  const count = (table: string) => pg.db(`SELECT count(*) FROM public.${table};`)
  const caseId = () => pg.db(`SELECT id FROM public.procurement_replenishment_cases WHERE status='open';`)
  const stock = (quantity: number) => pg.db(`UPDATE public.inventory_levels SET quantity=${quantity};`)

  test('creates only a real draft with exact immutable origin and catalog price/tax snapshots', () => {
    const rule = pg.call(saveRule())
    const result = evaluate(rule)
    expect(result).toMatchObject({ status: 'draft_created', quantity: 12, on_hand: 2.5 })
    expect(JSON.parse(pg.call(`SELECT to_jsonb(q) FROM public.procurement_requests q;`)))
      .toMatchObject({ id: result.request_id, status: 'draft', requester_id: ids.owner, net_amount_minor: 14808, policy_revision: null })
    expect(JSON.parse(pg.call(`SELECT to_jsonb(i) FROM public.procurement_request_items i;`)))
      .toMatchObject({ catalog_item_id: itemId, quantity: 12, unit_net_minor: 1234, tax_snapshot: [{ id: taxId, rate: 16 }] })
    expect(JSON.parse(pg.call(`SELECT to_jsonb(c) FROM public.procurement_replenishment_cases c;`)))
      .toMatchObject({ rule_id: rule, rule_version: 1, request_id: result.request_id, location_id: locationId, observed_quantity: 2.5, quantity: 12 })
    expect(count('purchase_orders')).toBe('0')
    expect(count('procurement_awards')).toBe('0')
    pg.db(`UPDATE public.catalog_items SET cost=99; UPDATE public.taxes SET rate=20;`)
    expect(evaluate(rule).status).toBe('covered')
    expect(count('procurement_requests')).toBe('1')
    expect(pg.call('SELECT unit_net_minor FROM public.procurement_request_items;')).toBe('1234')
  })

  test('save CAS, immutable identity, unique site/SKU/location and manager attribution', () => {
    const rule = pg.call(saveRule())
    pg.call(saveRule({ ...ruleDocument, minimum: 4 }, rule, 1), ids.admin)
    expect(JSON.parse(pg.call('SELECT to_jsonb(r) FROM public.procurement_replenishment_rules r;')))
      .toMatchObject({ version: 2, minimum: 4, created_by: ids.owner, updated_by: ids.admin })
    expect(() => pg.call(saveRule(ruleDocument, rule, 1))).toThrow(/Version conflict/)
    expect(() => pg.call(saveRule())).toThrow(/duplicate key/)
    expect(() => pg.call(saveRule({ ...ruleDocument, location_id: secondLocationId }, rule, 2))).toThrow(/immutable/)
  })

  test.each([
    "UPDATE public.catalog_items SET status='archived';",
    'UPDATE public.catalog_items SET procurement_enabled=false;',
    'UPDATE public.catalog_items SET track_inventory=false;',
    'UPDATE public.locations SET is_active=false;',
  ])('allows disabling obsolete references, but never creates or re-enables them: %s', change => {
    const rule = pg.call(saveRule())
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}"}'; ${change}`)
    const disabled = { ...ruleDocument, enabled: false }
    expect(() => pg.call(saveRule(disabled, rule, 1), ids.foreign)).toThrow(/access denied/)
    expect(() => pg.call(saveRule({ ...disabled, location_id: secondLocationId }, rule, 1))).toThrow(/immutable/)
    expect(() => pg.call(saveRule(disabled, rule, 0))).toThrow(/Version conflict/)
    pg.call(saveRule(disabled, rule, 1), ids.admin)
    expect(JSON.parse(pg.call('SELECT to_jsonb(r) FROM public.procurement_replenishment_rules r;')))
      .toMatchObject({ enabled: false, version: 2, updated_by: ids.admin })
    expect(evaluate(rule)).toMatchObject({ status: 'blocked', message: 'Rule is disabled' })
    expect(() => pg.call(saveRule(ruleDocument, rule, 2))).toThrow(/unavailable/)
    expect(() => pg.call(saveRule(disabled))).toThrow(/unavailable/)
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}"}';
      UPDATE public.catalog_items SET status='active',procurement_enabled=true,track_inventory=true;
      UPDATE public.locations SET is_active=true;`)
    pg.call(saveRule(ruleDocument, rule, 2))
    expect(evaluate(rule).status).toBe('draft_created')
  })

  test.each([
    { minimum: -1 }, { target: 3 }, { minimum_order: 0 }, { minimum_order: 1.5 },
    { order_multiple: 0 }, { order_multiple: 1.5 }, { minimum: '3' }, { action: 'order' },
    { enabled: null }, { supplier_id: uuid(99) }, { created_by: ids.foreign }, { minimum_order: 1000001 },
  ])('rejects malformed rule %j', change => {
    expect(() => pg.call(saveRule({ ...ruleDocument, ...change }))).toThrow(/Invalid replenishment/)
    expect(count('procurement_replenishment_rules')).toBe('0')
  })

  test.each([ids.foreign, ids.inactive, actors.restricted, actors.unlicensed, actors.member, uuid(999)])('denies reads/writes/evaluation/close for %s', actor => {
    const rule = pg.call(saveRule()); evaluate(rule)
    for (const table of ['procurement_replenishment_rules', 'procurement_replenishment_cases']) {
      expect(pg.call(`SELECT count(*) FROM public.${table};`, actor)).toBe('0')
    }
    expect(() => pg.call(saveRule(ruleDocument, rule, 1), actor)).toThrow(/access denied/)
    expect(() => pg.call(evaluateRule(rule), actor)).toThrow(/access denied/)
    expect(() => pg.call(closeCase(caseId()), actor)).toThrow(/access denied/)
  })

  test('denies anonymous/service RPCs, direct writes, cross-site IDs and user_can denial', () => {
    const rule = pg.call(saveRule()); evaluate(rule)
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.call(evaluateRule(rule), ids.owner, role)).toThrow(/permission denied/)
    }
    for (const table of ['procurement_replenishment_rules', 'procurement_replenishment_cases']) {
      expect(() => pg.call(`DELETE FROM public.${table};`)).toThrow(/permission denied/)
      expect(() => pg.call(`SELECT * FROM public.${table};`, ids.owner, 'anon')).toThrow(/permission denied/)
    }
    expect(() => pg.call(evaluateRule(rule, ids.otherSite))).toThrow(/access denied/)
    expect(() => pg.call(evaluateRule(uuid(98)))).toThrow(/not found/)
    pg.db(`CREATE OR REPLACE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`)
    expect(() => pg.call(evaluateRule(rule))).toThrow(/access denied/)
    expect(() => pg.call(saveRule(ruleDocument, rule, 1))).toThrow(/access denied/)
    expect(() => pg.call(closeCase(caseId()))).toThrow(/access denied/)
  })

  test.each(['procurement_enabled=false', 'track_inventory=false', "status='archived'", `site_id='${ids.otherSite}'`])('revalidates catalog eligibility: %s', update => {
    const rule = pg.call(saveRule())
    pg.db(`SET session_replication_role=replica; UPDATE public.catalog_items SET ${update};`)
    expect(evaluate(rule)).toMatchObject({ status: 'blocked', message: 'Inventory item unavailable' })
    expect(() => pg.call(saveRule(ruleDocument, rule, 1))).toThrow(/item unavailable/)
  })

  test('revalidates location, disabled rule and missing/duplicate/nonfinite stock without assuming zero', () => {
    const rule = pg.call(saveRule())
    pg.db('UPDATE public.locations SET is_active=false;')
    expect(evaluate(rule).status).toBe('blocked')
    pg.db('UPDATE public.locations SET is_active=true;')
    pg.call(saveRule({ ...ruleDocument, enabled: false }, rule, 1))
    expect(evaluate(rule).message).toBe('Rule is disabled')
    pg.call(saveRule(ruleDocument, rule, 2))
    pg.db(`UPDATE public.inventory_levels SET quantity='NaN';`)
    expect(evaluate(rule).status).toBe('blocked')
    stock(2)
    pg.db(`INSERT INTO public.inventory_levels SELECT '${uuid(1203)}',site_id,catalog_item_id,location_id,quantity,updated_at FROM public.inventory_levels;`)
    expect(evaluate(rule).message).toContain('ambiguous')
    pg.db('DELETE FROM public.inventory_levels;')
    expect(evaluate(rule).message).toContain('missing')
    expect(count('procurement_requests')).toBe('0')
  })

  test.each([
    { onHand: 3, minimumOrder: 5, multiple: 4, quantity: 12 },
    { onHand: -0.5, minimumOrder: 5, multiple: 4, quantity: 16 },
    { onHand: 2.5, minimumOrder: 17, multiple: 4, quantity: 20 },
  ])('rounds fractional/negative stock and minimum order to multiples: %j', value => {
    const rule = pg.call(saveRule({ ...ruleDocument, minimum_order: value.minimumOrder, order_multiple: value.multiple }))
    stock(value.onHand)
    expect(evaluate(rule)).toMatchObject({ status: 'draft_created', quantity: value.quantity, on_hand: value.onHand })
  })

  test('quantity bound and failed catalog pricing roll back all generated records', () => {
    const rule = pg.call(saveRule({ ...ruleDocument, target: 1000000 }))
    stock(-1)
    expect(evaluate(rule).status).toBe('blocked')
    pg.call(saveRule(ruleDocument, rule, 1))
    pg.db('UPDATE public.catalog_items SET cost=NULL;')
    expect(() => evaluate(rule)).toThrow(/pricing unavailable/)
    expect(count('procurement_requests')).toBe('0')
    expect(count('procurement_replenishment_cases')).toBe('0')
  })

  test('one alert per low-stock cycle; rule changes do not create a second incident', () => {
    const rule = pg.call(saveRule({ ...ruleDocument, action: 'alert' }))
    expect(evaluate(rule).status).toBe('alert')
    pg.call(saveRule(ruleDocument, rule, 1))
    expect(evaluate(rule).status).toBe('alert')
    stock(5); expect(evaluate(rule).status).toBe('above_minimum')
    stock(1); expect(evaluate(rule).status).toBe('alert')
    expect(count('procurement_replenishment_cases')).toBe('1')
    expect(count('procurement_requests')).toBe('0')
    stock(12); evaluate(rule)
    stock(1); expect(evaluate(rule).status).toBe('draft_created')
    expect(count('procurement_replenishment_cases')).toBe('2')
  })

  test('recovered stock never releases an unresolved generated requisition', () => {
    const rule = pg.call(saveRule()); const first = evaluate(rule)
    stock(40); expect(evaluate(rule).status).toBe('above_minimum')
    stock(1); expect(evaluate(rule)).toMatchObject({ status: 'covered', request_id: first.request_id })
    expect(count('procurement_requests')).toBe('1')
  })

  test.each(['draft', 'submitted', 'returned', 'rejected', 'approved'])('generated %s requests block until explicit audited resolution', state => {
    const rule = pg.call(saveRule()); const result = evaluate(rule); const incident = caseId()
    pg.db(`UPDATE public.procurement_requests SET status='${state}';`)
    pg.call(saveRule({ ...ruleDocument, target: 20 }, rule, 1))
    expect(evaluate(rule)).toMatchObject({ status: 'covered', request_id: result.request_id })
    expect(() => pg.call(closeCase(incident, ' '))).toThrow(/reason required/)
    pg.call(closeCase(incident), ids.admin)
    expect(() => pg.call(closeCase(incident))).toThrow(/already closed/)
    expect(evaluate(rule).status).toBe('draft_created')
    expect(JSON.parse(pg.call(`SELECT to_jsonb(c) FROM public.procurement_replenishment_cases c WHERE id='${incident}';`)))
      .toMatchObject({ request_id: result.request_id, rule_version: 1, quantity: 12, status: 'closed', closed_by: ids.admin })
  })

  test.each(['draft', 'submitted', 'returned', 'approved'])('existing unrelated %s requisition blocks unallocated same-SKU supply', state => {
    pg.call(saveRequest()); pg.db(`UPDATE public.procurement_requests SET status='${state}';`)
    const rule = pg.call(saveRule())
    expect(evaluate(rule)).toMatchObject({ status: 'covered' })
    expect(count('procurement_requests')).toBe('1')
    expect(count('procurement_replenishment_cases')).toBe('0')
  })

  test('uses current request revisions and ignores unrelated sites and rejected manual requests', () => {
    const request = pg.call(saveRequest())
    pg.db(`UPDATE public.procurement_requests SET revision=2,status='rejected' WHERE id='${request}';`)
    const rule = pg.call(saveRule())
    expect(evaluate(rule).status).toBe('draft_created')
  })

  test('outstanding real purchase-order items block without assigning a location', () => {
    const quote = pg.call(recordQuote()); openAward(pg)
    pg.call(approve(quote, 'award'), ids.owner, 'service_role')
    const award = pg.db('SELECT id FROM public.procurement_awards;')
    pg.call(approve(award, 'order'), ids.owner, 'service_role')
    const rule = pg.call(saveRule())
    expect(evaluate(rule)).toMatchObject({ status: 'covered', message: 'An outstanding purchase order has no location allocation' })
    expect(count('procurement_requests')).toBe('0')
    const order = pg.db('SELECT id FROM public.purchase_orders;')
    const item = pg.db('SELECT id FROM public.purchase_order_items;')
    const receipt = (quantity: number, key: number) => `SELECT public.record_procurement_receipt('${ids.site}',${sqlJson({
      order_id: order, note: 'Accepted without location assignment', idempotency_key: uuid(key), lines: [{ item_id: item, quantity }],
    })});`
    pg.call(receipt(1, 1300))
    expect(evaluate(rule).status).toBe('covered')
    pg.call(receipt(1, 1301))
    expect(evaluate(rule).status).toBe('draft_created')
  })

  test('serializes repeated concurrent evaluations and cross-location unallocated supply', async () => {
    const rule = pg.call(saveRule())
    const results = await Promise.all([1, 2, 3].map(() => pg.concurrent(actorSql(evaluateRule(rule)))))
    expect(results.map(result => JSON.parse(result).status).sort()).toEqual(['covered', 'covered', 'draft_created'])
    expect(count('procurement_requests')).toBe('1')
    expect(count('procurement_replenishment_cases')).toBe('1')
    pg.db(`INSERT INTO public.inventory_levels VALUES('${uuid(1204)}','${ids.site}','${itemId}','${secondLocationId}',1,now());`)
    const secondRule = pg.call(saveRule({ ...ruleDocument, location_id: secondLocationId }))
    expect(evaluate(secondRule).status).toBe('covered')
  })

  test('locks actual inventory row and observes the committed concurrent stock change', async () => {
    const rule = pg.call(saveRule())
    const change = pg.concurrent(`BEGIN; UPDATE public.inventory_levels SET quantity=20 WHERE id='${inventoryId}'; SELECT pg_sleep(0.3); COMMIT;`)
    await new Promise(resolve => setTimeout(resolve, 100))
    const evaluation = pg.concurrent(actorSql(evaluateRule(rule)))
    await change
    expect(JSON.parse(await evaluation)).toMatchObject({ status: 'above_minimum', on_hand: 20 })
    expect(count('procurement_requests')).toBe('0')
  })

  test('waits for a concurrent manual requisition commit before scanning unallocated supply', async () => {
    const rule = pg.call(saveRule())
    const manual = pg.concurrent(actorSql(`BEGIN; ${saveRequest()} SELECT pg_sleep(0.3); COMMIT;`))
    await new Promise(resolve => setTimeout(resolve, 100))
    const evaluation = pg.concurrent(actorSql(evaluateRule(rule)))
    await manual
    expect(JSON.parse(await evaluation).status).toBe('covered')
    expect(count('procurement_requests')).toBe('1')
    expect(count('procurement_replenishment_cases')).toBe('0')
  })
})
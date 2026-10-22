/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'
import { openSql, payment, registerIds } from '../pos/register-postgres-fixture'
import { claimId, installSelfServiceFixture, marked, modifierId, orderId, parentId, productId, selfServiceMigrations } from './self-service-postgres-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('self-service payment guards and atomic release in disposable PostgreSQL 17', () => {
  const pg = isolatedPostgres()
  const service = (sql: string) => actorSql(sql, ids.owner, 'service_role')
  const release = `SELECT public.release_self_service_order('${ids.site}','${orderId}')`
  const stock = () => pg.db('SELECT quantity FROM public.inventory_levels')
  const statuses = () => pg.db('SELECT status FROM public.sale_order_items ORDER BY id')
  const pay = () => pg.db(`UPDATE public.sales SET status='completed',amount_due=0 WHERE id='${registerIds.sale}'`)
  const unit = () => pg.db(`SELECT id FROM public.sale_order_item_units WHERE sale_order_item_id='${parentId}' LIMIT 1`)
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installSelfServiceFixture(pg.db))

  it('guards direct line, unit, order updates and the actual authenticated unit RPC while unpaid', () => {
    // Defense in depth even if a legacy installation still exposes unit UPDATE.
    pg.db('CREATE POLICY test_legacy_unit_update ON public.sale_order_item_units FOR UPDATE TO authenticated USING(true) WITH CHECK(true)')
    for (const sql of [
      `UPDATE public.sale_order_items SET status='new' WHERE id='${parentId}'`,
      `UPDATE public.sale_order_item_units SET status='preparing' WHERE id='${unit()}'`,
      `UPDATE public.sale_orders SET status='completed' WHERE id='${orderId}'`,
      `SELECT public.mutate_sale_order_item_units('${ids.site}',ARRAY['${unit()}'::uuid],'set_status',NULL,'preparing')`,
    ]) expect(() => pg.call(sql)).toThrow('requires full payment')
    expect(() => pg.db(service(release))).toThrow('requires full payment')
    expect(stock()).toBe('20')
    expect(statuses()).toBe('draft\ndraft')
  })

  it('retains cancellation without letting marker removal, reassignment or sent_at bypass payment', () => {
    expect(() => pg.call(`UPDATE public.sale_orders SET items='[]' WHERE id='${orderId}'`)).toThrow('immutable')
    expect(() => pg.call(`UPDATE public.sale_order_items SET metadata='{}' WHERE id='${parentId}'`)).toThrow('immutable')
    expect(() => pg.call(`UPDATE public.sale_order_items SET sent_at=now() WHERE id='${parentId}'`)).toThrow('requires full payment')
    expect(() => pg.call(`UPDATE public.sale_order_items SET sale_order_id=NULL WHERE id='${parentId}'`)).toThrow('immutable')
    pg.call(`SELECT public.mutate_sale_order_item_units('${ids.site}',ARRAY['${unit()}'::uuid],'cancel')`)
    pg.call(`UPDATE public.sale_orders SET status='cancelled' WHERE id='${orderId}'`)
    expect(statuses()).toBe('cancelled\ncancelled')
  })

  it('releases parents and modifiers exactly once across concurrent retries without completing the order', async () => {
    pay()
    await Promise.all([pg.concurrent(service(release)), pg.concurrent(service(release))])
    expect(stock()).toBe('15')
    expect(statuses()).toBe('new\nnew')
    expect(pg.db(`SELECT status FROM public.sale_orders WHERE id='${orderId}'`)).toBe('pending')
    expect(pg.db('SELECT sum(quantity) FROM public.self_service_inventory_releases')).toBe('5')
    pg.db(service(release))
    expect(stock()).toBe('15')
  })

  it('rolls back all releases and inventory on a later modifier failure, then retries safely', () => {
    pay()
    pg.db(`CREATE FUNCTION public.fail_modifier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.id='${modifierId}' AND NEW.status='new' THEN RAISE EXCEPTION 'synthetic release failure'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER zz_fail_modifier AFTER UPDATE ON public.sale_order_items FOR EACH ROW EXECUTE FUNCTION public.fail_modifier();`)
    expect(() => pg.db(service(release))).toThrow('synthetic release failure')
    expect(stock()).toBe('20')
    expect(statuses()).toBe('draft\ndraft')
    expect(pg.db('SELECT count(*) FROM public.self_service_inventory_releases')).toBe('0')
    pg.db('DROP TRIGGER zz_fail_modifier ON public.sale_order_items')
    pg.db(service(release))
    expect(stock()).toBe('15')
  })

  it('accounts for direct paid quantity increases, preserves ledger and rejects stale refunded retries', () => {
    pay(); pg.db(service(release))
    pg.call(`UPDATE public.sale_order_items SET quantity=4 WHERE id='${modifierId}'`)
    expect(stock()).toBe('14')
    pg.call(`UPDATE public.sale_order_items SET quantity=4 WHERE id='${modifierId}'`)
    expect(stock()).toBe('14')
    pg.db(`UPDATE public.sales SET status='refunded' WHERE id='${registerIds.sale}'`)
    expect(() => pg.db(service(release))).toThrow('requires full payment')
    expect(() => pg.call(`UPDATE public.sale_order_items SET quantity=5 WHERE id='${modifierId}'`)).toThrow('requires full payment')
  })

  it('enforces service-only release, matching tenant and protected inventory ledger', () => {
    pay()
    for (const role of ['anon','authenticated']) expect(() => pg.db(actorSql(release,ids.owner,role))).toThrow('permission denied')
    expect(() => pg.db(service(release.replace(ids.site,ids.otherSite)))).toThrow('Active self-service order required')
    expect(() => pg.db(service('DELETE FROM public.self_service_inventory_releases'))).toThrow('permission denied')
    expect(() => pg.call(`SELECT public.mutate_sale_order_item_units('${ids.site}',ARRAY['${unit()}'::uuid],'set_status',NULL,'preparing')`,ids.foreign)).toThrow('Insufficient permissions')
  })

  it('waits for the current payment row and rejects a refund committed before release', async () => {
    pay()
    const refund = pg.concurrent(`BEGIN; UPDATE public.sales SET status='refunded' WHERE id='${registerIds.sale}';
      SET application_name='self-service-refund'; SELECT pg_sleep(0.7); COMMIT;`)
    const deadline = Date.now() + 3000
    while (pg.db("SELECT count(*) FROM pg_stat_activity WHERE application_name='self-service-refund' AND wait_event='PgSleep'") !== '1') {
      if (Date.now() > deadline) throw new Error('Refund did not acquire its lock')
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    await expect(pg.concurrent(service(release))).rejects.toThrow('requires full payment')
    await refund
    expect(stock()).toBe('20')
    expect(statuses()).toBe('draft\ndraft')
  })

  it('serializes different paid orders sharing a SKU without lost inventory', async () => {
    pay()
    const second = uuid(300)
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}","role":"service_role"}';
      INSERT INTO public.sale_orders(id,site_id,sale_id,origin_location_id,items)
        VALUES('${second}','${ids.site}','${registerIds.sale}','${registerIds.location}','${marked}');
      INSERT INTO public.sale_order_items(id,site_id,sale_order_id,catalog_item_id,quantity)
        VALUES('${uuid(301)}','${ids.site}','${second}','${productId}',4);`)
    await Promise.all([pg.concurrent(service(release)), pg.concurrent(service(release.replace(orderId,second)))])
    expect(stock()).toBe('11')
  })

  it('shares the effect with verified Stripe and never deducts cash-released lines twice', () => {
    pay(); pg.db(service(release))
    pg.db(`UPDATE public.sales SET stripe_checkout_session_id='cs_local' WHERE id='${registerIds.sale}';
      INSERT INTO public.stripe_sale_checkout_effects VALUES('cs_local','${registerIds.sale}','${orderId}','processing','${claimId}',NULL,NULL);`)
    const stripe = `SELECT public.apply_stripe_sale_inventory_effect('${registerIds.sale}','${orderId}','cs_local','${claimId}')`
    expect(() => pg.db(service(stripe.replace(claimId,uuid(999))))).toThrow('not owned')
    expect(JSON.parse(pg.db(service(stripe))).status).toBe('completed')
    expect(JSON.parse(pg.db(service(stripe))).status).toBe('already_completed')
    expect(stock()).toBe('15')
    pg.db(`UPDATE public.sales SET amount_due=1 WHERE id='${registerIds.sale}'`)
    expect(() => pg.db(service(stripe))).toThrow('requires full payment')
  })

  it('releases previously draft parents and modifiers inside the Stripe effect transaction', () => {
    pay()
    pg.db(`UPDATE public.sales SET stripe_checkout_session_id='cs_draft' WHERE id='${registerIds.sale}';
      INSERT INTO public.stripe_sale_checkout_effects VALUES('cs_draft','${registerIds.sale}','${orderId}','processing','${claimId}',NULL,NULL);`)
    const stripe = `SELECT public.apply_stripe_sale_inventory_effect('${registerIds.sale}','${orderId}','cs_draft','${claimId}')`
    pg.db(service(stripe))
    expect(stock()).toBe('15')
    expect(statuses()).toBe('new\nnew')
    pg.db(service(stripe))
    expect(stock()).toBe('15')
    expect(pg.db('SELECT inventory_completed_at IS NOT NULL FROM public.stripe_sale_checkout_effects')).toBe('t')
  })

  it('does not release draft work merely because Stripe sets an order in_progress', () => {
    pay()
    pg.db(`UPDATE public.sale_orders SET status='in_progress' WHERE id='${orderId}'`)
    expect(statuses()).toBe('draft\ndraft')
    pg.db(service(release))
    expect(statuses()).toBe('new\nnew')
  })

  it('prevents paid direct unit advancement before the parent inventory release', () => {
    pay()
    expect(() => pg.call(`SELECT public.mutate_sale_order_item_units('${ids.site}',ARRAY['${unit()}'::uuid],'set_status',NULL,'preparing')`))
      .toThrow('must be released')
    pg.db(service(release))
    pg.call(`SELECT public.mutate_sale_order_item_units('${ids.site}',ARRAY['${unit()}'::uuid],'set_status',NULL,'preparing')`)
    expect(stock()).toBe('15')
  })

  it('supports never-decrement policy without replaying later policy changes', () => {
    pay(); pg.db(`UPDATE public.settings SET commerce='{"decrement_stock_on":"never"}'`)
    pg.db(service(release)); expect(stock()).toBe('20')
    pg.db(`UPDATE public.settings SET commerce='{}'`)
    pg.db(service(release)); expect(stock()).toBe('20')
  })

  it('allows admitted Shop cash only for an already marked order and preserves authorization', () => {
    pg.call(openSql())
    pg.db(service(`SELECT public.pos_checkout_claim('${ids.site}','cash','${ids.owner}','${orderId}','fingerprint','${claimId}');
      SELECT public.pos_checkout_transition('${ids.site}','cash','${claimId}','writes_started',NULL,NULL,NULL);`))
    const expectedOrder = pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${orderId}'`)
    const commit = (source: string) => `SELECT public.pos_checkout_commit_order('${ids.site}','cash','${claimId}','${orderId}',
      '${JSON.stringify({ source, amount:100, amount_due:0, status:'completed', payments:[payment({ amount:100,tendered:100,change:0 })] })}',
      '{"status":"pending"}','{"amount":100,"amount_due":100,"payments":[]}','${expectedOrder}')`
    expect(() => pg.db(service(commit('pos')))).toThrow('Invalid checkout financial state')
    expect(() => pg.db(service(commit('retail')))).toThrow('Invalid checkout financial state')
    expect(() => pg.db(service(commit('shop').replace(`'${claimId}'`,`'${uuid(999)}'`)))).toThrow('admission mismatch')
    const result = JSON.parse(pg.db(service(commit('shop'))))
    expect(result.sale).toMatchObject({source:'shop',status:'completed',amount_due:0})
    expect(result.order.status).toBe('pending')
    expect(pg.db('SELECT count(*) FROM public.pos_register_receipts')).toBe('1')
    pg.db(service(release)); expect(stock()).toBe('15')
  })

  it('reapplies the forward migrations without repeating inventory', () => {
    pay(); pg.db(service(release))
    for (const file of selfServiceMigrations) pg.db(migration(file))
    pg.db(service(release)); expect(stock()).toBe('15')
  })

  it('denies retaining Shop source for an unmarked order and retains existing normal POS behavior', () => {
    const normal = uuid(400)
    pg.db(`INSERT INTO public.sale_orders(id,site_id,sale_id,origin_location_id)
      VALUES('${normal}','${ids.site}','${registerIds.secondSale}','${registerIds.location}');
      UPDATE public.sales SET source='shop' WHERE id='${registerIds.secondSale}';`)
    expect(() => pg.call(`UPDATE public.sale_orders SET items='${marked}' WHERE id='${normal}'`)).toThrow('cannot acquire')
    pg.db(service(`SELECT public.pos_checkout_claim('${ids.site}','normal','${ids.owner}','${normal}','fingerprint','${claimId}');
      SELECT public.pos_checkout_transition('${ids.site}','normal','${claimId}','writes_started',NULL,NULL,NULL);`))
    const expectedOrder = pg.db(`SELECT to_jsonb(o) FROM public.sale_orders o WHERE id='${normal}'`)
    const expectedSale = pg.db(`SELECT jsonb_build_object('amount',amount,'amount_due',amount_due,'payments',payments)
      FROM public.sales WHERE id='${registerIds.secondSale}'`)
    const commit = `SELECT public.pos_checkout_commit_order('${ids.site}','normal','${claimId}','${normal}',
      '{"source":"shop"}','{}','${expectedSale}','${expectedOrder}')`
    expect(() => pg.db(service(commit))).toThrow('Invalid checkout financial state')
    expect(JSON.parse(pg.db(service(commit.replace('"source":"shop"','"source":"pos"')))).sale.source).toBe('pos')
  })
})
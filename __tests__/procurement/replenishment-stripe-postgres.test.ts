/** @jest-environment node */
import { processReplenishmentQueue } from '@/app/api/procurement/replenishment/process/core'
import { isolatedPostgres, postgresAvailable } from './storage-fixture'
import { installReplenishmentFixture, installReplenishmentQueue, saveRule } from './replenishment-fixture'
import { holdGate, installStripeReplenishmentFixture, pauseAcknowledgment, serviceSql, stripeEffectSql, waitFor } from './replenishment-stripe-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('replenishment against real Stripe inventory effects in isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => { installReplenishmentFixture(pg); installReplenishmentQueue(pg) })
  const service = { rpc: async () => ({ error: null,
    data: JSON.parse(await pg.concurrent(serviceSql('SELECT public.process_procurement_replenishment(1);'))),
  }) }

  test.each([false, true])('separate worker transactions cannot deadlock reverse multi-SKU Stripe writes (reverse=%s)', async reverse => {
    const { firstRule, stripeOrder } = installStripeReplenishmentFixture(pg, reverse)
    pauseAcknowledgment(pg, firstRule)
    const release = await holdGate(pg)
    const worker = processReplenishmentQueue(service)
    let stripe: Promise<string> | undefined
    try {
      await waitFor(pg, "EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='replenishment-worker' AND wait_event_type='Lock')")
      stripe = pg.concurrent(serviceSql(stripeEffectSql, 'replenishment-stripe'))
      // Stripe has changed the other SKU and now waits for the worker's first
      // stock row. An unsafe batch then waits on Stripe and creates the cycle.
      await waitFor(pg, "EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='replenishment-stripe' AND wait_event_type='Lock')")
    } finally { await release() }
    expect(await worker).toMatchObject({ failed: 0, busy: false })
    expect(JSON.parse(await stripe!)).toEqual({ status: 'completed' })
    expect(pg.db('SELECT item FROM public.stripe_inventory_trace ORDER BY sequence;').split('\n')).toEqual(stripeOrder)
    expect(pg.db('SELECT quantity FROM public.inventory_levels ORDER BY catalog_item_id;').split('\n')).toEqual(['1.5', '1'])
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('2')
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_queue WHERE generation>evaluated_generation;')).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_queue WHERE last_error IS NOT NULL;')).toBe('0')
    expect(pg.db('SELECT inventory_completed_at IS NOT NULL FROM public.stripe_sale_checkout_effects;')).toBe('t')
    expect(JSON.parse(await pg.concurrent(serviceSql(stripeEffectSql)))).toEqual({ status: 'already_completed' })
    expect(pg.db('SELECT count(*) FROM pg_locks WHERE locktype=\'advisory\';')).toBe('0')
  })

  test('a disconnected worker loses only its uncommitted claim, not its durable generation', async () => {
    const rule = pg.call(saveRule())
    pauseAcknowledgment(pg, rule)
    const release = await holdGate(pg)
    const interrupted = pg.concurrent(serviceSql('SELECT public.process_procurement_replenishment(1);'))
      .then(() => 'unexpected success', () => 'disconnected')
    try {
      await waitFor(pg, "EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='replenishment-worker' AND wait_event_type='Lock')")
      const busy = JSON.parse(await pg.concurrent(serviceSql('SELECT public.process_procurement_replenishment(1);', 'second-worker')))
      expect(busy).toEqual({ processed: 0, failed: 0, busy: true })
      pg.db("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='replenishment-worker';")
      expect(await interrupted).toBe('disconnected')
    } finally { await release() }
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    expect(pg.db('SELECT generation>evaluated_generation FROM public.procurement_replenishment_queue;')).toBe('t')
    expect(await processReplenishmentQueue(service)).toEqual({ processed: 1, failed: 0, busy: false })
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('1')
    expect(pg.db('SELECT count(*) FROM pg_locks WHERE locktype=\'advisory\';')).toBe('0')
  })
})
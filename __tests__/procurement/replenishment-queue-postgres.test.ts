/** @jest-environment node */
import { actorSql, ids, isolatedPostgres, postgresAvailable } from './storage-fixture'
import { installReplenishmentFixture, installReplenishmentQueue, ruleDocument, saveRule, seedReplenishmentRules } from './replenishment-fixture'
import { holdGate, waitFor } from './replenishment-stripe-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('durable replenishment worker in real isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => { installReplenishmentFixture(pg); installReplenishmentQueue(pg) })
  const processSql = 'SELECT public.process_procurement_replenishment(1);'
  const processQueue = () => JSON.parse(pg.call(processSql, ids.owner, 'service_role'))
  const pending = () => pg.db('SELECT count(*) FROM public.procurement_replenishment_queue WHERE generation>evaluated_generation;')

  test('save and inventory changes enqueue only; a real service worker creates the draft once', () => {
    pg.call(saveRule())
    expect(pending()).toBe('1')
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    expect(processQueue()).toEqual({ processed: 1, failed: 0, busy: false })
    expect(processQueue()).toEqual({ processed: 0, failed: 0, busy: false })
    pg.db('UPDATE public.inventory_levels SET quantity=1;')
    expect(pending()).toBe('1')
    processQueue()
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('1')
    expect(pg.db("SELECT last_result->>'status' FROM public.procurement_replenishment_queue;")).toBe('covered')
    expect(pending()).toBe('0')
  })

  test('anonymous and managers cannot invoke privileged worker or forge queued jobs', () => {
    pg.call(saveRule())
    for (const role of ['anon', 'authenticated']) {
      expect(() => pg.call(processSql, ids.owner, role)).toThrow(/permission denied/)
    }
    expect(() => pg.call('DELETE FROM public.procurement_replenishment_queue;')).toThrow(/permission denied/)
    expect(pg.call('SELECT count(*) FROM public.procurement_replenishment_queue;', ids.foreign)).toBe('0')
    for (const limit of ['NULL', '0', '2', '25', '101']) {
      expect(() => pg.call(`SELECT public.process_procurement_replenishment(${limit});`, ids.owner, 'service_role')).toThrow(/limit must be 1/)
    }
  })

  test('default and explicit calls process one generation only even with multiple pending rules', () => {
    seedReplenishmentRules(pg, 3)
    expect(JSON.parse(pg.call('SELECT public.process_procurement_replenishment();', ids.owner, 'service_role')))
      .toEqual({ processed: 1, failed: 0, busy: false })
    expect(pending()).toBe('2')
    expect(processQueue()).toEqual({ processed: 1, failed: 0, busy: false })
    expect(pending()).toBe('1')
    expect(processQueue()).toEqual({ processed: 1, failed: 0, busy: false })
    expect(processQueue()).toEqual({ processed: 0, failed: 0, busy: false })
  })

  test.each(['active=false', 'licensed=false', 'restricted=true', "role='member'"])(
    'revalidates latest saver permissions and persists bounded failures with no request: %s', revoked => {
    const rule = pg.call(saveRule(), ids.admin)
    pg.db(`UPDATE public.fixture_members SET ${revoked} WHERE user_id='${ids.admin}';`)
    expect(processQueue()).toEqual({ processed: 0, failed: 1, busy: false })
    expect(pg.db('SELECT last_error FROM public.procurement_replenishment_queue;')).toBe('Rule manager is no longer authorized')
    expect(processQueue().processed).toBe(0)
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    pg.call(saveRule(ruleDocument, rule, 1))
    expect(processQueue()).toMatchObject({ processed: 1, failed: 0 })
    expect(pg.db('SELECT requester_id FROM public.procurement_requests;')).toBe(ids.owner)
  })

  test('catalog failures roll back partial work and require a fresh event for retry', () => {
    pg.call(saveRule())
    pg.db('UPDATE public.catalog_items SET cost=NULL;')
    expect(processQueue().failed).toBe(1)
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_cases;')).toBe('0')
    expect(pending()).toBe('0')
    pg.db('UPDATE public.catalog_items SET cost=12.34; UPDATE public.inventory_levels SET quantity=1;')
    expect(processQueue().processed).toBe(1)
  })

  test('a failure after draft insertion rolls back the draft, restores claims and consumes only that generation', () => {
    pg.call(saveRule())
    pg.db(`CREATE FUNCTION public.reject_replenishment_case() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Private downstream failure'; END $$;
      CREATE TRIGGER reject_replenishment_case BEFORE INSERT ON public.procurement_replenishment_cases
        FOR EACH ROW EXECUTE FUNCTION public.reject_replenishment_case();`)
    expect(pg.call(`BEGIN; ${processSql} SELECT auth.uid(); COMMIT;`, ids.foreign, 'service_role'))
      .toContain(ids.foreign)
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.procurement_request_items;')).toBe('0')
    expect(pg.db('SELECT last_error FROM public.procurement_replenishment_queue;')).not.toContain('Private downstream failure')
    expect(pending()).toBe('0')
    pg.db(`DROP TRIGGER reject_replenishment_case ON public.procurement_replenishment_cases;
      UPDATE public.inventory_levels SET quantity=1;`)
    expect(processQueue()).toEqual({ processed: 1, failed: 0, busy: false })
  })

  test('stock above target resets the cycle, while delete queues a blocked missing row', () => {
    pg.call(saveRule({ ...ruleDocument, action: 'alert' }))
    processQueue()
    pg.db('UPDATE public.inventory_levels SET quantity=20;')
    processQueue()
    expect(pg.db("SELECT count(*) FROM public.procurement_replenishment_cases WHERE status='open';")).toBe('0')
    pg.db('UPDATE public.inventory_levels SET quantity=1;')
    processQueue()
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_cases;')).toBe('2')
    pg.db('DELETE FROM public.inventory_levels;')
    processQueue()
    expect(pg.db("SELECT last_result->>'status' FROM public.procurement_replenishment_queue;")).toBe('blocked')
  })

  test('concurrent workers do not duplicate drafts and restore the original caller claims', async () => {
    pg.call(saveRule())
    const results = await Promise.all([1, 2].map(() => pg.concurrent(actorSql(processSql, ids.owner, 'service_role'))))
    expect(results.map(result => JSON.parse(result).processed).reduce((sum, value) => sum + value, 0)).toBe(1)
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('1')
    expect(pg.call(`BEGIN; ${processSql} SELECT auth.uid(); COMMIT;`, ids.foreign, 'service_role')).toContain(ids.foreign)
  })

  test('inventory writers can enqueue while worker waits for their stock lock without deadlocking or losing a generation', async () => {
    pg.call(saveRule())
    const release = await holdGate(pg)
    const writer = pg.concurrent(`SET application_name='generation-writer'; BEGIN;
      UPDATE public.inventory_levels SET quantity=20; SELECT pg_advisory_xact_lock(91001); COMMIT;`)
    let worker: Promise<string> | undefined
    try {
      await waitFor(pg, "EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='generation-writer' AND wait_event_type='Lock')")
      worker = pg.concurrent(actorSql(`SET application_name='generation-worker'; ${processSql}`, ids.owner, 'service_role'))
      await waitFor(pg, "EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='generation-worker' AND wait_event_type='Lock')")
    } finally { await release() }
    await writer
    expect(JSON.parse(await worker!)).toMatchObject({ processed: 1, failed: 0 })
    // The worker observed the earlier generation and cannot swallow the write.
    expect(pending()).toBe('1')
    expect(processQueue().processed).toBe(1)
    expect(pending()).toBe('0')
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
  })

  test('rolling back an acknowledged job releases its transaction claim and leaves durable work pending', () => {
    pg.call(saveRule())
    expect(pg.call(`BEGIN; ${processSql} ROLLBACK;`, ids.owner, 'service_role')).toContain('"processed": 1')
    expect(pending()).toBe('1')
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    expect(processQueue()).toEqual({ processed: 1, failed: 0, busy: false })
    expect(pg.db('SELECT count(*) FROM pg_locks WHERE locktype=\'advisory\';')).toBe('0')
  })
})
/** @jest-environment node */
import { cookies } from 'next/headers'
import { POST } from '@/app/api/procurement/replenishment/process/route'
import { createServiceClient } from '@/lib/supabase/server'
import { isolatedPostgres, postgresAvailable } from './storage-fixture'
import { installReplenishmentFixture, installReplenishmentQueue, saveRule, seedReplenishmentRules } from './replenishment-fixture'
import { waitFor } from './replenishment-stripe-fixture'

jest.mock('server-only', () => ({}))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/demo-data/mock-client', () => ({ createDemoMockClient: jest.fn() }))
jest.mock('@/lib/permissions/mutation-guard', () => ({ wrapSupabaseClient: jest.fn() }))

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('cookie-free worker route through actual Supabase service guard and isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  const originalEnv = { ...process.env }
  const secret = 'local-worker-test-secret-not-deployed'.repeat(2)
  let transport: jest.Mock
  beforeAll(() => pg.start())
  afterAll(() => { pg.stop(); process.env = originalEnv })
  beforeEach(() => {
    installReplenishmentFixture(pg)
    installReplenishmentQueue(pg)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://replenishment-db.invalid'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-test-key-not-deployed'
    process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET = secret
    jest.mocked(cookies).mockClear().mockRejectedValue(new Error('No request cookie context'))
    // Only the HTTP transport is replaced. Real createServiceClient, Supabase RPC
    // serialization and locationGuardedServiceFetch run; each SQL call commits on
    // its own socket connection with service_role and NO user subject claim.
    transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://replenishment-db.invalid/rest/v1/rpc/process_procurement_replenishment')
      expect(JSON.parse(String(init?.body))).toEqual({ p_limit: 1 })
      const data = await pg.concurrent(`SET ROLE service_role;
        SET request.jwt.claims='{"role":"service_role"}'; SELECT public.process_procurement_replenishment(1);`)
      return Response.json(JSON.parse(data))
    })
    global.fetch = transport
  })
  const request = (extra: RequestInit = {}, query = '') => new Request(`http://worker.invalid/process${query}`, {
    method: 'POST', headers: { authorization: `Bearer ${secret}` }, ...extra,
  })

  test('the actual default workspace guard fails cookie-free while the authorized route succeeds', async () => {
    const defaultService = await createServiceClient(true)
    expect((await defaultService.rpc('process_procurement_replenishment', { p_limit: 1 })).error?.code).toBe('42501')
    expect(cookies).toHaveBeenCalledTimes(1)
    expect(transport).not.toHaveBeenCalled()
    jest.mocked(cookies).mockClear()
    pg.call(saveRule())
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ processed: 1, failed: 0, busy: false })
    expect(cookies).not.toHaveBeenCalled()
    expect(transport).toHaveBeenCalledTimes(2)
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('1')
  })

  test('an empty queue performs one read and creates nothing', async () => {
    expect(await (await POST(request())).json()).toEqual({ processed: 0, failed: 0, busy: false })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(pg.db('SELECT count(*) FROM public.procurement_requests;')).toBe('0')
    expect(cookies).not.toHaveBeenCalled()
  })

  test('more than 25 real jobs remain durable for the next invocation', async () => {
    seedReplenishmentRules(pg, 27)
    expect(await (await POST(request())).json()).toEqual({ processed: 25, failed: 0, busy: false })
    expect(transport).toHaveBeenCalledTimes(25)
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_queue WHERE generation>evaluated_generation;')).toBe('2')
    expect(await (await POST(request())).json()).toEqual({ processed: 2, failed: 0, busy: false })
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_cases;')).toBe('27')
  })

  test('multiple failed jobs are consumed without replay or head-of-line spinning', async () => {
    seedReplenishmentRules(pg, 3)
    pg.db('UPDATE public.sites SET archived_at=now();')
    expect(await (await POST(request())).json()).toEqual({ processed: 0, failed: 3, busy: false })
    expect(transport).toHaveBeenCalledTimes(4)
    expect(await (await POST(request())).json()).toEqual({ processed: 0, failed: 0, busy: false })
    expect(pg.db('SELECT count(*) FROM public.procurement_replenishment_cases;')).toBe('0')
  })

  test('a real busy worker ends this invocation after one RPC without claiming pending work', async () => {
    pg.call(saveRule())
    const blocker = pg.concurrent(`SET application_name='busy-worker'; BEGIN;
      SELECT pg_advisory_xact_lock(hashtextextended('procurement_replenishment_worker',0)); SELECT pg_sleep(15); COMMIT;`)
      .catch(() => '')
    try {
      await waitFor(pg, "EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='busy-worker' AND wait_event='PgSleep')")
      expect(await (await POST(request())).json()).toEqual({ processed: 0, failed: 0, busy: true })
      expect(transport).toHaveBeenCalledTimes(1)
      expect(pg.db('SELECT generation>evaluated_generation FROM public.procurement_replenishment_queue;')).toBe('t')
    } finally {
      pg.db("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='busy-worker';")
      await blocker
    }
    expect(await (await POST(request())).json()).toEqual({ processed: 1, failed: 0, busy: false })
  })

  test('no secret, wrong secret and caller-selected parameters never reach privileged transport', async () => {
    delete process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET
    expect((await POST(request())).status).toBe(503)
    process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET = 'short'
    expect((await POST(request())).status).toBe(503)
    process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET = secret
    expect((await POST(request({ headers: {} }))).status).toBe(401)
    expect((await POST(request({ headers: { authorization: `Bearer ${'x'.repeat(secret.length)}` } }))).status).toBe(401)
    expect((await POST(request({}, '?site_id=chosen'))).status).toBe(400)
    expect((await POST(request({ body: '{}' }))).status).toBe(400)
    expect(transport).not.toHaveBeenCalled()
    expect(cookies).not.toHaveBeenCalled()
  })

  test('storage errors are sanitized and not automatically retried', async () => {
    transport.mockResolvedValue(Response.json({ message: 'private diagnostics', code: 'XX000' }, { status: 500 }))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private diagnostics')
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
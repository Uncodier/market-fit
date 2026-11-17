import type { Dispatch, SetStateAction } from 'react'
import type { Site } from '@/app/context/site-types'
import { refreshSiteBillingRecord } from '@/app/context/site-refresh-billing'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const first = { id: '11111111-1111-4111-8111-111111111111', billing_read_status: 'unavailable',
  billing: { plan: 'commission', credits_available: 5 } } as Site
const second = { ...first, id: '22222222-2222-4222-8222-222222222222' }
const single = jest.fn()
const row = (balance: number) => ({ data: { plan: 'commission', credits_available: balance }, error: null })
function deferred() {
  let resolve!: (value: ReturnType<typeof row> | { data: null; error: { code: string } }) => void
  const promise = new Promise<Parameters<typeof resolve>[0]>(done => { resolve = done })
  return { promise, resolve }
}
function state(delayed = false) {
  let sites = [first, second]
  let current: Site | null = first
  const listQueue: Array<SetStateAction<Site[]>> = []
  const currentQueue: Array<SetStateAction<Site | null>> = []
  const setSites: Dispatch<SetStateAction<Site[]>> = update => {
    if (delayed) listQueue.push(update)
    else sites = typeof update === 'function' ? update(sites) : update
  }
  const setCurrentSite: Dispatch<SetStateAction<Site | null>> = update => {
    if (delayed) currentQueue.push(update)
    else current = typeof update === 'function' ? update(current) : update
  }
  return {
    sites: () => sites, current: () => current,
    manual: { setSites, setCurrentSite },
    // Automatic callers wrap setters; ordering must not depend on setter identity.
    automatic: { setSites: (update: SetStateAction<Site[]>) => setSites(update),
      setCurrentSite: (update: SetStateAction<Site | null>) => setCurrentSite(update) },
    flush(reverse = false) {
      for (const update of reverse ? listQueue.reverse() : listQueue) sites = typeof update === 'function' ? update(sites) : update
      for (const update of reverse ? currentQueue.reverse() : currentQueue) current = typeof update === 'function' ? update(current) : update
      listQueue.length = 0
      currentQueue.length = 0
    },
  }
}
beforeEach(() => {
  jest.clearAllMocks()
  single.mockReset()
  const query = { select: () => query, eq: () => query, abortSignal: () => query, single }
  jest.mocked(createClient).mockReturnValue({ from: () => query } as never)
})

it.each([false, true])('latest-started wins out-of-order automatic/manual completions (manual first %s)', async manualFirst => {
  const old = deferred(), latest = deferred()
  single.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const model = state()
  const oldRead = refreshSiteBillingRecord(first.id, manualFirst ? model.manual : model.automatic)
  const newRead = refreshSiteBillingRecord(first.id, manualFirst ? model.automatic : model.manual)
  latest.resolve(row(20))
  await newRead
  old.resolve(row(10))
  await oldRead
  expect(model.current()?.billing?.credits_available).toBe(20)
  expect(model.sites()[0].billing?.credits_available).toBe(20)
})

it('does not publish the old response even while the newer request is pending', async () => {
  const old = deferred(), latest = deferred()
  single.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const model = state()
  const oldRead = refreshSiteBillingRecord(first.id, model.automatic)
  const newRead = refreshSiteBillingRecord(first.id, model.manual)
  old.resolve(row(10))
  await oldRead
  expect(model.current()).toBe(first)
  expect(model.sites()[0]).toBe(first)
  latest.resolve(row(20))
  await newRead
  expect(model.current()?.billing?.credits_available).toBe(20)
})

it.each([false, true])('a newer failed read still invalidates old network/queued results (queued %s)', async queued => {
  const old = deferred(), latest = deferred()
  single.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const model = state(queued)
  const oldRead = refreshSiteBillingRecord(first.id, model.automatic)
  if (queued) { old.resolve(row(10)); await oldRead }
  const newRead = refreshSiteBillingRecord(first.id, model.manual)
  const rejected = expect(newRead).rejects.toThrow('could not be loaded')
  latest.resolve({ data: null, error: { code: '08006' } })
  await rejected
  if (!queued) { old.resolve(row(10)); await oldRead }
  model.flush()
  expect(model.current()).toBe(first)
  expect(model.sites()[0]).toBe(first)
})

it.each([false, true])('rechecks delayed React setters even after both requests settle (reverse %s)', async reverse => {
  const model = state(true)
  single.mockResolvedValueOnce(row(10)).mockResolvedValueOnce(row(20))
  await refreshSiteBillingRecord(first.id, model.automatic)
  await refreshSiteBillingRecord(first.id, model.manual)
  model.flush(reverse)
  expect(model.current()?.billing?.credits_available).toBe(20)
  expect(model.sites()[0].billing?.credits_available).toBe(20)
})

it('orders independently per site without invalidating another site delayed result', async () => {
  const model = state(true)
  single.mockResolvedValueOnce(row(10)).mockResolvedValueOnce(row(30))
  await refreshSiteBillingRecord(first.id, model.automatic)
  await refreshSiteBillingRecord(second.id, model.manual)
  model.flush(true)
  expect(model.current()?.id).toBe(first.id)
  expect(model.current()?.billing?.credits_available).toBe(10)
  expect(model.sites().map(site => site.billing?.credits_available)).toEqual([10, 30])
})

it('does not let delayed old balances overwrite a newer confirmed absence', async () => {
  const model = state(true)
  single.mockResolvedValueOnce(row(10)).mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'missing' }) } as Response)
  await refreshSiteBillingRecord(first.id, model.automatic)
  await refreshSiteBillingRecord(first.id, model.manual)
  model.flush(true)
  expect(model.current()?.billing).toBeUndefined()
  expect(model.current()?.billing_read_status).toBe('missing')
  expect(model.sites()[0].billing).toBeUndefined()
})
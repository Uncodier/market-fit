import { act, renderHook } from '@testing-library/react'
import { useRef, useState } from 'react'
import { SITE_HYDRATION_TIMEOUT_MS, useSiteLoadingLifecycle } from '@/app/context/site-loading-lifecycle'
import { applyCurrentSite, SITE_DETAIL_TIMEOUT_MS } from '@/app/context/site-set-current'
import { cacheSiteSelection, readSiteSelection } from '@/app/context/site-selection-cache'
import type { Site } from '@/app/context/site-types'
import { fetchAccessibleSitesClient } from '@/lib/sites/fetch-accessible-sites'

jest.mock('@/lib/sites/fetch-accessible-sites', () => ({ fetchAccessibleSitesClient: jest.fn() }))
jest.mock('@/app/context/site-refresh-billing', () => ({ refreshSiteBillingRecord: jest.fn() }))

const first: Site = {
  id: '10000000-0000-4000-8000-000000000001', user_id: 'owner', name: 'Saved', description: null, logo_url: null,
  resource_urls: null, url: null, created_at: '', updated_at: '',
}
const second = { ...first, id: '20000000-0000-4000-8000-000000000002', name: 'Other', logo_url: 'current', description: 'Ready' }
const response = (sites: Site[]) => ({ sites, error: null, unauthorized: false, aborted: false })
type Row = { data: Record<string, unknown> | null; error: { code: string } | null }
const settings: Row = { data: { site_id: first.id, about: 'Ready', currency: 'GBP', onboarding: { setup_billing: true } }, error: null }
const detail: Row = { data: { name: 'Updated', description: 'Read from site', logo_url: 'logo.svg',
  tracking: { enable_chat: true }, resource_urls: [], settings: { about: 'Never trust extra columns' },
  billing: { credits_available: 0 }, url: 'do not merge' }, error: null }
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

// The builder records the actual projection/filter/signal at dispatch. Settle
// even an aborted request by hand to exercise a transport that ignored abort.
function fixture() {
  const reads: Array<{ table: string; fields: string; column: string; id: string; signal?: AbortSignal } & ReturnType<typeof deferred<Row>>> = []
  const db = {
    auth: { getSession: jest.fn() },
    from(table: string) {
      const call = { table, fields: '', column: '', id: '', signal: undefined as AbortSignal | undefined, ...deferred<Row>() }
      const query = {
        select: (fields: string) => { call.fields = fields; return query },
        eq: (column: string, id: string) => { call.column = column; call.id = id; return query },
        abortSignal: (signal: AbortSignal) => { call.signal = signal; return query },
        single: () => { reads.push(call); return call.promise },
        maybeSingle: () => { reads.push(call); return call.promise },
      }
      return query
    },
  }
  const read = (table: string, id = first.id) => {
    const call = reads.find(r => r.table === table && r.id === id)
    if (!call) throw new Error(`No ${table} read for ${id}`)
    return call
  }
  return { db, reads, read }
}

function mount() {
  const f = fixture()
  const view = renderHook(() => {
    const [currentSite, setCurrentSite] = useState<Site | null>(null)
    const [sites, setSites] = useState<Site[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isInitialized, setIsInitialized] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const authUserIdRef = useRef('owner')
    const lifecycle = useSiteLoadingLifecycle({
      supabaseRef: useRef(f.db), isMounted: true, isInitialized, currentSite, setCurrentSite,
      setIsInitialized, setIsLoading, setError, setSites, authUserIdRef, unauthorizedRetryRef: useRef(0),
      setSitesLoaded: jest.fn(), setSitesLoadAttempted: jest.fn(), setHasValidSession: jest.fn(),
    })
    return { ...lifecycle, currentSite, sites, isLoading, isInitialized, error, setCurrentSite, setSites, authUserIdRef }
  })
  return { ...f, ...view }
}

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear(); sessionStorage.clear()
  localStorage.setItem('currentSiteId', first.id)
  cacheSiteSelection('owner', first)
  jest.mocked(fetchAccessibleSitesClient).mockReset().mockResolvedValue(response([first, second]))
})
afterEach(() => { jest.useRealTimers() })

it.each([true, false])('releases the gate on settings alone (cached=%s) and patches only unchanged fields on the selected row', async cached => {
  if (!cached) localStorage.removeItem('mf_site_selection_v1')
  const v = mount()
  let load!: Promise<void>
  await act(async () => { load = v.result.current.loadSites() })
  const row = v.read('settings'), optional = v.read('sites')
  expect(v.reads.map(({ table, fields, column, id }) => ({ table, fields, column, id }))).toEqual([
    { table: 'settings', fields: '*', column: 'site_id', id: first.id },
    { table: 'sites', fields: 'logo_url, tracking, resource_urls, description, name', column: 'id', id: first.id },
  ])
  expect(v.result.current.isLoading).toBe(true)
  await act(async () => { row.resolve(settings); await load }) // optional is still pending
  expect(v.result.current.currentSite?.settings).toMatchObject({ about: 'Ready', currency: 'GBP' })
  expect(v.result.current.currentSite?.onboardingProgress?.done).toBe(1)
  expect(v.result.current.currentSite?.settings).not.toHaveProperty('onboarding')
  expect(readSiteSelection('owner')).not.toHaveProperty('onboardingProgress')
  expect(v.result.current.isLoading).toBe(false)
  expect(optional.signal?.aborted).toBe(false)

  const edit = (s: Site): Site => s.id !== first.id ? s : { ...s, name: 'Newer name', url: 'newer.example',
    logo_url: 'newer.svg', settings: { ...s.settings, about: 'Newer settings' } as Site['settings'],
    billing: { credits_available: 42 } as Site['billing'], billing_read_status: 'loaded' }
  act(() => {
    v.result.current.setCurrentSite(s => s && edit(s))
    v.result.current.setSites(sites => sites.map(edit))
  })
  const before = v.result.current.currentSite!
  const other = v.result.current.sites[1]
  await act(async () => { optional.resolve(detail) })
  for (const s of [v.result.current.currentSite, v.result.current.sites[0]]) expect(s).toMatchObject({
    id: first.id, name: 'Newer name', logo_url: 'newer.svg', description: 'Read from site', url: 'newer.example',
    resource_urls: [], tracking: { enable_chat: true }, settings: { about: 'Newer settings' },
    billing: { credits_available: 42 }, billing_read_status: 'loaded',
  })
  expect(v.result.current.currentSite?.settings).toBe(before.settings)
  expect(v.result.current.currentSite?.billing).toBe(before.billing)
  expect(v.result.current.sites[1]).toBe(other)
  expect(v.result.current.error).toBeNull()
})

it('holds an already-resolved detail until settings pass, and publishes it before await applyCurrentSite returns', async () => {
  const f = fixture()
  let current: Site | null = null, list = [first]
  const value = (): Site | null => current
  const selection = applyCurrentSite({ site: first, currentSite: null, supabase: f.db, requireSettings: true,
    setCurrentSite: (v) => { current = typeof v === 'function' ? v(current) : v }, setSites: (fn) => { list = fn(list) } })
  f.read('sites').resolve(detail)
  await Promise.resolve()
  expect(value()?.name).toBe('Saved'); expect(list[0].name).toBe('Saved')
  f.read('settings').resolve(settings)
  await selection
  expect(value()).toMatchObject({ id: first.id, name: 'Updated', settings: { about: 'Ready' } })
  expect(list[0].description).toBe('Read from site')
})

it.each(['resolved', 'pending'])('never suppresses or supersedes a required settings error (detail %s)', async state => {
  const v = mount()
  await act(async () => { void v.result.current.loadSites() })
  const optional = v.read('sites')
  if (state === 'resolved') await act(async () => { optional.resolve(detail) })
  expect(v.result.current.isLoading).toBe(true)
  await act(async () => { v.read('settings').resolve({ data: null, error: { code: '42501' } }) })
  expect(optional.signal?.aborted).toBe(true)
  expect(v.result.current.error?.message).toContain('settings could not be loaded')
  expect(v.result.current.currentSite).toBeNull()
  if (state === 'pending') await act(async () => { optional.resolve(detail) })
  expect(v.result.current.currentSite).toBeNull()
  expect(v.result.current.sites.find(s => s.id === first.id)?.name).not.toBe('Updated')
})

it.each(['expired', 'rejected'])('does not fail, clear, or refetch valid settings when detail is %s', async outcome => {
  const v = mount()
  await act(async () => { void v.result.current.loadSites() })
  await act(async () => { v.read('settings').resolve(settings) })
  const before = v.result.current.currentSite
  const optional = v.read('sites')
  if (outcome === 'rejected') await act(async () => { optional.reject(new Error('Optional detail disconnected')) })
  else {
    await act(async () => { jest.advanceTimersByTime(SITE_DETAIL_TIMEOUT_MS) })
    expect(optional.signal?.aborted).toBe(true)
    await act(async () => { optional.resolve(detail) })
  }
  expect(v.result.current.currentSite).toBe(before)
  expect(v.result.current.isLoading).toBe(false); expect(v.result.current.error).toBeNull()
  expect(v.reads).toHaveLength(2)
})

it.each(['account', 'selection', 'unmount', 'settings deadline'])('retires settings and detail transports on %s without waiting for SDK settlement', async reason => {
  const v = mount()
  let load!: Promise<void>
  await act(async () => { load = v.result.current.loadSites() })
  const row = v.read('settings'), optional = v.read('sites')
  expect(row.signal?.aborted).toBe(false); expect(optional.signal?.aborted).toBe(false)
  await act(async () => {
    if (reason === 'account') {
      v.result.current.invalidate(); v.result.current.authUserIdRef.current = 'new-actor'
      v.result.current.setCurrentSite(null); v.result.current.setSites([])
    } else if (reason === 'selection') {
      const switching = v.result.current.selectSite(second)
      v.read('settings', second.id).resolve({ data: { about: 'Other settings' }, error: null })
      await switching
    }
    else if (reason === 'unmount') v.unmount()
    else jest.advanceTimersByTime(SITE_HYDRATION_TIMEOUT_MS)
    await load
  })
  expect(row.signal?.aborted).toBe(true); expect(optional.signal?.aborted).toBe(true)
  await act(async () => { row.resolve(settings); optional.resolve(detail) })
  if (reason === 'settings deadline') {
    expect(v.result.current.error?.message).toContain('timed out')
    expect(v.result.current.currentSite).toBeNull()
  } else if (reason === 'selection') {
    expect(v.result.current.currentSite).toMatchObject({ id: second.id, settings: { about: 'Other settings' } })
  } else if (reason === 'account') {
    expect(v.result.current.currentSite).toBeNull(); expect(v.result.current.sites).toEqual([])
  }
})

it.each(['manual', 'cold'])('keeps failed %s settings non-operational and retries the same target without stale defaults', async origin => {
  localStorage.removeItem('mf_site_selection_v1')
  const v = mount()
  let pending!: Promise<void>
  await act(async () => { pending = origin === 'manual' ? v.result.current.selectSite(first) : v.result.current.loadSites() })
  expect(v.result.current.isLoading).toBe(true)
  await act(async () => { v.read('settings').resolve({ data: null, error: { code: 'NETWORK' } }); await pending })
  expect(v.result.current.currentSite).toBeNull()
  expect(v.result.current.error?.message).toMatch(/settings/i)
  expect(v.result.current.requestScope).toEqual({ siteId: first.id, actorId: 'owner' })
  if (origin === 'cold') expect(v.result.current.sites.map(s => s.id)).toContain(second.id)
  await act(async () => { pending = v.result.current.loadSites(true) })
  const reads = v.reads.filter(r => r.table === 'settings' && r.id === first.id)
  expect(reads).toHaveLength(2)
  await act(async () => { reads[1].resolve(settings); await pending })
  expect(v.result.current.currentSite).toMatchObject({ id: first.id, settings_read_status: 'loaded', settings: { currency: 'GBP' } })
  expect(v.result.current.error).toBeNull()
})

it('distinguishes a confirmed missing row from an ambiguous or failed read', async () => {
  const v = mount()
  let pending!: Promise<void>
  await act(async () => { pending = v.result.current.selectSite(first) })
  await act(async () => { v.read('settings').resolve({ data: null, error: { code: 'PGRST116' } }); await pending })
  expect(v.result.current.currentSite).toBeNull()
  await act(async () => { pending = v.result.current.selectSite(first) })
  await act(async () => { v.reads.filter(r => r.table === 'settings')[1].resolve({ data: null, error: null }); await pending })
  expect(v.result.current.currentSite).toMatchObject({ id: first.id, settings_read_status: 'missing' })
  expect(v.result.current.currentSite?.settings).toBeUndefined()
  expect(v.result.current.error).toBeNull()
})

it.each(['401', '403', 'removed'])('retires both pending reads on authoritative %s while publishing the correct site list', async reason => {
  const list = deferred<Awaited<ReturnType<typeof fetchAccessibleSitesClient>>>()
  jest.mocked(fetchAccessibleSitesClient).mockReturnValue(list.promise)
  const v = mount()
  let pending!: Promise<void>
  await act(async () => { pending = v.result.current.loadSites() })
  const row = v.read('settings'), optional = v.read('sites')
  await act(async () => { list.resolve(reason === 'removed' ? response([second]) : {
    ...response([]), forbidden: reason === '403', unauthorized: reason === '401',
  }) })
  if (reason === '401') await act(async () => { await jest.advanceTimersByTimeAsync(800) })
  expect(row.signal?.aborted).toBe(true); expect(optional.signal?.aborted).toBe(true)
  await act(async () => { await pending; await jest.advanceTimersByTimeAsync(SITE_HYDRATION_TIMEOUT_MS + 1) })
  await act(async () => { row.resolve(settings); optional.resolve(detail) })
  expect(v.result.current.currentSite).toBeNull(); expect(v.result.current.requestScope).toBeNull()
  expect(v.result.current.sites.map(s => s.id)).toEqual(reason === 'removed' ? [second.id] : [])
  expect(v.result.current.isLoading).toBe(false); expect(readSiteSelection('owner')).toBeNull()
  if (reason !== 'removed') expect(v.result.current.error).not.toBeNull()
  else {
    expect(v.result.current.error).toBeNull()
    expect(v.result.current.isInitialized).toBe(true)
  }
})
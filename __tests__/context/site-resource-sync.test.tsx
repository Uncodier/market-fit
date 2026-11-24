import { act, renderHook, waitFor } from "@testing-library/react"
import { useState } from "react"
import { notifySiteResourcesUpdated, useSiteResourceSync } from "@/app/context/site-resource-sync"
import type { Site } from "@/app/context/site-types"
import { applyCurrentSite } from '@/app/context/site-set-current'

const mockRead = jest.fn()
const mockRemove = jest.fn()
let mockRealtime: () => void
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mockRead }) }) }) }),
  channel: () => ({ on: (_event: unknown, _options: unknown, callback: () => void) => {
    mockRealtime = callback
    return { subscribe: () => ({ id: "subscription" }) }
  } }), removeChannel: mockRemove,
}) }))

const site = { id: "site-1", name: "Workspace", billing: { plan: "engine", addons_count: 2 },
  settings: { currency: "USD", channels: { connections: [{ id: "support", status: "connected" }] } },
} as Site
function useFixture(siteId = "site-1", actorId = "actor", directory: Site[] = [site]) {
  const [sites, setSites] = useState(directory)
  const [currentSite, setCurrentSite] = useState<Site | null>(site)
  useSiteResourceSync(siteId, actorId, setSites, setCurrentSite)
  return { sites, currentSite, setCurrentSite, setSites }
}
beforeEach(() => {
  jest.clearAllMocks()
  mockRead.mockResolvedValue({ data: { channels: { connections: [{ id: "support", status: "disabled" }] }, social_media: [] }, error: null })
})

it('does not hydrate directory rows from a resource event: returning A → B → A restores GBP and its printer', async () => {
  const a = { ...site, id: '10000000-0000-4000-8000-000000000001', description: 'A', logo_url: 'a.svg', settings: undefined }
  const b = { ...a, id: '10000000-0000-4000-8000-000000000002', name: 'B' }
  const printer = { id: 'front-desk' }
  const read = jest.fn(async (id: string) => ({ data: { site_id: id, currency: id === a.id ? 'GBP' : 'EUR',
    printers: { devices: id === a.id ? [printer] : [] } }, error: null }))
  const supabase = { from: () => ({ select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: () => read(id) }) }) }) }
  const { result } = renderHook(() => useFixture(a.id, 'actor', [a, b]))
  const select = (s: Site) => applyCurrentSite({ ...result.current, site: s, requireSettings: true, supabase })
  await act(async () => { await select(a) })
  await act(async () => { notifySiteResourcesUpdated(a.id) })
  expect(result.current.sites[0].settings).toBeUndefined()
  await act(async () => { await select(b) })
  expect(result.current.currentSite?.settings?.currency).toBe('EUR')
  await act(async () => { await select(result.current.sites[0]) })
  expect(read.mock.calls.map(([id]) => id)).toEqual([a.id, b.id, a.id])
  expect(result.current.currentSite?.settings).toMatchObject({ currency: 'GBP', printers: { devices: [printer] } })
})
it("refreshes same-tab counters from an authorized read, preserving billing and other settings", async () => {
  mockRead.mockResolvedValueOnce({ data: { channels: { connections: [{ id: 'support', status: 'disabled' }] },
    social_media: [], onboarding: { create_campaign: true, future_task: true } }, error: null })
  const { result } = renderHook(() => useFixture())
  act(() => notifySiteResourcesUpdated("foreign"))
  expect(mockRead).not.toHaveBeenCalled()
  act(() => notifySiteResourcesUpdated("site-1"))
  await waitFor(() => expect(result.current.currentSite?.settings?.channels?.connections?.[0].status).toBe("disabled"))
  expect(result.current.currentSite?.billing).toEqual(site.billing)
  expect(result.current.currentSite?.settings?.currency).toBe("USD")
  expect(result.current.currentSite?.onboardingProgress?.done).toBe(1)
  expect(result.current.currentSite?.settings).not.toHaveProperty('onboarding')
  expect(result.current.sites[0].settings?.channels?.connections?.[0].status).toBe("disabled")
})
it("observes server resource reconciliation and cleans up on unmount", async () => {
  const { result, unmount } = renderHook(() => useFixture())
  act(() => mockRealtime())
  await waitFor(() => expect(result.current.currentSite?.settings?.channels?.connections?.[0].status).toBe("disabled"))
  unmount()
  expect(mockRemove).toHaveBeenCalledWith({ id: "subscription" })
})
it("ignores old-site reads after switching sites", async () => {
  let finish!: (value: unknown) => void
  mockRead.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { result, rerender } = renderHook(({ siteId }) => useFixture(siteId), { initialProps: { siteId: "site-1" } })
  act(() => notifySiteResourcesUpdated("site-1"))
  rerender({ siteId: "site-2" })
  await act(async () => finish({ data: { channels: { connections: [{ id: "support", status: "disabled" }] } }, error: null }))
  expect(result.current.currentSite?.settings?.channels?.connections?.[0].status).toBe("connected")
})

it('retires a previous actor even when the new actor selects the same site', async () => {
  let finish!: (value: unknown) => void
  mockRead.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const { result, rerender } = renderHook(({ actor }) => useFixture('site-1', actor), { initialProps: { actor: 'old' } })
  act(() => mockRealtime())
  rerender({ actor: 'next' })
  await act(async () => finish({ data: { onboarding: { create_campaign: true } }, error: null }))
  expect(result.current.currentSite?.onboardingProgress).toBeUndefined()
})
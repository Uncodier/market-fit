import { act, renderHook, waitFor } from "@testing-library/react"
import { useState } from "react"
import { notifySiteResourcesUpdated, useSiteResourceSync } from "@/app/context/site-resource-sync"
import type { Site } from "@/app/context/site-types"

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
function useFixture(siteId = "site-1") {
  const [sites, setSites] = useState([site])
  const [currentSite, setCurrentSite] = useState<Site | null>(site)
  useSiteResourceSync(siteId, setSites, setCurrentSite)
  return { sites, currentSite }
}
beforeEach(() => {
  jest.clearAllMocks()
  mockRead.mockResolvedValue({ data: { channels: { connections: [{ id: "support", status: "disabled" }] }, social_media: [] }, error: null })
})
it("refreshes same-tab counters from an authorized read, preserving billing and other settings", async () => {
  const { result } = renderHook(() => useFixture())
  act(() => notifySiteResourcesUpdated("foreign"))
  expect(mockRead).not.toHaveBeenCalled()
  act(() => notifySiteResourcesUpdated("site-1"))
  await waitFor(() => expect(result.current.currentSite?.settings?.channels?.connections?.[0].status).toBe("disabled"))
  expect(result.current.currentSite?.billing).toEqual(site.billing)
  expect(result.current.currentSite?.settings?.currency).toBe("USD")
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
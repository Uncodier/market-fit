import { act, renderHook } from "@testing-library/react"
import { useRobotsController } from "@/app/robots/use-robots-controller"

const mockRefreshSites = jest.fn()
const mockRefreshBilling = jest.fn()
let mockSiteId: string | undefined = "site-a"
let mockBillingRefresh = mockRefreshBilling
const mockInstances = [{ id: "instance-a", site_id: "site-a", name: "Content Creator" }]
const mockSetMode = jest.fn()

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({
    currentSite: mockSiteId ? { id: mockSiteId } : null,
    refreshSites: mockRefreshSites, refreshSiteBilling: mockBillingRefresh,
  }),
}))
jest.mock("@/app/context/RobotsContext", () => ({
  useRobots: () => ({
    getAllInstances: () => mockInstances,
    getInstanceById: (id: string) => mockInstances.find(instance => instance.id === id),
    refreshRobots: jest.fn(), isLoading: false, refreshCount: 0,
  }),
}))
jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ isLayoutCollapsed: false, robotsViewMode: "imprenta", setRobotsViewMode: mockSetMode }),
}))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ theme: "light", isDarkMode: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/components/robots/use-instance-browser-data", () => ({
  useInstanceBrowserData: () => ({ instanceStats: {} }),
}))
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("mode=imprenta&instance=instance-a"),
  usePathname: () => "/robots", useRouter: () => ({ replace: jest.fn() }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockSiteId = "site-a"
  mockBillingRefresh = mockRefreshBilling
  mockRefreshBilling.mockResolvedValue(undefined)
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
})

it("keeps the selected canvas while returning from the file picker without a full-site refresh", async () => {
  let finish!: () => void
  mockRefreshBilling.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const { result, rerender } = renderHook(() => useRobotsController())
  await act(async () => {
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(mockRefreshSites).not.toHaveBeenCalled()
  expect(mockRefreshBilling).toHaveBeenCalledTimes(1)
  expect(mockRefreshBilling).toHaveBeenCalledWith("site-a")
  rerender()
  expect(result.current.activeRobotInstance?.id).toBe("instance-a")
  expect(result.current.viewMode).toBe("imprenta")
  await act(async () => { finish() })
  await act(async () => { window.dispatchEvent(new Event("focus")) })
  expect(mockRefreshBilling).toHaveBeenCalledTimes(2)
})

it("does not check billing while hidden or without a selected site", async () => {
  const { rerender } = renderHook(() => useRobotsController())
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("focus"))
  })
  mockSiteId = undefined
  rerender()
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  await act(async () => { window.dispatchEvent(new Event("focus")) })
  expect(mockRefreshBilling).not.toHaveBeenCalled()
  expect(mockRefreshSites).not.toHaveBeenCalled()
})

it("uses the latest billing callback and current site after rerendering", async () => {
  const { rerender } = renderHook(() => useRobotsController())
  mockSiteId = "site-b"
  mockBillingRefresh = jest.fn().mockResolvedValue(undefined)
  rerender()
  await act(async () => { window.dispatchEvent(new Event("focus")) })
  expect(mockBillingRefresh).toHaveBeenCalledWith("site-b")
  expect(mockRefreshBilling).not.toHaveBeenCalled()
})

it("allows another wake after a failed read and removes listeners on unmount", async () => {
  mockRefreshBilling.mockRejectedValueOnce(new Error("Offline"))
  const { unmount } = renderHook(() => useRobotsController())
  await act(async () => { window.dispatchEvent(new Event("focus")) })
  await act(async () => { window.dispatchEvent(new Event("focus")) })
  expect(mockRefreshBilling).toHaveBeenCalledTimes(2)
  expect(mockRefreshSites).not.toHaveBeenCalled()
  unmount()
  await act(async () => {
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(mockRefreshBilling).toHaveBeenCalledTimes(2)
})
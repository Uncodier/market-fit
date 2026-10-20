import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Sidebar } from "@/app/components/navigation/Sidebar"
import { useOptionalSite, useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }))
jest.mock("@/app/context/SiteContext", () => ({ useOptionalSite: jest.fn(), useSite: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }))
jest.mock("@/app/components/navigation/NavigationLink", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react")
  return { NavigationLink: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
    function NavigationLink(props, ref) { return <a ref={ref} {...props} /> },
  ) }
})
jest.mock("@/app/components/navigation/SiteSelector", () => ({ SiteSelector: () => null }))
jest.mock("@/app/components/navigation/ConfigurationSection", () => ({ ConfigurationSection: () => null }))
jest.mock("@/app/components/navigation/NotificationBadge", () => ({ NotificationBadge: () => null }))
jest.mock("@/app/components/navigation/RobotsNavItems", () => ({ RobotsNavItems: () => null }))
jest.mock("@/app/components/navigation/DynamicShortcuts", () => ({ DynamicShortcuts: () => null }))
jest.mock("@/app/components/navigation/OnboardingProgressWidget", () => ({ OnboardingProgressWidget: () => null }))
jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({ useBtnGlassMotion: () => () => undefined }))

const siteId = "11111111-1111-4111-8111-111111111111"
const fetchMock = jest.fn()
const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  const context = { currentSite: { id: siteId, billing_read_status: "loaded",
    billing: { plan: "commission", addons_count: 0, credits_available: 1, account_balance: 0 },
  } } as never
  jest.mocked(useOptionalSite).mockReturnValue(context)
  jest.mocked(useSite).mockReturnValue(context)
  jest.mocked(useOptionalPermissions).mockReturnValue({ siteId,
    capabilities: { role: "admin", is_owner: false, update: true, insert: false, select: true, delete: false },
    can: () => true, isViewOnly: false,
  })
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true,
    state: "eligible", offer_eligible: true, started_at: null, ends_at: null,
    credits_remaining: 0, server_now: "2026-10-19T12:00:00.000Z",
  }) })
  global.fetch = fetchMock
})
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.useRealTimers() })

it.each([false, true])("keeps the independent shortcut in the existing sidebar widget block collapsed=%s", async isCollapsed => {
  const view = render(<Sidebar isCollapsed={isCollapsed} onCollapse={jest.fn()} />)
  expect(screen.queryByText("Startup trial")).not.toBeInTheDocument()
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
  const cta = screen.getByRole(isCollapsed ? "button" : "link", { name: "Activate trial" })
  const widgetBlock = cta.closest(".md\\:grid")
  expect(widgetBlock).toHaveClass("hidden", "md:grid")
  fireEvent.click(cta)
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(),
    `/billing?siteId=${siteId}&tab=billing_info#startup-trial`)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][1].method).toBe("GET")

  // Existing credits remain independently available when the balance becomes low.
  const context = { currentSite: { id: siteId, billing_read_status: "loaded",
    billing: { plan: "commission", addons_count: 0, credits_available: 0, account_balance: 0 },
  } } as never
  jest.mocked(useOptionalSite).mockReturnValue(context)
  jest.mocked(useSite).mockReturnValue(context)
  view.rerender(<Sidebar isCollapsed={isCollapsed} onCollapse={jest.fn()} />)
  const credits = screen.getByRole("button", { name: "layout.sidebar.manageCredits" })
  expect(credits.closest(".md\\:grid")).toBe(widgetBlock)
  expect(screen.getByRole(isCollapsed ? "button" : "link", { name: "Activate trial" })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
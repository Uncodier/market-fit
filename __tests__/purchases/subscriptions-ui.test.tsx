import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { cancelBuyerSubscription, listBuyerSubscriptions } from "@/app/buyer/actions"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { PurchasedSubscriptionsList } from "@/app/purchases/subscriptions/PurchasedSubscriptionsList"
import PurchasesSubscriptionsPage from "@/app/purchases/subscriptions/page"
import type { PurchasedSubscription } from "@/app/purchases/subscriptions/types"
import { SWRConfig } from "swr"
import { demoPurchasedSubscriptions } from "@/lib/demo-data/purchased-subscriptions"

jest.mock("@/app/buyer/actions", () => ({ cancelBuyerSubscription: jest.fn(), listBuyerSubscriptions: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "buyer-site" } }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/components/ui/mobile-filters-drawer", () => ({
  MobileFiltersDrawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FilterContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FilterSection: ({ children, mobileOnly }: { children: React.ReactNode; mobileOnly?: boolean }) => mobileOnly ? null : <div>{children}</div>,
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }))

const subscription: PurchasedSubscription = {
  id: "sub-1", site_id: "seller-site", catalog_item_id: "plan-1", status: "active", amount: 125,
  created_at: "2026-09-01", start_date: "2026-09-01", next_billing_date: "2026-11-01",
  catalog_item: { id: "plan-1", name: "Growth plan", currency: "USD" },
  site: { id: "seller-site", name: "Acme supplier" },
  entitlements: [{ id: "pass-1", uses_remaining: 3, catalog_item: { name: "Monthly pass", digital_subtype: "pass" } }],
}

async function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Growth plan" }), { key: "ArrowDown" })
  return screen.findByRole("menu")
}

beforeEach(() => {
  document.cookie = 'market_fit_demo_site_id=; path=/; max-age=0'
  localStorage.removeItem('currentSiteId')
  jest.clearAllMocks()
  jest.mocked(useOptionalPermissions).mockReturnValue(null)
  jest.mocked(cancelBuyerSubscription).mockResolvedValue({ success: true })
  jest.mocked(listBuyerSubscriptions).mockResolvedValue({ data: [subscription], count: 1 })
})

afterEach(() => {
  document.cookie = 'market_fit_demo_site_id=; path=/; max-age=0'
  localStorage.removeItem('currentSiteId')
})

it.each(['demo-saas-en-123', 'demo-ecom-es-456', 'demo-habituall'])("loads fictional subscriptions for %s without calling the backend", async (demoId) => {
  document.cookie = `market_fit_demo_site_id=${demoId}; path=/`
  render(<SWRConfig value={{ provider: () => new Map() }}><PurchasesSubscriptionsPage /></SWRConfig>)
  const fixtures = demoPurchasedSubscriptions(demoId)
  expect(fixtures).toHaveLength(5)
  expect(new Set(fixtures.map(sub => sub.status))).toEqual(new Set(['active', 'paused', 'cancelled', 'expired']))
  expect(screen.getByText(fixtures[0].site!.name)).toBeInTheDocument()
  expect(screen.queryAllByRole('link')).toHaveLength(0)
  expect(listBuyerSubscriptions).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('button', { name: `Actions for ${fixtures[0].catalog_item!.name}` }), { key: 'ArrowDown' })
  expect(await screen.findByRole('menuitem', { name: 'Cancel subscription' })).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel subscription' }))
  expect(cancelBuyerSubscription).not.toHaveBeenCalled()
})

it('never returns fictional subscriptions for a real or unknown account', () => {
  expect(demoPurchasedSubscriptions('buyer-site')).toEqual([])
  expect(demoPurchasedSubscriptions('demo-unknown')).toEqual([])
})

it("renders the sales-style table with supplier, plan, billing and buyer access links", async () => {
  render(<PurchasedSubscriptionsList subscriptions={[subscription]} onUpdate={jest.fn()} />)
  expect(screen.getByRole("table")).toBeInTheDocument()
  expect(screen.getByRole("columnheader", { name: "Supplier / plan" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Acme supplier/ })).toHaveAttribute("href", "/shop/seller-site/plan-1")
  expect(screen.getByRole("link", { name: "Monthly pass · 3 uses" })).toHaveAttribute("href", "/buyer/book/pass-1")
  expect(screen.getByText("Nov 1, 2026")).toBeInTheDocument()
  await openMenu()
  expect(screen.getByRole("menuitem", { name: "View plan" })).toBeInTheDocument()
  expect(screen.queryByText("Generate invoice")).not.toBeInTheDocument()
  expect(screen.queryByText("Register payment")).not.toBeInTheDocument()
})

it("requires confirmation, calls buyer cancellation and refreshes after success", async () => {
  const onUpdate = jest.fn()
  render(<PurchasedSubscriptionsList subscriptions={[subscription]} onUpdate={onUpdate} />)
  await openMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: "Cancel subscription" }))
  await screen.findByRole("alertdialog", { name: "Cancel subscription?" })
  expect(cancelBuyerSubscription).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }))
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
  expect(cancelBuyerSubscription).toHaveBeenCalledWith("sub-1")
})

it("keeps the confirmation open on a server rejection", async () => {
  jest.mocked(cancelBuyerSubscription).mockResolvedValue({ error: "Not authorized" })
  const onUpdate = jest.fn()
  render(<PurchasedSubscriptionsList subscriptions={[subscription]} onUpdate={onUpdate} />)
  await openMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: "Cancel subscription" }))
  fireEvent.click(await screen.findByRole("button", { name: "Cancel subscription" }))
  await waitFor(() => expect(cancelBuyerSubscription).toHaveBeenCalled())
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  expect(onUpdate).not.toHaveBeenCalled()
})

it.each(["cancelled", "expired"])("does not offer cancellation for %s plans", async (status) => {
  render(<PurchasedSubscriptionsList subscriptions={[{ ...subscription, status }]} onUpdate={jest.fn()} />)
  await openMenu()
  expect(screen.queryByRole("menuitem", { name: "Cancel subscription" })).not.toBeInTheDocument()
})

it("honors minimum terms and view-only permissions", async () => {
  const view = render(<PurchasedSubscriptionsList subscriptions={[{ ...subscription, end_date: "2099-01-01" }]} onUpdate={jest.fn()} />)
  await openMenu()
  expect(screen.queryByRole("menuitem", { name: "Cancel subscription" })).not.toBeInTheDocument()
  view.unmount()
  jest.mocked(useOptionalPermissions).mockReturnValue({ siteId: "buyer-site", capabilities: null, isViewOnly: true, can: () => false })
  render(<PurchasedSubscriptionsList subscriptions={[subscription]} onUpdate={jest.fn()} />)
  await openMenu()
  expect(screen.getByRole("menuitem", { name: "Cancel subscription" })).toHaveAttribute("aria-disabled", "true")
})

it("loads only the current buyer site's subscriptions and filters by supplier and status", async () => {
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><PurchasesSubscriptionsPage /></SWRConfig>)
  await screen.findByText("Acme supplier")
  expect(listBuyerSubscriptions).toHaveBeenCalledWith({ scope: "site", ownerSiteId: "buyer-site", page: 1, pageSize: 200 })
  fireEvent.change(screen.getByPlaceholderText("Search subscriptions..."), { target: { value: "Acme" } })
  expect(screen.getByText("Acme supplier")).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Search subscriptions..."), { target: { value: "other supplier" } })
  expect(screen.getByText("No subscriptions")).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Search subscriptions..."), { target: { value: "" } })
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Paused" }))
  expect(screen.getByText("No subscriptions")).toBeInTheDocument()
})

it("shows a retryable error instead of an empty list when loading fails", async () => {
  jest.mocked(listBuyerSubscriptions).mockResolvedValue({ error: "Not authorized" })
  render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}><PurchasesSubscriptionsPage /></SWRConfig>)
  expect(await screen.findByRole("alert")).toHaveTextContent("Error loading subscriptions")
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  expect(screen.queryByText("No subscriptions")).not.toBeInTheDocument()
})

it("searches across fetched pages and sorts the complete list rather than just one page", async () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({ ...subscription, id: `sub-${index}` }))
  const older = { ...subscription, id: "older", created_at: "2025-01-01", site: { id: "other-seller", name: "Older supplier" } }
  jest.mocked(listBuyerSubscriptions)
    .mockResolvedValueOnce({ data: rows, count: 51 })
    .mockResolvedValueOnce({ data: [older], count: 51 })
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><PurchasesSubscriptionsPage /></SWRConfig>)
  await screen.findAllByText("Acme supplier")
  expect(listBuyerSubscriptions).toHaveBeenLastCalledWith({ scope: "site", ownerSiteId: "buyer-site", page: 2, pageSize: 200 })
  expect(screen.queryByText("Older supplier")).not.toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Search subscriptions..."), { target: { value: "Older supplier" } })
  expect(screen.getByText("Older supplier")).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Search subscriptions..."), { target: { value: "" } })
  fireEvent.keyDown(screen.getByRole("button", { name: "Newest" }), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "Oldest" }))
  expect(screen.getByText("Older supplier")).toBeInTheDocument()
})
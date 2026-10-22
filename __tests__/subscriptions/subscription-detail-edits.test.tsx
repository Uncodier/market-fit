import React from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import SubscriptionDetailPage from "@/app/subscriptions/[id]/page"
import { getSubscriptionDetail, type SubscriptionDetail } from "@/app/subscriptions/actions"
import { updateSubscriptionAmount, updateSubscriptionEndDate } from "@/app/subscriptions/update-details"
import { toast } from "sonner"
import { localeMessages } from "@/app/context/locale-catalog"

let mockLocale: "en" | "es" = "en"
const mockTranslators = {
  en: (key: string) => localeMessages.en[key] || key,
  es: (key: string) => localeMessages.es[key] || key,
}

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "11111111-1111-4111-8111-111111111111" } }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ locale: mockLocale, t: mockTranslators[mockLocale] }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/subscriptions/actions", () => ({ getSubscriptionDetail: jest.fn(), updateSubscriptionStatus: jest.fn(), updateSubscriptionDueDate: jest.fn(), updateSubscriptionNextBillingDate: jest.fn() }))
jest.mock("@/app/subscriptions/update-details", () => ({ updateSubscriptionAmount: jest.fn(), updateSubscriptionEndDate: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/components/ui/responsive-tabs-list", () => ({ ResponsiveTabsList: () => null }))
jest.mock("@/app/subscriptions/components/SubscriptionStatusBar", () => ({ SubscriptionStatusBar: () => null }))
jest.mock("@/app/subscriptions/components/SubscriptionInvoicesTable", () => ({ SubscriptionInvoicesTable: () => <div>Existing invoice: $125.00</div> }))
jest.mock("@/app/subscriptions/components/SubscriptionPaymentsTable", () => ({ SubscriptionPaymentsTable: () => null }))
jest.mock("@/app/subscriptions/components/SubscriptionIdentityHeader", () => ({
  SubscriptionIdentityHeader: ({ subscription }: { subscription: SubscriptionDetail }) => <div data-testid="subscription-header">{subscription.amount} per cycle</div>,
}))
jest.mock("@/app/subscriptions/components/CreateSubscriptionInvoiceDialog", () => ({
  CreateSubscriptionInvoiceDialog: ({ defaultAmount }: { defaultAmount: number }) => <div data-testid="invoice-default">{defaultAmount}</div>,
}))

const subscription: SubscriptionDetail = {
  id: "22222222-2222-4222-8222-222222222222", site_id: "11111111-1111-4111-8111-111111111111",
  lead_id: "lead-1", catalog_item_id: "plan-1", status: "active", amount: 125,
  start_date: "2026-09-01", next_billing_date: "2026-10-20T00:00:00Z", due_date: "2026-11-03", end_date: "2026-12-20",
  created_at: "2026-09-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
  lead: { id: "lead-1", name: "Avery", email: null, phone: null, status: null },
  catalog_item: { id: "plan-1", name: "Growth plan", description: null, kind: "service" },
}

async function open() {
  render(<SubscriptionDetailPage params={Promise.resolve({ id: subscription.id })} />)
  return screen.findByTestId("subscription-header")
}

beforeEach(() => {
  mockLocale = "en"
  jest.clearAllMocks()
  jest.spyOn(React, "use").mockReturnValue({ id: subscription.id })
  jest.mocked(getSubscriptionDetail).mockResolvedValue({ subscription, invoices: [] })
  jest.mocked(updateSubscriptionAmount).mockResolvedValue({ data: { amount: 250, end_date: subscription.end_date, updated_at: "2026-10-16T12:00:00Z" } })
  jest.mocked(updateSubscriptionEndDate).mockResolvedValue({ data: { amount: 125, end_date: null, updated_at: "2026-10-16T12:00:00Z" } })
})
afterEach(() => jest.restoreAllMocks())

it("persists Amount and updates header, recurring value, and manual invoice default", async () => {
  const header = await open()
  const row = screen.getByText("Amount").closest(".group") as HTMLElement
  fireEvent.click(within(row).getByText("$125.00"))
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "250" } })
  fireEvent.click(screen.getByRole("button", { name: "Save amount" }))
  await waitFor(() => expect(header).toHaveTextContent("250 per cycle"))
  expect(updateSubscriptionAmount).toHaveBeenCalledWith(subscription.site_id, subscription.id, 250)
  expect(screen.getByTestId("invoice-default")).toHaveTextContent("250")
  expect(screen.getAllByText("$250.00")).toHaveLength(2)
  expect(screen.getByText("Existing invoice: $125.00")).toBeInTheDocument()
  expect(toast.success).toHaveBeenCalledWith("Subscription amount saved")
})

it("persists clearing End date and leaves Amount unchanged", async () => {
  const header = await open()
  fireEvent.click(screen.getByText("Dec 20, 2026"))
  fireEvent.click(screen.getByRole("button", { name: "Clear end date" }))
  fireEvent.click(screen.getByRole("button", { name: "Save end date" }))
  await waitFor(() => expect(screen.getByText("Not set")).toBeInTheDocument())
  expect(updateSubscriptionEndDate).toHaveBeenCalledWith(subscription.site_id, subscription.id, null)
  expect(header).toHaveTextContent("125 per cycle")
  expect(toast.success).toHaveBeenCalledWith("Subscription end date saved")
})

it("retains the prior amount and editor if the server rejects an update", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.mocked(updateSubscriptionAmount).mockResolvedValueOnce({ error: "Concurrent update" })
  const header = await open()
  const row = screen.getByText("Amount").closest(".group") as HTMLElement
  fireEvent.click(within(row).getByText("$125.00"))
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "250" } })
  fireEvent.click(screen.getByRole("button", { name: "Save amount" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save field"))
  expect(header).toHaveTextContent("125 per cycle")
  expect(screen.getByTestId("invoice-default")).toHaveTextContent("125")
  expect(screen.getByLabelText("Amount")).toHaveValue(250)
  expect(toast.success).not.toHaveBeenCalled()
})

it("translates headings and document title on locale switch without refetching the subscription", async () => {
  const view = render(<SubscriptionDetailPage params={Promise.resolve({ id: subscription.id })} />)
  await screen.findByTestId("subscription-header")
  expect(getSubscriptionDetail).toHaveBeenCalledTimes(1)
  mockLocale = "es"
  view.rerender(<SubscriptionDetailPage params={Promise.resolve({ id: subscription.id })} />)
  expect(screen.getByRole("heading", { name: "Facturas" })).toBeInTheDocument()
  expect(screen.getByText("Historial de facturación de esta suscripción.")).toBeInTheDocument()
  expect(document.title).toBe(`Growth plan | ${localeMessages.es["layout.sidebar.subscriptions"]}`)
  expect(getSubscriptionDetail).toHaveBeenCalledTimes(1)
})

it("translates a known load error and the missing subscription recovery action", async () => {
  mockLocale = "es"
  jest.mocked(getSubscriptionDetail).mockResolvedValueOnce({ subscription: null, invoices: [], error: "Subscription not found" })
  render(<SubscriptionDetailPage params={Promise.resolve({ id: subscription.id })} />)
  expect(await screen.findByRole("heading", { name: "Suscripción no encontrada" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Volver a suscripciones" })).toBeInTheDocument()
  expect(toast.error).toHaveBeenCalledWith("Suscripción no encontrada")
})
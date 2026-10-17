import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SubscriptionsList } from "@/app/subscriptions/components/SubscriptionsList"
import { generateSubscriptionPeriodInvoice } from "@/app/subscriptions/generate-period-invoice"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { SubscriptionListItem } from "@/app/subscriptions/invoice-summary"

jest.mock("@/app/subscriptions/actions", () => ({ updateSubscriptionStatus: jest.fn() }))
jest.mock("@/app/subscriptions/delete-subscription", () => ({ deleteSubscription: jest.fn() }))
jest.mock("@/app/subscriptions/register-payment", () => ({ registerSubscriptionPayment: jest.fn() }))
jest.mock("@/app/subscriptions/generate-period-invoice", () => ({ generateSubscriptionPeriodInvoice: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }))

const subscription: SubscriptionListItem = {
  id: "22222222-2222-4222-8222-222222222222",
  site_id: "11111111-1111-4111-8111-111111111111",
  lead_id: "lead-1", catalog_item_id: "plan-1", status: "active", amount: 125,
  start_date: "2026-10-20", next_billing_date: "2026-10-20T00:00:00Z", due_date: "2026-11-03",
  created_at: "2026-10-16T12:00:00Z", updated_at: "2026-10-16T12:00:00Z",
  catalog_item: { name: "Growth plan", currency: "EUR" }, lead: { name: "Avery" }, pendingInvoices: [],
}

function setup(subscriptions = [subscription]) {
  const onUpdate = jest.fn()
  const props = { subscriptions, siteId: subscription.site_id, onUpdate }
  return { ...render(<SubscriptionsList {...props} />), onUpdate, props }
}

async function openMenu(index = 0) {
  fireEvent.keyDown(screen.getAllByRole("button", { name: "Actions" })[index], { key: "ArrowDown" })
  return screen.findByRole("menu")
}

async function openConfirmation(index = 0) {
  await openMenu(index)
  fireEvent.click(screen.getByRole("menuitem", { name: "Generate period invoice" }))
  return screen.findByRole("dialog", { name: "Generate period invoice" })
}

describe("period invoice generation from the subscriptions list", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useOptionalPermissions).mockReturnValue(null)
    jest.mocked(generateSubscriptionPeriodInvoice).mockResolvedValue({ data: { id: "invoice-1" } })
  })

  it("offers generation with no pending invoices, confirms, and refreshes the list without navigating", async () => {
    const { onUpdate, rerender, props } = setup()
    const dialog = await openConfirmation()
    expect(within(dialog).getByText("Oct 20, 2026")).toBeInTheDocument()
    expect(within(dialog).getByText("Nov 3, 2026")).toBeInTheDocument()
    expect(within(dialog).getByText("€125.00")).toBeInTheDocument()
    expect(generateSubscriptionPeriodInvoice).not.toHaveBeenCalled()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate invoice" }))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(generateSubscriptionPeriodInvoice).toHaveBeenCalledWith({ siteId: subscription.site_id, subscriptionId: subscription.id, billingDate: "2026-10-20" })
    expect(jest.mocked(useRouter).mock.results.flatMap((result) => result.value.push.mock.calls)).toEqual([])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    rerender(<SubscriptionsList {...props} subscriptions={[{
      ...subscription, pendingInvoices: [{ id: "invoice-1", title: "Growth plan", invoiceNumber: null, amountDue: 125, currency: "EUR" }],
    }]} />)
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Register payment" })).not.toHaveAttribute("aria-disabled", "true")
  })

  it("targets only the selected subscription", async () => {
    setup([subscription, { ...subscription, id: "33333333-3333-4333-8333-333333333333", amount: 250, next_billing_date: "2026-10-22" }])
    const dialog = await openConfirmation(1)
    expect(within(dialog).getByText("Oct 22, 2026")).toBeInTheDocument()
    expect(within(dialog).getByText("€250.00")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate invoice" }))
    await waitFor(() => expect(generateSubscriptionPeriodInvoice).toHaveBeenCalledWith({
      siteId: subscription.site_id, subscriptionId: "33333333-3333-4333-8333-333333333333", billingDate: "2026-10-22",
    }))
  })

  it("cancels without generating or refreshing", async () => {
    const { onUpdate } = setup()
    const dialog = await openConfirmation()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(generateSubscriptionPeriodInvoice).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each(["paused", "cancelled", "expired"] as const)("disables generation for %s subscriptions", async (status) => {
    setup([{ ...subscription, status }])
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Generate period invoice" })).toHaveAttribute("aria-disabled", "true")
  })

  it.each([undefined, "invalid date"])("disables generation without a valid billing date (%s)", async (next_billing_date) => {
    setup([{ ...subscription, next_billing_date }])
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Generate period invoice" })).toHaveAttribute("aria-disabled", "true")
  })

  it("requires insert permission while leaving permitted payment actions available", async () => {
    jest.mocked(useOptionalPermissions).mockReturnValue({
      siteId: subscription.site_id, capabilities: null, isViewOnly: false, can: (action) => action !== "insert",
    })
    setup([{ ...subscription, pendingInvoices: [{ id: "invoice", title: "Invoice", invoiceNumber: null, amountDue: 25, currency: "EUR" }] }])
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Generate period invoice" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("menuitem", { name: "Register payment" })).not.toHaveAttribute("aria-disabled", "true")
  })

  it("prevents duplicate generation and dismissal while saving", async () => {
    let finish!: (result: { data: { id: string } }) => void
    jest.mocked(generateSubscriptionPeriodInvoice).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const { onUpdate } = setup()
    const dialog = await openConfirmation()
    const generate = within(dialog).getByRole("button", { name: "Generate invoice" })
    fireEvent.click(generate)
    expect(generate).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    fireEvent.click(generate)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(dialog).toBeInTheDocument()
    expect(generateSubscriptionPeriodInvoice).toHaveBeenCalledTimes(1)
    await act(async () => finish({ data: { id: "invoice-1" } }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it("keeps confirmation open on failure and refreshes only after successful retry", async () => {
    jest.mocked(generateSubscriptionPeriodInvoice).mockResolvedValueOnce({ error: "Billing period changed" })
    const { onUpdate } = setup()
    const dialog = await openConfirmation()
    const generate = within(dialog).getByRole("button", { name: "Generate invoice" })
    fireEvent.click(generate)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Billing period changed"))
    expect(dialog).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
    await waitFor(() => expect(generate).toBeEnabled())
    fireEvent.click(generate)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
  })
})
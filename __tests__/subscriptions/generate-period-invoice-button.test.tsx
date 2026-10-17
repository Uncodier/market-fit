import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { toast } from "sonner"
import { GeneratePeriodInvoiceButton } from "@/app/subscriptions/components/GeneratePeriodInvoiceButton"
import { generateSubscriptionPeriodInvoice } from "@/app/subscriptions/generate-period-invoice"
import type { SubscriptionDetail } from "@/app/subscriptions/actions"
import { useOptionalPermissions } from "@/app/context/PermissionContext"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/subscriptions/generate-period-invoice", () => ({ generateSubscriptionPeriodInvoice: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))

const subscription: SubscriptionDetail = {
  id: "22222222-2222-4222-8222-222222222222", site_id: "11111111-1111-4111-8111-111111111111",
  lead_id: "lead-1", catalog_item_id: "plan-1", status: "active", amount: 125,
  start_date: "2026-10-20", next_billing_date: "2026-10-20T00:00:00Z", due_date: "2026-11-03",
  created_at: "2026-10-16T12:00:00Z", updated_at: "2026-10-16T12:00:00Z",
  lead: { id: "lead-1", name: "Avery", email: null, phone: null, status: null },
  catalog_item: { id: "plan-1", name: "Growth plan", description: null, kind: "service" },
}

function setup(overrides: Partial<SubscriptionDetail> = {}) {
  const onSuccess = jest.fn()
  render(<GeneratePeriodInvoiceButton subscription={{ ...subscription, ...overrides }} currency="USD" onSuccess={onSuccess} />)
  return { onSuccess }
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Generate period invoice" }))
  return screen.getByRole("dialog", { name: "Generate period invoice" })
}

describe("generate period invoice action", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useOptionalPermissions).mockReturnValue(null)
    jest.mocked(generateSubscriptionPeriodInvoice).mockResolvedValue({ data: { id: "invoice-1" } })
  })

  it("previews the first period dates and amount before generating", async () => {
    const { onSuccess } = setup()
    const dialog = openDialog()
    expect(within(dialog).getByText("Oct 20, 2026")).toBeInTheDocument()
    expect(within(dialog).getByText("Nov 3, 2026")).toBeInTheDocument()
    expect(within(dialog).getByText("$125.00")).toBeInTheDocument()
    expect(within(dialog).getByText(/Next billing will not advance/)).toBeInTheDocument()
    expect(generateSubscriptionPeriodInvoice).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate invoice" }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(generateSubscriptionPeriodInvoice).toHaveBeenCalledWith({ siteId: subscription.site_id, subscriptionId: subscription.id, billingDate: "2026-10-20" })
    expect(toast.success).toHaveBeenCalledWith("Period invoice generated")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("cancels without generating", () => {
    setup()
    const dialog = openDialog()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(generateSubscriptionPeriodInvoice).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each(["paused", "cancelled", "expired"] as const)("disables generation for %s subscriptions", (status) => {
    setup({ status })
    expect(screen.getByRole("button", { name: "Generate period invoice" })).toBeDisabled()
  })

  it("requires a next billing date", () => {
    setup({ next_billing_date: undefined })
    expect(screen.getByRole("button", { name: "Generate period invoice" })).toBeDisabled()
  })

  it("requires invoice insert permission", () => {
    jest.mocked(useOptionalPermissions).mockReturnValue({
      siteId: subscription.site_id, capabilities: null, isViewOnly: true, can: () => false,
    })
    setup()
    expect(screen.getByRole("button", { name: "Generate period invoice" })).toBeDisabled()
  })

  it("blocks repeated clicks and dismissal while generating", async () => {
    let finish!: (result: { data: { id: string } }) => void
    jest.mocked(generateSubscriptionPeriodInvoice).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    setup()
    const dialog = openDialog()
    const generate = within(dialog).getByRole("button", { name: "Generate invoice" })
    fireEvent.click(generate)
    expect(generate).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    fireEvent.click(generate)
    expect(generateSubscriptionPeriodInvoice).toHaveBeenCalledTimes(1)
    await act(async () => finish({ data: { id: "invoice-1" } }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each(["returned", "thrown"])("retains confirmation for retry after a %s failure", async (failure) => {
    if (failure === "returned") jest.mocked(generateSubscriptionPeriodInvoice).mockResolvedValueOnce({ error: "Period changed" })
    else jest.mocked(generateSubscriptionPeriodInvoice).mockRejectedValueOnce(new Error("Connection failed"))
    const { onSuccess } = setup()
    const dialog = openDialog()
    const generate = within(dialog).getByRole("button", { name: "Generate invoice" })
    fireEvent.click(generate)
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(generate).toBeEnabled())
    expect(onSuccess).not.toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
    fireEvent.click(generate)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it("refreshes invoices when the period was already invoiced", async () => {
    jest.mocked(generateSubscriptionPeriodInvoice).mockResolvedValueOnce({ data: { id: "invoice-1" }, existing: true })
    const { onSuccess } = setup()
    const dialog = openDialog()
    fireEvent.click(within(dialog).getByRole("button", { name: "Generate invoice" }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalledWith("This period already has an invoice")
  })
})
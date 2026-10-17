import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { SubscriptionAboutPanel } from "@/app/subscriptions/components/SubscriptionAboutPanel"
import type { SubscriptionDetail } from "@/app/subscriptions/actions"
import messages from "@/app/context/locales/en.json"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: (key: string) => messages[key as keyof typeof messages] || key }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))

const subscription: SubscriptionDetail = {
  id: "22222222-2222-4222-8222-222222222222", site_id: "11111111-1111-4111-8111-111111111111",
  lead_id: "lead-1", catalog_item_id: "plan-1", status: "active", amount: 125,
  start_date: "2026-09-01", next_billing_date: "2026-10-20T00:00:00Z", due_date: "2026-11-03", end_date: "2026-12-20",
  created_at: "2026-09-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
  lead: { id: "lead-1", name: "Avery", email: null, phone: null, status: null },
  catalog_item: { id: "plan-1", name: "Growth plan", description: null, kind: "service" },
}

function setup(overrides: Partial<SubscriptionDetail> = {}) {
  const onUpdateAmount = jest.fn().mockResolvedValue(undefined)
  const onUpdateEndDate = jest.fn().mockResolvedValue(undefined)
  const props = { subscription: { ...subscription, ...overrides }, currency: "USD", invoices: [],
    onUpdateAmount, onUpdateEndDate, onUpdateNextBillingDate: jest.fn(), onUpdateDueDate: jest.fn() }
  return { ...render(<SubscriptionAboutPanel {...props} />), props, onUpdateAmount, onUpdateEndDate }
}

function openAmount() {
  const row = screen.getByText("Amount").closest(".group")!
  fireEvent.click(within(row as HTMLElement).getByText("$125.00"))
  return screen.getByLabelText("Amount")
}

describe("inline subscription amount and end date", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useOptionalPermissions).mockReturnValue(null)
  })
  afterEach(() => jest.restoreAllMocks())

  it.each(["250.50", "0"])("saves Amount %s only after confirmation and updates the recurring display", async (value) => {
    const { onUpdateAmount, props, rerender } = setup()
    const input = openAmount()
    fireEvent.change(input, { target: { value } })
    expect(onUpdateAmount).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save amount" }))
    await waitFor(() => expect(onUpdateAmount).toHaveBeenCalledWith(Number(value)))
    await waitFor(() => expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument())
    rerender(<SubscriptionAboutPanel {...props} subscription={{ ...subscription, amount: Number(value) }} />)
    for (const label of ["Recurring", "Amount"]) {
      const row = screen.getByText(label).closest(".group") as HTMLElement
      expect(within(row).getByText(value === "0" ? "$0.00" : "$250.50")).toBeInTheDocument()
    }
  })

  it.each(["", "-1", "1.001"])("rejects invalid amount draft %s", (value) => {
    const { onUpdateAmount } = setup()
    fireEvent.change(openAmount(), { target: { value } })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save amount" })).toBeDisabled()
    expect(onUpdateAmount).not.toHaveBeenCalled()
  })

  it("cancels amount changes and saves by Enter", async () => {
    const { onUpdateAmount } = setup()
    fireEvent.change(openAmount(), { target: { value: "250" } })
    fireEvent.click(screen.getByRole("button", { name: "Cancel amount edit" }))
    expect(onUpdateAmount).not.toHaveBeenCalled()
    expect(screen.getAllByText("$125.00")).toHaveLength(2)
    const input = openAmount()
    fireEvent.change(input, { target: { value: "250" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(onUpdateAmount).toHaveBeenCalledWith(250))
  })

  it("edits End date with the shared calendar", async () => {
    const { onUpdateEndDate } = setup()
    fireEvent.click(screen.getByText("Dec 20, 2026"))
    fireEvent.click(screen.getByLabelText("End date"))
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 11, 21), "PPPP") }))
    expect(onUpdateEndDate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save end date" }))
    await waitFor(() => expect(onUpdateEndDate).toHaveBeenCalledWith("2026-12-21"))
    await waitFor(() => expect(screen.queryByLabelText("End date")).not.toBeInTheDocument())
  })

  it("clears End date only after confirmation", async () => {
    const { onUpdateEndDate } = setup()
    fireEvent.click(screen.getByText("Dec 20, 2026"))
    fireEvent.click(screen.getByRole("button", { name: "Clear end date" }))
    expect(screen.getByLabelText("End date")).toHaveTextContent("Select end date")
    expect(onUpdateEndDate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save end date" }))
    await waitFor(() => expect(onUpdateEndDate).toHaveBeenCalledWith(""))
  })

  it("cancels clearing End date without saving", () => {
    const { onUpdateEndDate } = setup()
    fireEvent.click(screen.getByText("Dec 20, 2026"))
    fireEvent.click(screen.getByRole("button", { name: "Clear end date" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel end date edit" }))
    expect(screen.getByText("Dec 20, 2026")).toBeInTheDocument()
    expect(onUpdateEndDate).not.toHaveBeenCalled()
  })

  it("keeps a missing End date editable", () => {
    setup({ end_date: null })
    fireEvent.click(screen.getByText("Not set"))
    expect(screen.getByLabelText("End date")).toHaveTextContent("Select end date")
  })

  it("blocks End date before start date", () => {
    const { onUpdateEndDate } = setup({ start_date: "2026-12-20" })
    fireEvent.click(screen.getByText("Dec 20, 2026"))
    fireEvent.click(screen.getByLabelText("End date"))
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 11, 19), "PPPP") }))
    expect(screen.getByRole("alert")).toHaveTextContent("End date cannot be before start date")
    expect(screen.getByRole("button", { name: "Save end date" })).toBeDisabled()
    expect(onUpdateEndDate).not.toHaveBeenCalled()
  })

  it("retains Amount for retry after a failed save", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    const { onUpdateAmount } = setup()
    onUpdateAmount.mockRejectedValueOnce(new Error("Unable to save"))
    const input = openAmount()
    fireEvent.change(input, { target: { value: "250" } })
    fireEvent.click(screen.getByRole("button", { name: "Save amount" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save field"))
    expect(input).toHaveValue(250)
    await waitFor(() => expect(screen.getByRole("button", { name: "Save amount" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Save amount" }))
    await waitFor(() => expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument())
  })

  it("disables save and cancel while saving Amount", async () => {
    let finish!: () => void
    const { onUpdateAmount } = setup()
    onUpdateAmount.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    openAmount()
    const save = screen.getByRole("button", { name: "Save amount" })
    fireEvent.click(save)
    expect(save).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel amount edit" })).toBeDisabled()
    fireEvent.click(save)
    expect(onUpdateAmount).toHaveBeenCalledTimes(1)
    await act(async () => finish())
  })

  it("does not open editors without update permission", () => {
    jest.mocked(useOptionalPermissions).mockReturnValue({ siteId: subscription.site_id, capabilities: null, isViewOnly: true, can: () => false })
    setup()
    fireEvent.click(screen.getAllByText("$125.00")[1])
    fireEvent.click(screen.getByText("Dec 20, 2026"))
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument()
  })
})
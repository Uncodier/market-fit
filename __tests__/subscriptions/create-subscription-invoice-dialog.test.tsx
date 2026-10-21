import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { format } from "date-fns"
import { toast } from "sonner"
import { CreateSubscriptionInvoiceDialog } from "@/app/subscriptions/components/CreateSubscriptionInvoiceDialog"
import { createSubscriptionInvoice } from "@/app/subscriptions/actions"

jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock("@/app/subscriptions/actions", () => ({ createSubscriptionInvoice: jest.fn() }))
jest.mock("@/app/components/ui/date-picker", () => ({
  DatePicker: ({ id, date, setDate, disabled }: {
    id: string; date?: Date; setDate: (date: Date) => void; disabled?: boolean
  }) => <input id={id} type="date" disabled={disabled} value={date ? format(date, "yyyy-MM-dd") : ""}
    onChange={(event) => setDate(new Date(`${event.target.value}T12:00:00`))} />,
}))
jest.mock("@/app/components/finance/DueDateField", () => ({
  DueDateField: ({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) =>
    <label>Due date<input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></label>,
}))

const props = {
  open: true, onOpenChange: jest.fn(), siteId: "site-1", subscriptionId: "subscription-1",
  defaultAmount: 125, defaultDueDate: "2026-10-15", nextBillingDate: "2026-09-30T23:00:00-05:00",
  onSuccess: jest.fn(),
}

describe("Create invoice billing period", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(createSubscriptionInvoice).mockResolvedValue({ data: { id: "invoice-1" } })
  })

  it("defaults to the UTC next billing date independently of issue date and submits both", async () => {
    render(<CreateSubscriptionInvoiceDialog {...props} />)
    expect(screen.getByLabelText("Invoice date")).toHaveValue(format(new Date(), "yyyy-MM-dd"))
    expect(screen.getByLabelText("Billing period")).toHaveValue("2026-10-01")
    fireEvent.change(screen.getByLabelText("Invoice date"), { target: { value: "2026-10-06" } })
    expect(screen.getByLabelText("Billing period")).toHaveValue("2026-10-01")
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-10-20")
    fireEvent.change(screen.getByLabelText("Billing period"), { target: { value: "2026-01-31" } })
    expect(screen.getByLabelText("Invoice date")).toHaveValue("2026-10-06")
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-10-20")
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }))
    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1))
    expect(createSubscriptionInvoice).toHaveBeenCalledWith({
      siteId: props.siteId, subscriptionId: props.subscriptionId, amount: 125,
      invoiceDate: "2026-10-06", billingDate: "2026-01-31", dueDate: "2026-10-20",
    })
  })

  it("resets the selected period to the next billing date on reopening", () => {
    const { rerender } = render(<CreateSubscriptionInvoiceDialog {...props} />)
    fireEvent.change(screen.getByLabelText("Billing period"), { target: { value: "2026-01-31" } })
    rerender(<CreateSubscriptionInvoiceDialog {...props} open={false} />)
    rerender(<CreateSubscriptionInvoiceDialog {...props} nextBillingDate="2026-11-01T00:00:00Z" />)
    expect(screen.getByLabelText("Billing period")).toHaveValue("2026-11-01")
  })

  it("does not silently use the issue date when the billing anchor is missing", () => {
    render(<CreateSubscriptionInvoiceDialog {...props} nextBillingDate={null} />)
    expect(screen.getByLabelText("Billing period")).toHaveValue("")
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }))
    expect(toast.error).toHaveBeenCalledWith("Select a valid billing period")
    expect(createSubscriptionInvoice).not.toHaveBeenCalled()
  })
})
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { toast } from "sonner"
import { LeadPaymentDialog } from "@/app/leads/components/LeadPaymentDialog"
import { getLeadOpenInvoices, registerLeadInvoicePayment } from "@/app/leads/payment-actions"
import type { LeadOpenInvoice } from "@/app/leads/payment-allocation"

let mockSiteId: string | null = "site-a"
let mockCanUpdate = true
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSiteId ? { id: mockSiteId } : null }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ can: () => mockCanUpdate }) }))
jest.mock("@/app/leads/payment-actions", () => ({ getLeadOpenInvoices: jest.fn(), registerLeadInvoicePayment: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), warning: jest.fn() } }))

const getInvoices = jest.mocked(getLeadOpenInvoices)
const registerPayment = jest.mocked(registerLeadInvoicePayment)
const invoice = (id: string, amountDue: number, saleDate: string, currency = "USD"): LeadOpenInvoice => ({
  id, title: `Invoice ${id}`, invoiceNumber: `INV-${id}`, amountDue, currency, saleDate,
  createdAt: saleDate, updatedAt: saleDate, status: "pending",
})
const invoices = [
  invoice("old", 40, "2026-08-01"),
  invoice("new", 60, "2026-10-01"),
  invoice("eur", 75, "2026-09-01", "EUR"),
]
const snapshot = { invoices, version: "a".repeat(32) }
const confirmed = { requestId: "receipt", amount: 100, currency: "USD", allocations: [] }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function setup(open = true, onSuccess = jest.fn()) {
  const props = { leadId: "lead-a", leadName: "Alex Smith", open, onOpenChange: jest.fn(), onSuccess }
  const view = render(<LeadPaymentDialog {...props} />)
  return { ...view, props }
}

async function loaded() {
  await screen.findByRole("heading", { name: "Allocation preview" })
}

function partial(amount: string) {
  fireEvent.click(screen.getByRole("radio", { name: "Add partial payment" }))
  fireEvent.change(screen.getByRole("spinbutton", { name: "Payment amount (USD)" }), { target: { value: amount } })
}

function choose(label: string, value: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown", code: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: value }))
}

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = jest.fn()
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  mockSiteId = "site-a"
  mockCanUpdate = true
  getInvoices.mockReset().mockResolvedValue({ snapshot })
  registerPayment.mockReset().mockResolvedValue({ payment: confirmed })
  let counter = 0
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: jest.fn(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`) })
})

describe("LeadPaymentDialog", () => {
  it("fetches only on open and displays currency totals and the received-payment notice", async () => {
    const { rerender, props } = setup(false)
    expect(getInvoices).not.toHaveBeenCalled()
    rerender(<LeadPaymentDialog {...props} open />)
    await loaded()
    expect(getInvoices).toHaveBeenCalledTimes(1)
    expect(getInvoices).toHaveBeenCalledWith("site-a", "lead-a")
    expect(screen.getByText(/Records a payment already received; does not charge a card/)).toBeInTheDocument()
    expect(screen.getAllByText("USD 100.00").length).toBeGreaterThan(0)
    expect(screen.getByText("EUR 75.00")).toBeInTheDocument()
    const rows = within(screen.getByRole("table")).getAllByRole("row")
    expect(rows[1]).toHaveTextContent("Invoice new")
    expect(rows[2]).toHaveTextContent("Invoice old")
    expect(screen.queryByText("Invoice eur")).not.toBeInTheDocument()
  })

  it("previews newest-first partial allocation and remaining balances", async () => {
    setup()
    await loaded()
    partial("70")
    const rows = within(screen.getByRole("table")).getAllByRole("row")
    expect(rows[1]).toHaveTextContent(/Invoice new.*USD 60.00USD 0.00/)
    expect(rows[2]).toHaveTextContent(/Invoice old.*USD 10.00USD 30.00/)
    expect(screen.getByText("Remaining balance (USD)").parentElement).toHaveTextContent("USD 30.00")
  })

  it.each(["0", "-1", "100.01", "1.001"])("rejects invalid partial amount %s", async amount => {
    setup()
    await loaded()
    partial(amount)
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled()
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(registerPayment).not.toHaveBeenCalled()
  })

  it("records full balance in the selected currency only and emits a scoped refresh", async () => {
    const event = jest.fn()
    window.addEventListener("lead:invoice-payment-recorded", event)
    const { props } = setup()
    await loaded()
    choose("Payment currency", "EUR")
    expect(screen.getByRole("table")).toHaveTextContent("Invoice eur")
    expect(screen.getByRole("table")).not.toHaveTextContent("Invoice new")
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1))
    expect(registerPayment).toHaveBeenCalledWith(expect.objectContaining({ siteId: "site-a", leadId: "lead-a", currency: "EUR", mode: "full", version: snapshot.version, method: "credit_card", notes: "" }))
    expect(registerPayment.mock.calls[0][0]).not.toHaveProperty("amount")
    expect(event.mock.calls[0][0].detail).toEqual({ siteId: "site-a", leadId: "lead-a" })
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    window.removeEventListener("lead:invoice-payment-recorded", event)
  })

  it("submits partial amount, method and trimmed notes and treats warnings as success", async () => {
    registerPayment.mockResolvedValue({ payment: confirmed, warning: "Payment recorded. Accounting needs review." })
    const { props } = setup()
    await loaded()
    partial("70.25")
    choose("Payment method", "Cash")
    fireEvent.change(screen.getByRole("textbox", { name: "Notes (optional)" }), { target: { value: "  Received in person  " } })
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await waitFor(() => expect(props.onSuccess).toHaveBeenCalled())
    expect(registerPayment).toHaveBeenCalledWith(expect.objectContaining({ mode: "partial", amount: 70.25, method: "cash", notes: "Received in person" }))
    expect(toast.warning).toHaveBeenCalledWith("Payment recorded. Accounting needs review.")
  })

  it("freezes an immutable payload on transport failure and retains it across close/reopen", async () => {
    registerPayment.mockRejectedValueOnce(new Error("Connection interrupted"))
    const { rerender, props } = setup()
    await loaded()
    partial("20")
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await screen.findByRole("button", { name: "Retry same payment" })
    const original = registerPayment.mock.calls[0][0]
    expect(Object.isFrozen(original)).toBe(true)
    expect(screen.getByRole("spinbutton")).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Payment currency" })).toBeDisabled()
    expect(screen.getByRole("textbox")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reload invoices" })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(props.onOpenChange).not.toHaveBeenCalled()
    const leave = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(leave)
    expect(leave.defaultPrevented).toBe(true)
    rerender(<LeadPaymentDialog {...props} open={false} />)
    rerender(<LeadPaymentDialog {...props} open />)
    expect(getInvoices).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Retry same payment" }))
    await waitFor(() => expect(props.onSuccess).toHaveBeenCalled())
    expect(registerPayment.mock.calls[1][0]).toBe(original)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it("retains the request ID for a returned ambiguous error", async () => {
    registerPayment.mockResolvedValueOnce({ error: "Unable to confirm the payment. Retry with the same payment details to avoid recording it twice." })
    setup()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    fireEvent.click(await screen.findByRole("button", { name: "Retry same payment" }))
    await waitFor(() => expect(registerPayment).toHaveBeenCalledTimes(2))
    expect(registerPayment.mock.calls[1][0]).toBe(registerPayment.mock.calls[0][0])
  })

  it("uses a fresh request ID after a definite rejection and changed form", async () => {
    registerPayment.mockResolvedValueOnce({ error: "Enter valid payment details." })
    setup()
    await loaded()
    partial("20")
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await screen.findByText("Enter valid payment details.")
    await waitFor(() => expect(screen.getByRole("spinbutton")).toBeEnabled())
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await waitFor(() => expect(registerPayment).toHaveBeenCalledTimes(2))
    expect(registerPayment.mock.calls[1][0].requestId).not.toBe(registerPayment.mock.calls[0][0].requestId)
    expect(registerPayment.mock.calls[1][0].amount).toBe(30)
  })

  it("requires a fresh snapshot and request ID after stale balances", async () => {
    registerPayment.mockResolvedValueOnce({ error: "Invoice balances changed. Reload the invoices and review the payment before confirming." })
    setup()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await screen.findByRole("alert")
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled()
    getInvoices.mockResolvedValue({ snapshot: { invoices: [invoice("new", 15, "2026-10-01")], version: "b".repeat(32) } })
    fireEvent.click(screen.getByRole("button", { name: "Reload invoices" }))
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    await waitFor(() => expect(registerPayment).toHaveBeenCalledTimes(2))
    expect(registerPayment.mock.calls[1][0].version).toBe("b".repeat(32))
    expect(registerPayment.mock.calls[1][0].requestId).not.toBe(registerPayment.mock.calls[0][0].requestId)
  })

  it("disables form, dismissal and duplicate submission while saving", async () => {
    const pending = deferred<Awaited<ReturnType<typeof registerLeadInvoicePayment>>>()
    registerPayment.mockReturnValue(pending.promise)
    const { props } = setup()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    expect(screen.getByRole("button", { name: "Recording…" })).toBeDisabled()
    expect(screen.getByRole("textbox")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(props.onOpenChange).not.toHaveBeenCalled()
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!)
    expect(registerPayment).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve({ payment: confirmed }))
  })

  it("shows empty and loading failure states with explicit retry", async () => {
    getInvoices.mockRejectedValueOnce(new Error("Offline"))
    setup()
    await screen.findByText(/Check your connection and retry/)
    getInvoices.mockResolvedValue({ snapshot: { invoices: [], version: snapshot.version } })
    fireEvent.click(screen.getByRole("button", { name: "Retry loading invoices" }))
    await screen.findByText("No open invoice balance")
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled()
  })

  it("ignores closed fetches and cancels old-site fetch results", async () => {
    const old = deferred<Awaited<ReturnType<typeof getLeadOpenInvoices>>>()
    getInvoices.mockReturnValueOnce(old.promise)
    const { rerender, props } = setup()
    rerender(<LeadPaymentDialog {...props} open={false} />)
    await act(async () => old.resolve({ snapshot }))
    getInvoices.mockResolvedValue({ snapshot: { invoices: [invoice("site-b-only", 9, "2026-10-01")], version: snapshot.version } })
    mockSiteId = "site-b"
    rerender(<LeadPaymentDialog {...props} open />)
    await loaded()
    expect(screen.getByRole("table")).toHaveTextContent("Invoice site-b-only")
    expect(screen.queryByText("Invoice old")).not.toBeInTheDocument()
    expect(getInvoices).toHaveBeenLastCalledWith("site-b", "lead-a")
  })

  it("ignores a late save result after a site change", async () => {
    const pending = deferred<Awaited<ReturnType<typeof registerLeadInvoicePayment>>>()
    registerPayment.mockReturnValueOnce(pending.promise)
    const { rerender, props } = setup()
    await loaded()
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }))
    mockSiteId = "site-b"
    rerender(<LeadPaymentDialog {...props} />)
    await act(async () => pending.resolve({ payment: confirmed }))
    expect(props.onSuccess).not.toHaveBeenCalled()
    expect(props.onOpenChange).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("ignores an old site's pending invoice fetch after switching sites", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getLeadOpenInvoices>>>()
    getInvoices.mockReturnValueOnce(pending.promise)
    const { rerender, props } = setup()
    mockSiteId = "site-b"
    getInvoices.mockResolvedValue({ snapshot: { invoices: [invoice("other-site", 5, "2026-10-01")], version: snapshot.version } })
    rerender(<LeadPaymentDialog {...props} />)
    await loaded()
    await act(async () => pending.resolve({ snapshot }))
    expect(screen.getByRole("table")).toHaveTextContent("Invoice other-site")
    expect(screen.queryByText("Invoice new")).not.toBeInTheDocument()
  })

  it.each(["permission", "site", "demo"])("does not fetch or save without valid %s scope", async scope => {
    if (scope === "permission") mockCanUpdate = false
    if (scope === "site") mockSiteId = null
    if (scope === "demo") mockSiteId = "demo-a"
    setup()
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled()
    expect(getInvoices).not.toHaveBeenCalled()
    expect(registerPayment).not.toHaveBeenCalled()
  })
})
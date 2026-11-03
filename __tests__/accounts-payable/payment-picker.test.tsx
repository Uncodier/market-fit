import { act, fireEvent, render, screen } from "@testing-library/react"
import useSWR from "swr"
import { SupplierBillPaymentDialog } from "@/app/accounts-payable/components/SupplierBillPaymentDialog"
import { getPayableBills } from "@/app/accounts-payable/actions"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import type { PayableAccount } from "@/app/accounts-payable/summary"
import type { Purchase } from "@/app/types"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("@/app/accounts-payable/actions", () => ({ getPayableBills: jest.fn() }))
jest.mock("@/app/bills/components/RegisterPurchasePaymentDialog", () => ({
  RegisterPurchasePaymentDialog: ({ purchase, onOpenChange, onSuccess }: {
    purchase: Purchase; onOpenChange: (open: boolean) => void; onSuccess: () => void
  }) => <div role="dialog" aria-label="Register payment">{purchase.id}
    <button onClick={() => onOpenChange(false)}>Back</button>
    <button onClick={() => { onOpenChange(false); onSuccess() }}>Save payment</button>
  </div>,
}))
const account: PayableAccount = {
  vendorId: "vendor", name: "Acme", email: null, phone: null, invoiceCount: 2,
  balances: [{ currency: "USD", amount: 100 }], earliestDueDate: null, oldestInvoiceDate: null,
  createdAt: "2026-10-01", updatedAt: "2026-10-01", bills: [{ id: "bill", title: "Supplies" }],
}
const bill = { id: "bill", title: "Supplies", siteId: "site", vendorCompanyId: "vendor", amountDue: 100, currency: "USD" } as Purchase
const mutate = jest.fn()
const close = jest.fn()
const setup = (orderFilter: "active" | "cancelled" = "active") => render(<LocalizationProvider preferredLocale="en">
  <SupplierBillPaymentDialog account={account} siteId="site" orderFilter={orderFilter} onClose={close} />
</LocalizationProvider>)

describe("supplier bill payment picker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useSWR).mockReturnValue({ data: { data: [bill] }, mutate, isLoading: false } as never)
  })

  it.each(["active", "cancelled"] as const)("loads bills for the selected supplier and %s purchase scope", async scope => {
    setup(scope)
    expect(jest.mocked(useSWR).mock.calls[0][0]).toEqual(["accounts-payable-bills", "site", "vendor", scope])
    expect(jest.mocked(useSWR).mock.calls[0][2]).toEqual({ keepPreviousData: false })
    const fetcher = jest.mocked(useSWR).mock.calls[0][1] as () => Promise<unknown>
    await act(async () => { await fetcher() })
    expect(getPayableBills).toHaveBeenCalledWith("site", "vendor", scope)
    fireEvent.click(screen.getByRole("button", { name: /Supplies/ }))
    expect(screen.getByRole("dialog", { name: "Register payment" })).toHaveTextContent("bill")
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByRole("dialog", { name: "Choose a bill" })).toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()
  })

  it("emits a site-scoped refresh event only after the existing payment dialog succeeds", () => {
    const listener = jest.fn()
    window.addEventListener("purchase:payment-recorded", listener)
    setup()
    fireEvent.click(screen.getByRole("button", { name: /Supplies/ }))
    expect(listener).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }))
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { siteId: "site" } }))
    expect(close).toHaveBeenCalledTimes(1)
    window.removeEventListener("purchase:payment-recorded", listener)
  })

  it.each(["server", "transport"])("offers retry without payment selection after a %s failure", kind => {
    jest.mocked(useSWR).mockReturnValue({ data: kind === "server" ? { data: [], error: "Denied" } : undefined,
      error: kind === "transport" ? new Error("Offline") : undefined, mutate, isLoading: false } as never)
    setup()
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Supplies/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("safely displays unknown currency and disables selection", () => {
    jest.mocked(useSWR).mockReturnValue({ data: { data: [{ ...bill, currency: "Unknown" }] }, mutate, isLoading: false } as never)
    setup()
    expect(screen.getByRole("button", { name: /100.00 \(unknown currency\)/ })).toBeDisabled()
  })

  it("shows loading and empty supplier states", () => {
    jest.mocked(useSWR).mockReturnValue({ mutate, isLoading: true } as never)
    const view = setup()
    expect(screen.getByRole("status")).toHaveTextContent("Loading bills...")
    jest.mocked(useSWR).mockReturnValue({ data: { data: [] }, mutate, isLoading: false } as never)
    view.rerender(<LocalizationProvider preferredLocale="en"><SupplierBillPaymentDialog account={account}
      siteId="site" orderFilter="active" onClose={close} /></LocalizationProvider>)
    expect(screen.getByText("No open bills remain for this supplier.")).toBeInTheDocument()
  })
})
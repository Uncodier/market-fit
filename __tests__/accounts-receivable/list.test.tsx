import { fireEvent, render, screen, within } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { AccountsReceivableList } from "@/app/accounts-receivable/components/AccountsReceivableList"
import type { ReceivableAccount } from "@/app/accounts-receivable/summary"

jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))
jest.mock("@/app/components/ui/empty-card", () => ({ EmptyCard: ({ title, description }: { title: string; description: string }) => <div>{title}{description}</div> }))
jest.mock("@/app/leads/components/LeadPaymentDialog", () => ({
  LeadPaymentDialog: ({ leadId, leadName, onOpenChange }: { leadId: string; leadName: string; onOpenChange: (open: boolean) => void }) => (
    <div role="dialog" aria-label="Settle balance / Add payment" data-lead-id={leadId}>
      {leadName}<button onClick={() => onOpenChange(false)}>Close payment</button>
    </div>
  ),
}))

const account: ReceivableAccount = {
  leadId: "lead-1", name: "Avery", email: "avery@example.test", phone: null,
  invoiceCount: 2, balances: [{ currency: "USD", amount: 125 }, { currency: "EUR", amount: 20 }],
  earliestDueDate: "2026-10-10", oldestInvoiceDate: "2026-10-01",
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
}
const push = jest.fn()
function setup(accounts = [account], siteId = "site") {
  return render(<AccountsReceivableList accounts={accounts} siteId={siteId} today="2026-10-14" />)
}
async function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Avery" }), { key: "ArrowDown" })
  return screen.findByRole("menu")
}

describe("accounts receivable cloned document list", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useRouter).mockReturnValue({ push } as never)
    jest.mocked(useOptionalPermissions).mockReturnValue(null)
  })

  it("preserves the six-column subscription table shell, horizontal scroll, totals and lead count", () => {
    setup()
    const table = screen.getByRole("table", { name: "Accounts receivable" })
    expect(table).toHaveClass("min-w-[920px]")
    expect(table.parentElement).toHaveClass("overflow-auto")
    expect(within(table).getAllByRole("columnheader").map(head => head.textContent)).toEqual([
      "Customer", "Status", "Oldest due date", "Open invoices", "Amount due", "Actions",
    ])
    expect(table.parentElement?.parentElement).toHaveClass("rounded-xl", "bg-card")
    expect(within(table).getByText("Overdue")).toBeInTheDocument()
    expect(within(table).getAllByText("$125.00")).toHaveLength(2)
    expect(within(table).getAllByText("€20.00")).toHaveLength(2)
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it.each([
    ["MXN", 715, "MX$715.00"],
    ["CAD", 570, "CA$570.00"],
    ["CHF", 65, "CHF 65.00"],
    ["JPY", 280, "¥280"],
  ])("shows %s only once in both the customer balance and total", (currency, amount, label) => {
    setup([{ ...account, balances: [{ currency, amount }] }])
    const rows = within(screen.getByRole("table", { name: "Accounts receivable" })).getAllByRole("row")
    expect(within(rows[1]).getAllByText(label)).toHaveLength(1)
    expect(within(rows[2]).getAllByText(label)).toHaveLength(1)
    expect(screen.queryByText(`${currency} ${label}`)).not.toBeInTheDocument()
  })

  it("navigates a row to the lead detail and provides a native keyboard-accessible lead link", () => {
    setup()
    expect(screen.getByRole("link", { name: /Avery/ })).toHaveAttribute("href", "/leads/lead-1")
    fireEvent.click(screen.getByText("Overdue"))
    expect(push).toHaveBeenCalledWith("/leads/lead-1")
  })

  it("offers lead navigation without any subscription lifecycle or destructive actions", async () => {
    setup()
    const menu = await openMenu()
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual([
      "View lead", "Settle balance / Add payment",
    ])
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("menuitem", { name: "View lead" }))
    expect(push).toHaveBeenCalledWith("/leads/lead-1")
  })

  it("opens the existing lead payment dialog without navigating the row", async () => {
    setup()
    await openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Settle balance / Add payment" }))
    const dialog = screen.getByRole("dialog", { name: "Settle balance / Add payment" })
    expect(dialog).toHaveAttribute("data-lead-id", "lead-1")
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Close payment" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each(["view-only", "demo"])("disables payment for %s users", async kind => {
    if (kind === "view-only") jest.mocked(useOptionalPermissions).mockReturnValue({ can: () => false } as never)
    setup([account], kind === "demo" ? "demo-site" : "site")
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Settle balance / Add payment" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("menuitem", { name: "View lead" })).not.toHaveAttribute("aria-disabled", "true")
  })

  it("renders unknown-currency balances safely and shows the cloned empty state", () => {
    const view = setup([{ ...account, balances: [{ currency: "Unknown", amount: 5 }] }])
    expect(screen.getAllByText("5.00 (unknown currency)")).toHaveLength(2)
    view.rerender(<AccountsReceivableList accounts={[]} siteId="site" today="2026-10-14" />)
    expect(screen.getByText(/No accounts receivable found/)).toBeInTheDocument()
  })
})
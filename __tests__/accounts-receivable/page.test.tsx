import { act, fireEvent, render, screen, within } from "@testing-library/react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import AccountsReceivablePage from "@/app/accounts-receivable/page"
import { getAccountsReceivable } from "@/app/accounts-receivable/actions"
import { consolidateReceivables, receivableTotals, type ReceivableAccount, type ReceivableInvoice } from "@/app/accounts-receivable/summary"
import { localeMessages } from "@/app/context/locale-catalog"

let mockLocale: "en" | "es" = "en"
const mockTranslators = {
  en: (key: string) => localeMessages.en[key] || key,
  es: (key: string) => localeMessages.es[key] || key,
}

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn(() => ({ currentSite: { id: "site" } })) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ locale: mockLocale, t: mockTranslators[mockLocale] }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn(() => false) }))
jest.mock("@/app/accounts-receivable/actions", () => ({ getAccountsReceivable: jest.fn() }))
jest.mock("@/app/subscriptions/components/SubscriptionsList", () => ({ SubscriptionsListSkeleton: () => <div role="status">Loading accounts</div> }))
jest.mock("@/app/accounts-receivable/components/AccountsReceivableList", () => ({
  AccountsReceivableList: ({ accounts }: { accounts: ReceivableAccount[] }) => <div data-testid="accounts">
    {accounts.map(account => account.name).join(", ")}
    <span data-testid="invoice-count">{accounts.reduce((sum, account) => sum + account.invoiceCount, 0)}</span>
    <span data-testid="balances">{JSON.stringify(receivableTotals(accounts))}</span>
  </div>,
}))

const mutate = jest.fn()
const account: ReceivableAccount = {
  leadId: "lead", name: "Avery", email: "avery@example.test", phone: null, invoiceCount: 1,
  balances: [{ currency: "USD", amount: 100 }], earliestDueDate: "2026-01-01", oldestInvoiceDate: "2026-01-01",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
}

describe("accounts receivable page", () => {
  beforeEach(() => {
    mockLocale = "en"
    jest.clearAllMocks()
    jest.mocked(useIsMobile).mockReturnValue(false)
    jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site" } } as never)
    jest.mocked(useSWR).mockReturnValue({ data: { data: [account, { ...account, leadId: "second", name: "Blair", earliestDueDate: null }] }, mutate, isLoading: false } as never)
  })

  it("uses a site-scoped cache and filters consolidated leads by status and search", () => {
    const view = render(<AccountsReceivablePage />)
    expect(jest.mocked(useSWR).mock.calls[0][0]).toEqual(["accounts-receivable", "site", "active"])
    expect(jest.mocked(useSWR).mock.calls[0][2]).toEqual({ keepPreviousData: false })
    expect(view.container.firstChild).toHaveClass("bg-muted/30", "h-[calc(100vh-var(--topbar-height,64px))]")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overdue" }), { button: 0, ctrlKey: false })
    expect(screen.getByTestId("accounts")).toHaveTextContent("Avery")
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Blair")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "All" }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getAllByPlaceholderText("Search accounts receivable...")[1], { target: { value: "Blair" } })
    expect(screen.getByTestId("accounts")).toHaveTextContent("Blair")
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Avery")
  })

  it("uses the same accessible mobile filter drawer as subscriptions", async () => {
    jest.mocked(useIsMobile).mockReturnValue(true)
    render(<AccountsReceivablePage />)
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const drawer = await screen.findByRole("dialog", { name: "Search" })
    expect(within(drawer).getByRole("tablist", { name: "Accounts receivable status" })).toBeInTheDocument()
    expect(within(drawer).getAllByRole("tab")).toHaveLength(5)
    expect(within(drawer).getByRole("tab", { name: "Cancelled orders" })).toBeInTheDocument()
    expect(within(drawer).getAllByPlaceholderText("Search accounts receivable...")[0]).toBeInTheDocument()
  })

  it("defaults to active orders and switches the query, counts and balances to cancelled orders only", async () => {
    const invoice: ReceivableInvoice = {
      id: "active", site_id: "site", lead_id: "lead", amount_due: 100, currency: "USD", status: "pending",
      sale_date: "2026-01-01", due_date: null, created_at: "2026-01-01T00:00:00Z", updated_at: null,
      lead: { id: "lead", site_id: "site", name: "Avery", email: null, phone: null },
      orders: [{ site_id: "site", status: "completed" }],
    }
    const invoices = [invoice, { ...invoice, id: "cancelled", amount_due: 280, currency: "MXN",
      orders: [{ site_id: "site", status: "cancelled" }] },
      { ...invoice, id: "cancelled-only", lead_id: "second", lead: { ...invoice.lead!, id: "second", name: "Blair" },
        amount_due: 140, currency: "MXN", orders: [{ site_id: "site", status: "cancelled" }] }]
    jest.mocked(useSWR).mockImplementation(key => ({ data: { data: consolidateReceivables(invoices, "site",
      (key as string[])[2] === "cancelled" ? "cancelled" : "active") }, mutate, isLoading: false }) as never)
    render(<AccountsReceivablePage />)
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Blair")
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("1")
    expect(screen.getByTestId("balances")).toHaveTextContent('[{"currency":"USD","amount":100}]')
    const fetcher = jest.mocked(useSWR).mock.calls.at(-1)![1] as () => Promise<unknown>
    await act(async () => { await fetcher() })
    expect(getAccountsReceivable).toHaveBeenLastCalledWith("site", "active")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Cancelled orders" }), { button: 0, ctrlKey: false })
    expect(jest.mocked(useSWR).mock.calls.at(-1)![0]).toEqual(["accounts-receivable", "site", "cancelled"])
    expect(jest.mocked(useSWR).mock.calls.at(-1)![2]).toEqual({ keepPreviousData: false })
    expect(screen.getByTestId("accounts")).toHaveTextContent("Blair")
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("2")
    expect(screen.getByTestId("balances")).toHaveTextContent('[{"currency":"MXN","amount":420}]')
    const cancelledFetcher = jest.mocked(useSWR).mock.calls.at(-1)![1] as () => Promise<unknown>
    await act(async () => { await cancelledFetcher() })
    expect(getAccountsReceivable).toHaveBeenLastCalledWith("site", "cancelled")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "No due date" }), { button: 0, ctrlKey: false })
    expect(jest.mocked(useSWR).mock.calls.at(-1)![0]).toEqual(["accounts-receivable", "site", "active"])
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Blair")
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("1")
    expect(screen.getByTestId("balances")).not.toHaveTextContent("MXN")
  })

  it("refreshes only for payments recorded in the active site", () => {
    const view = render(<AccountsReceivablePage />)
    act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId: "foreign" } })))
    expect(mutate).not.toHaveBeenCalled()
    act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId: "site" } })))
    expect(mutate).toHaveBeenCalledTimes(1)
    view.unmount()
    act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId: "site" } })))
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it.each(["server", "transport"])("shows retry instead of empty balances after a %s failure", kind => {
    jest.mocked(useSWR).mockReturnValue({ mutate, data: kind === "server" ? { data: [], error: "Access denied" } : undefined,
      error: kind === "transport" ? new Error("Connection failed") : undefined, isLoading: false } as never)
    render(<AccountsReceivablePage />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByTestId("accounts")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("renders the existing subscriptions skeleton while loading", () => {
    jest.mocked(useSWR).mockReturnValue({ mutate, isLoading: true } as never)
    render(<AccountsReceivablePage />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading accounts")
  })

  it("updates status labels, search and breadcrumbs in Spanish without mutating the data cache", () => {
    const dispatch = jest.spyOn(window, "dispatchEvent")
    const view = render(<AccountsReceivablePage />)
    mockLocale = "es"
    view.rerender(<AccountsReceivablePage />)
    expect(screen.getByRole("tab", { name: "Pedidos cancelados" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Sin fecha de vencimiento" })).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText("Buscar cuentas por cobrar...")).toHaveLength(2)
    expect(jest.mocked(useSWR).mock.calls.at(-1)![0]).toEqual(["accounts-receivable", "site", "active"])
    expect(mutate).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { title: "Cuentas por cobrar", parent: null } }))
    dispatch.mockRestore()
  })

  it("translates a known server error and keeps retry behavior", () => {
    mockLocale = "es"
    jest.mocked(useSWR).mockReturnValue({ mutate, data: { data: [], error: "Unable to access accounts receivable" }, isLoading: false } as never)
    render(<AccountsReceivablePage />)
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo acceder a las cuentas por cobrar")
    fireEvent.click(screen.getByRole("button", { name: localeMessages.es["common.retry"] }))
    expect(mutate).toHaveBeenCalledTimes(1)
  })
})
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import AccountsPayablePage from "@/app/accounts-payable/page"
import { getAccountsPayable } from "@/app/accounts-payable/actions"
import { loadDemoAccountsPayable } from "@/lib/demo-data/accounts-payable"
import { consolidatePayables, payableTotals, type PayableAccount, type PayableInvoice } from "@/app/accounts-payable/summary"
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
jest.mock("@/app/accounts-payable/actions", () => ({ getAccountsPayable: jest.fn() }))
jest.mock("@/lib/demo-data/accounts-payable", () => ({ loadDemoAccountsPayable: jest.fn() }))
jest.mock("@/app/subscriptions/components/SubscriptionsList", () => ({ SubscriptionsListSkeleton: () => <div role="status">Loading accounts</div> }))
jest.mock("@/app/accounts-payable/components/AccountsPayableList", () => ({
  AccountsPayableList: ({ accounts }: { accounts: PayableAccount[] }) => <div data-testid="accounts">
    {accounts.map(account => account.name).join(", ")}
    <span data-testid="invoice-count">{accounts.reduce((sum, account) => sum + account.invoiceCount, 0)}</span>
    <span data-testid="balances">{JSON.stringify(payableTotals(accounts))}</span>
  </div>,
}))

const mutate = jest.fn()
const account: PayableAccount = {
  vendorId: "lead", name: "Avery", email: "avery@example.test", phone: null, bills: [{ id: "bill", title: "Supplies" }], invoiceCount: 1,
  balances: [{ currency: "USD", amount: 100 }], earliestDueDate: "2026-01-01", oldestInvoiceDate: "2026-01-01",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
}

describe("accounts payable page", () => {
  beforeEach(() => {
    mockLocale = "en"
    jest.clearAllMocks()
    jest.mocked(useIsMobile).mockReturnValue(false)
    jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site" } } as never)
    jest.mocked(useSWR).mockReturnValue({ data: { data: [account, { ...account, vendorId: "second", name: "Blair", earliestDueDate: null }] }, mutate, isLoading: false } as never)
  })

  it("uses a site-scoped cache and filters consolidated suppliers by status and search", () => {
    const view = render(<AccountsPayablePage />)
    expect(jest.mocked(useSWR).mock.calls[0][0]).toEqual(["accounts-payable", "site", "active"])
    expect(jest.mocked(useSWR).mock.calls[0][2]).toEqual({ keepPreviousData: false })
    expect(view.container.firstChild).toHaveClass("bg-muted/30", "h-[calc(100vh-var(--topbar-height,64px))]")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overdue" }), { button: 0, ctrlKey: false })
    expect(screen.getByTestId("accounts")).toHaveTextContent("Avery")
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Blair")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "All" }), { button: 0, ctrlKey: false })
    fireEvent.change(screen.getAllByPlaceholderText("Search accounts payable...")[1], { target: { value: "Blair" } })
    expect(screen.getByTestId("accounts")).toHaveTextContent("Blair")
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Avery")
  })

  it("uses the same accessible mobile filter drawer as subscriptions", async () => {
    jest.mocked(useIsMobile).mockReturnValue(true)
    render(<AccountsPayablePage />)
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const drawer = await screen.findByRole("dialog", { name: "Search" })
    expect(within(drawer).getByRole("tablist", { name: "Accounts payable status" })).toBeInTheDocument()
    expect(within(drawer).getAllByRole("tab")).toHaveLength(5)
    expect(within(drawer).getByRole("tab", { name: "Cancelled purchases" })).toBeInTheDocument()
    expect(within(drawer).getAllByPlaceholderText("Search accounts payable...")[0]).toBeInTheDocument()
  })

  it("defaults to active purchases and switches the query, counts and balances to cancelled purchases only", async () => {
    const invoice: PayableInvoice = {
      id: "active", title: "Supplies", site_id: "site", vendor_company_id: "lead", amount_due: 100, currency: "USD", status: "pending",
      purchase_date: "2026-01-01", due_date: null, created_at: "2026-01-01T00:00:00Z", updated_at: null,
      vendor: { id: "lead", name: "Avery", email: null },
    }
    const invoices = [invoice, { ...invoice, id: "cancelled", amount_due: 280, currency: "MXN",
      status: "cancelled" },
      { ...invoice, id: "cancelled-only", vendor_company_id: "second", vendor: { ...invoice.vendor!, id: "second", name: "Blair" },
        amount_due: 140, currency: "MXN", status: "cancelled" }]
    jest.mocked(useSWR).mockImplementation(key => ({ data: { data: consolidatePayables(invoices, "site",
      (key as string[])[2] === "cancelled" ? "cancelled" : "active") }, mutate, isLoading: false }) as never)
    render(<AccountsPayablePage />)
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Blair")
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("1")
    expect(screen.getByTestId("balances")).toHaveTextContent('[{"currency":"USD","amount":100}]')
    const fetcher = jest.mocked(useSWR).mock.calls.at(-1)![1] as () => Promise<unknown>
    await act(async () => { await fetcher() })
    expect(getAccountsPayable).toHaveBeenLastCalledWith("site", "active")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Cancelled purchases" }), { button: 0, ctrlKey: false })
    expect(jest.mocked(useSWR).mock.calls.at(-1)![0]).toEqual(["accounts-payable", "site", "cancelled"])
    expect(jest.mocked(useSWR).mock.calls.at(-1)![2]).toEqual({ keepPreviousData: false })
    expect(screen.getByTestId("accounts")).toHaveTextContent("Blair")
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("2")
    expect(screen.getByTestId("balances")).toHaveTextContent('[{"currency":"MXN","amount":420}]')
    const cancelledFetcher = jest.mocked(useSWR).mock.calls.at(-1)![1] as () => Promise<unknown>
    await act(async () => { await cancelledFetcher() })
    expect(getAccountsPayable).toHaveBeenLastCalledWith("site", "cancelled")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "No due date" }), { button: 0, ctrlKey: false })
    expect(jest.mocked(useSWR).mock.calls.at(-1)![0]).toEqual(["accounts-payable", "site", "active"])
    expect(screen.getByTestId("accounts")).not.toHaveTextContent("Blair")
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("1")
    expect(screen.getByTestId("balances")).not.toHaveTextContent("MXN")
  })

  it("refreshes only for payments recorded in the active site", () => {
    const view = render(<AccountsPayablePage />)
    act(() => window.dispatchEvent(new CustomEvent("purchase:payment-recorded", { detail: { siteId: "foreign" } })))
    expect(mutate).not.toHaveBeenCalled()
    act(() => window.dispatchEvent(new CustomEvent("purchase:payment-recorded", { detail: { siteId: "site" } })))
    expect(mutate).toHaveBeenCalledTimes(1)
    view.unmount()
    act(() => window.dispatchEvent(new CustomEvent("purchase:payment-recorded", { detail: { siteId: "site" } })))
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("loads demo balances without calling real actions, including cancelled purchases", async () => {
    jest.mocked(useSite).mockReturnValue({ currentSite: { id: "demo-habituall" } } as never)
    jest.mocked(loadDemoAccountsPayable).mockResolvedValue({ data: [account] })
    render(<AccountsPayablePage />)
    const fetchDemo = async () => {
      const fetcher = jest.mocked(useSWR).mock.calls.at(-1)![1] as () => Promise<unknown>
      await act(async () => { await fetcher() })
    }
    await fetchDemo()
    expect(loadDemoAccountsPayable).toHaveBeenLastCalledWith("demo-habituall", "active")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Cancelled purchases" }), { button: 0, ctrlKey: false })
    await fetchDemo()
    expect(loadDemoAccountsPayable).toHaveBeenLastCalledWith("demo-habituall", "cancelled")
    expect(getAccountsPayable).not.toHaveBeenCalled()
  })

  it.each(["server", "transport"])("shows retry instead of empty balances after a %s failure", kind => {
    jest.mocked(useSWR).mockReturnValue({ mutate, data: kind === "server" ? { data: [], error: "Access denied" } : undefined,
      error: kind === "transport" ? new Error("Connection failed") : undefined, isLoading: false } as never)
    render(<AccountsPayablePage />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByTestId("accounts")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("renders the existing subscriptions skeleton while loading", () => {
    jest.mocked(useSWR).mockReturnValue({ mutate, isLoading: true } as never)
    render(<AccountsPayablePage />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading accounts")
  })

  it("updates status labels, search and breadcrumbs in Spanish without mutating the data cache", () => {
    const dispatch = jest.spyOn(window, "dispatchEvent")
    const view = render(<AccountsPayablePage />)
    mockLocale = "es"
    view.rerender(<AccountsPayablePage />)
    expect(screen.getByRole("tab", { name: "Compras canceladas" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Sin fecha de vencimiento" })).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText("Buscar cuentas por pagar...")).toHaveLength(2)
    expect(jest.mocked(useSWR).mock.calls.at(-1)![0]).toEqual(["accounts-payable", "site", "active"])
    expect(mutate).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { title: "Cuentas por pagar", parent: null } }))
    dispatch.mockRestore()
  })

  it("translates a known server error and keeps retry behavior", () => {
    mockLocale = "es"
    jest.mocked(useSWR).mockReturnValue({ mutate, data: { data: [], error: "Unable to access accounts payable" }, isLoading: false } as never)
    render(<AccountsPayablePage />)
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo acceder a las cuentas por pagar")
    fireEvent.click(screen.getByRole("button", { name: localeMessages.es["common.retry"] }))
    expect(mutate).toHaveBeenCalledTimes(1)
  })
})
import { fireEvent, render, screen, within } from "@testing-library/react"
import { SalesFinancialSummary } from "@/app/components/dashboard/sales-financial-summary"
import type { SalesMetric, SalesReportData } from "@/lib/sales/report-types"

const metric = (actual: number, previous = 0): SalesMetric => ({
  actual, previous, percentChange: previous === 0 ? actual === 0 ? 0 : null : (actual - previous) / previous * 100,
})

function report(): SalesReportData {
  return {
    currency: "EUR", availableCurrencies: ["EUR"], periodType: "custom", noData: false,
    totalSales: { ...metric(1000, 800), formattedActual: "1000", formattedPrevious: "800" },
    transactions: metric(4), averageOrderValue: metric(250),
    channelSales: { online: { amount: 1000, prevAmount: 800, percentChange: 25 }, retail: { amount: 0, prevAmount: 0, percentChange: 0 }, other: { amount: 0, prevAmount: 0, percentChange: 0 } },
    salesCategories: [], monthlyData: [], salesDistribution: [],
    financialSummary: {
      receipts: metric(400, 100), refunds: metric(50), netCollected: metric(350, 100),
      outstanding: { amount: 350, saleCount: 4, unknownSaleCount: 0 },
      paymentStatus: { paid: { count: 1, amount: 400 }, partial: { count: 2, amount: 500 }, unpaid: { count: 1, amount: 100 }, unknown: { count: 0, amount: 0 } },
      excluded: { count: 2, amount: 150 }, cashIssues: 0,
    },
    metadata: { startDate: "2025-02-01", endDate: "2025-02-02", prevStartDate: "2025-01-30", prevEndDate: "2025-01-31", segmentId: "all", basis: "Active sales", dateBasis: "Sale dates and UTC movement dates", categoriesIncluded: false },
  }
}

const card = (title: string) => screen.getByRole("heading", { name: title }).closest("[data-report-kpi]") as HTMLElement
const value = (title: string) => card(title).querySelector('[data-kpi-slot="value"]')

describe("sales financial summary", () => {
  it("leads with cash, active sales and current outstanding while retaining sale count and average", () => {
    render(<SalesFinancialSummary data={report()} />)
    expect(screen.getAllByRole("heading").map(heading => heading.textContent)).toEqual(["Net collected", "Active sales", "Outstanding balance"])
    expect(value("Net collected")).toHaveTextContent(/EUR\s350.00/)
    expect(value("Active sales")).toHaveTextContent(/EUR\s1,000.00/)
    expect(value("Outstanding balance")).toHaveTextContent(/EUR\s350.00/)
    expect(card("Net collected")).toHaveTextContent(/Received: EUR\s400.00 · Refunded: EUR\s50.00/)
    expect(card("Net collected")).toHaveTextContent("+250.0% from previous period")
    expect(card("Active sales")).toHaveTextContent(/4 sales · Average sale: EUR\s250.00/)
    expect(card("Active sales")).toHaveTextContent("+25.0% from previous period")
    expect(card("Outstanding balance")).toHaveTextContent("Current balance; no period comparison")
    expect(card("Outstanding balance")).toHaveTextContent("Selected-period active sales: 4")
    expect(card("Outstanding balance")).not.toHaveTextContent(/%|previous period/)
    expect(screen.getByText(/Cash received and refunded follow each UTC movement date/)).toBeVisible()
    expect(screen.getByText(/not a historical end-date balance/)).toBeVisible()
  })

  it("discloses current payment statuses as sale amounts, not cash or balances, and excludes mixed cancelled orders", () => {
    render(<SalesFinancialSummary data={report()} />)
    const disclosure = screen.getByText("Current payment status and excluded sales")
    expect(disclosure.closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText("Partially paid")).not.toBeVisible()
    fireEvent.click(disclosure)
    expect(disclosure.closest("details")).toHaveAttribute("open")
    const statuses = screen.getByLabelText("Current payment status")
    expect(within(statuses).getByText("Paid").parentElement).toHaveTextContent(/1 sale · EUR\s400.00/)
    expect(within(statuses).getByText("Partially paid").parentElement).toHaveTextContent(/2 sales · EUR\s500.00/)
    expect(within(statuses).getByText("Unpaid").parentElement).toHaveTextContent(/1 sale · EUR\s100.00/)
    expect(within(statuses).getByText("Unknown").parentElement).toHaveTextContent(/0 sales · EUR\s0.00/)
    expect(screen.getByText(/Amounts below are full sale amounts, not receipts or outstanding balances/)).toBeVisible()
    expect(screen.getByText(/Excluded sales: 2 · EUR\s150.00/)).toBeVisible()
    expect(screen.getByText(/even when other linked orders are active/)).toBeVisible()
  })

  it("shows unavailable cash and full outstanding instead of zero when history and some balances are unknown", () => {
    const data = report()
    data.financialSummary = { ...data.financialSummary!, receipts: null, refunds: null, netCollected: null,
      outstanding: { amount: null, saleCount: 4, unknownSaleCount: 1 }, cashIssues: 3,
      paymentStatus: { ...data.financialSummary!.paymentStatus, partial: { count: 1, amount: 200 }, unknown: { count: 1, amount: 300 } } }
    render(<SalesFinancialSummary data={data} />)
    expect(value("Net collected")).toHaveTextContent(/^Unavailable$/)
    expect(value("Outstanding balance")).toHaveTextContent(/^Unavailable$/)
    expect(card("Net collected")).toHaveTextContent("Received: Unavailable · Refunded: Unavailable")
    expect(card("Net collected")).not.toHaveTextContent(/EUR|%|previous period/)
    expect(card("Outstanding balance")).not.toHaveTextContent(/EUR|%|previous period/)
    expect(card("Outstanding balance")).toHaveTextContent("1 sale with unknown balance")
    expect(screen.getByRole("status")).toHaveTextContent("incomplete history, not zero cash")
    expect(screen.getByRole("status")).toHaveTextContent("Cash history issues: 3")
    expect(screen.getByText(/The full outstanding balance is unavailable/)).toBeVisible()
    expect(value("Active sales")).toHaveTextContent(/EUR\s1,000.00/)
    fireEvent.click(screen.getByText("Current payment status and excluded sales"))
    expect(screen.getByText("Unknown").parentElement).toHaveTextContent(/1 sale · EUR\s300.00/)
  })

  it.each(["receipts", "refunds"] as const)("preserves independently available data when %s is unavailable without deriving missing cash", (missing) => {
    const data = report()
    data.financialSummary = { ...data.financialSummary!, [missing]: null, netCollected: null, cashIssues: 1 }
    render(<SalesFinancialSummary data={data} />)
    expect(value("Net collected")).toHaveTextContent(/^Unavailable$/)
    expect(card("Net collected")).toHaveTextContent(missing === "receipts"
      ? /Received: Unavailable · Refunded: EUR\s50.00/ : /Received: EUR\s400.00 · Refunded: Unavailable/)
    expect(value("Outstanding balance")).toHaveTextContent(/EUR\s350.00/)
    expect(screen.getByRole("status")).toHaveTextContent("Cash history issues: 1")
  })

  it("does not infer cash, balance or payment status from a legacy response", () => {
    const data = report()
    delete data.financialSummary
    render(<SalesFinancialSummary data={data} />)
    expect(value("Net collected")).toHaveTextContent(/^Unavailable$/)
    expect(value("Outstanding balance")).toHaveTextContent(/^Unavailable$/)
    expect(card("Net collected")).toHaveTextContent("Received: Unavailable · Refunded: Unavailable")
    expect(card("Outstanding balance")).not.toHaveTextContent(/0|%/)
    expect(screen.getByRole("status")).toHaveTextContent("sale amounts are not a substitute")
    expect(screen.getByText(/Payment status and exclusion totals are unavailable/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Current payment status")).not.toBeInTheDocument()
    expect(card("Active sales")).toHaveTextContent(/4 sales · Average sale: EUR\s250.00/)
  })

  it("keeps known movement-date cash when the current sale-cohort balance is unavailable", () => {
    const data = report()
    data.financialSummary = { ...data.financialSummary!, outstanding: { amount: null, saleCount: 4, unknownSaleCount: 1 },
      paymentStatus: { ...data.financialSummary!.paymentStatus, partial: { count: 1, amount: 200 }, unknown: { count: 1, amount: 300 } } }
    render(<SalesFinancialSummary data={data} />)
    expect(value("Net collected")).toHaveTextContent(/EUR\s350.00/)
    expect(value("Outstanding balance")).toHaveTextContent(/^Unavailable$/)
    expect(card("Outstanding balance")).not.toHaveTextContent(/%|previous period/)
    expect(screen.getByText(/The full outstanding balance is unavailable/)).toBeVisible()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("renders an explicitly known zero current balance and zero cash, without a historical comparison", () => {
    const data = report()
    data.financialSummary = { ...data.financialSummary!, receipts: metric(0), refunds: metric(0), netCollected: metric(0),
      outstanding: { amount: 0, saleCount: 4, unknownSaleCount: 0 },
      paymentStatus: { paid: { count: 4, amount: 1000 }, partial: { count: 0, amount: 0 }, unpaid: { count: 0, amount: 0 }, unknown: { count: 0, amount: 0 } } }
    render(<SalesFinancialSummary data={data} />)
    expect(value("Net collected")).toHaveTextContent(/EUR\s0.00/)
    expect(value("Outstanding balance")).toHaveTextContent(/EUR\s0.00/)
    expect(card("Outstanding balance")).not.toHaveTextContent(/%|previous period/)
    expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("does not invent a cash growth percentage when the previous period is zero", () => {
    const data = report()
    data.financialSummary = { ...data.financialSummary!, receipts: metric(350), refunds: metric(0), netCollected: metric(350) }
    render(<SalesFinancialSummary data={data} />)
    expect(value("Net collected")).toHaveTextContent(/EUR\s350.00/)
    expect(card("Net collected")).toHaveTextContent("Not comparable (zero baseline)")
    expect(card("Net collected")).not.toHaveTextContent("%")
  })
})
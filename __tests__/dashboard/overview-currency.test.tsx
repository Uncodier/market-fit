import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { OverviewCurrencyScope } from "@/app/dashboard/OverviewCurrencyScope"
import { ReportDataProvider, useReportDataContext } from "@/app/dashboard/ReportDataContext"
import { useDashboardOverview } from "@/app/hooks/use-dashboard-batches"

let mockSite = "site-a"
let mockSiteCurrency: string | undefined
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSite, settings: { currency: mockSiteCurrency } } }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useDashboardOverview: jest.fn() }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) =>
    <select aria-label="Reporting currency" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => <option value="">Select a currency</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

const filters = { startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), segmentId: "all" }
function Consumer() {
  const { currency, overviewGroup } = useReportDataContext()
  return <div data-testid="scope">{overviewGroup}:{currency || "unselected"}</div>
}
function Page({ enabled = true, ...overrides }: Partial<typeof filters> & { enabled?: boolean }) {
  return <ReportDataProvider value={{ overviewGroup: "summary" }}><OverviewCurrencyScope enabled={enabled} {...filters} {...overrides}>
    <Consumer />
  </OverviewCurrencyScope></ReportDataProvider>
}

beforeEach(() => {
  mockSite = "site-a"
  mockSiteCurrency = undefined
  jest.mocked(useDashboardOverview).mockReturnValue({ error: Object.assign(new Error("Choose currency"), {
    availableCurrencies: ["EUR", "MXN", "USD"],
  }) } as ReturnType<typeof useDashboardOverview>)
})

it("uses the site currency before the report resolves", () => {
  mockSiteCurrency = "MXN"
  jest.mocked(useDashboardOverview).mockReturnValue({ isLoading: true } as ReturnType<typeof useDashboardOverview>)
  render(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:MXN")
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
})

it("normalizes the site default and lets a manual selection override settings updates", () => {
  mockSiteCurrency = " mxn "
  const { rerender } = render(<Page />)
  expect(screen.getByRole("combobox")).toHaveValue("MXN")
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "USD" } })
  mockSiteCurrency = "EUR"
  rerender(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:USD")
  expect(screen.getByRole("combobox")).toHaveValue("USD")
})

it("uses the new site's default instead of the previous site's manual selection", () => {
  mockSiteCurrency = "MXN"
  const { rerender } = render(<Page />)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "USD" } })
  mockSite = "site-b"
  mockSiteCurrency = "EUR"
  rerender(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:EUR")
  expect(screen.getByRole("combobox")).toHaveValue("EUR")
})

it.each([
  { segmentId: "segment-b" },
  { startDate: new Date("2026-09-02") },
  { endDate: new Date("2026-09-30") },
])("returns to the site default for a new filter scope: %o", overrides => {
  mockSiteCurrency = "MXN"
  const { rerender } = render(<Page />)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "USD" } })
  rerender(<Page {...overrides} />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:MXN")
})

it.each([undefined, "", "   ", "invalid", "UNSPECIFIED"])("does not invent a default for invalid or missing site currency: %s", value => {
  mockSiteCurrency = value
  render(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:unselected")
  expect(screen.getByRole("combobox")).toHaveValue("")
})

it("updates the default when site settings finish loading", () => {
  const { rerender } = render(<Page />)
  mockSiteCurrency = "MXN"
  rerender(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:MXN")
})

it("keeps the default labeled and other currencies selectable when there are no matching sales", () => {
  mockSiteCurrency = "MXN"
  jest.mocked(useDashboardOverview).mockReturnValue({
    status: "ready", isLoading: false, isValidating: false, error: undefined, mutate: jest.fn(),
    data: { revenue: { currency: "MXN", availableCurrencies: ["USD"] } },
  })
  render(<Page />)
  expect(screen.getByRole("combobox")).toHaveValue("MXN")
  expect(screen.getAllByRole("option").map(option => option.getAttribute("value"))).toEqual(["", "MXN", "USD"])
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "USD" } })
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:USD")
})

it("does not add a currency scope or selector to disabled sections", () => {
  mockSiteCurrency = "MXN"
  render(<Page enabled={false} />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:unselected")
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
})

it("lets a mixed-currency summary choose a currency and clears selection for a new site", () => {
  jest.mocked(useDashboardOverview).mockReturnValue({ error: Object.assign(new Error("Choose currency"), { availableCurrencies: ["EUR", "USD"] }) } as ReturnType<typeof useDashboardOverview>)
  const { rerender } = render(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:unselected")
  fireEvent.change(screen.getByRole("combobox", { name: "Reporting currency" }), { target: { value: "EUR" } })
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:EUR")
  mockSite = "site-b"
  rerender(<Page />)
  expect(screen.getByTestId("scope")).toHaveTextContent("summary:unselected")
})
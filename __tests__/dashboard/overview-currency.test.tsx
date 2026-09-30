import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { OverviewCurrencyScope } from "@/app/dashboard/OverviewCurrencyScope"
import { ReportDataProvider, useReportDataContext } from "@/app/dashboard/ReportDataContext"
import { useDashboardOverview } from "@/app/hooks/use-dashboard-batches"

let mockSite = "site-a"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSite } }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useDashboardOverview: jest.fn() }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => <select aria-label="Reporting currency" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => <option value="">Select a currency</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))

const filters = { startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), segmentId: "all" }
function Consumer() {
  const { currency, overviewGroup } = useReportDataContext()
  return <div data-testid="scope">{overviewGroup}:{currency || "unselected"}</div>
}
function Page() {
  return <ReportDataProvider value={{ overviewGroup: "summary" }}><OverviewCurrencyScope enabled {...filters}>
    <Consumer />
  </OverviewCurrencyScope></ReportDataProvider>
}

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
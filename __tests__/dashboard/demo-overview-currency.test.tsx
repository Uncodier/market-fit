import React from "react"
import { render, screen } from "@testing-library/react"
import { OverviewCurrencyScope } from "@/app/dashboard/OverviewCurrencyScope"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "demo-habituall" } }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useDashboardOverview: () => ({
  data: { revenue: { currency: "MXN", availableCurrencies: ["MXN", "USD"] } },
}) }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ value, children }: { value: string; children: React.ReactNode }) =>
    <select aria-label="Reporting currency" value={value} onChange={() => {}}>{children}</select>,
  SelectTrigger: () => <option value="">Select a currency</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

it("labels the currency already used by a demo summary before any manual selection", () => {
  render(<OverviewCurrencyScope enabled startDate={new Date(2026, 9, 1)} endDate={new Date(2026, 9, 7)} segmentId="all">
    <div>Summary</div>
  </OverviewCurrencyScope>)
  expect(screen.getByRole("combobox", { name: "Reporting currency" })).toHaveValue("MXN")
})
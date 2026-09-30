import React from "react"
import { render, screen } from "@testing-library/react"
import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import { RevenueWidget } from "@/app/components/dashboard/revenue-widget"
import { OverviewSalesTrend } from "@/app/dashboard/OverviewSalesTrend"
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches"
import { salesReportPeriod } from "@/lib/sales/report-period"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useOverviewSlice: jest.fn() }))

it.each(["MXN", "EUR"])("shows the site currency %s in both the empty revenue KPI and trend", async siteCurrency => {
  const data = await buildSalesReport({ from: jest.fn() }, [],
    salesReportPeriod(new URLSearchParams({ startDate: "2026-08-31", endDate: "2026-09-29" })),
    { currency: null, siteCurrency, segmentId: "all", includeCategories: false })
  jest.mocked(useOverviewSlice).mockReturnValue({ data, isLoading: false, error: undefined, mutate: jest.fn() })
  const filters = { startDate: new Date(2026, 7, 31), endDate: new Date(2026, 8, 29), segmentId: "all" }

  render(<><RevenueWidget {...filters} /><OverviewSalesTrend {...filters} /></>)

  expect(screen.getByText(new RegExp(`${siteCurrency}\\s0\\.00`))).toBeInTheDocument()
  expect(screen.getByText(`Amounts in ${siteCurrency}.`)).toBeInTheDocument()
  expect(screen.getByText("No active sales amount in this period")).toBeInTheDocument()
  expect(screen.queryByText(/currency unspecified/i)).not.toBeInTheDocument()
})
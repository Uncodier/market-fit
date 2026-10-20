import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { subDays, format } from "date-fns"
import { availableDemos } from "@/lib/demo-data"
import { useSalesReport } from "@/app/components/dashboard/sales/use-sales-report"
import { ReportExportScope } from "@/app/dashboard/export/ReportExportScope"
import { getReportExportSnapshot } from "@/app/dashboard/export/report-export-store"
import { downloadReportExport } from "@/app/dashboard/export/report-export-csv"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"
import { ReportExportButton } from "@/app/components/navigation/ReportExportButton"

jest.mock("@/app/dashboard/export/report-export-csv", () => ({
  downloadReportExport: jest.fn(), reportExportCsv: jest.fn(() => "demo csv"), reportExportFilename: () => "demo.csv",
}))
let mockSiteId = availableDemos[0].id
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }) }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: null, isLoading: true }) }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))
jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams("tab=sales&section=categories") }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
const start = subDays(new Date(), 29)
const end = new Date()
const fetchMock = fetch as jest.Mock
const auth = { user: null, isLoading: true } as AuthContextValue

function Resource() { useSalesReport(start, end, "all", "", true); return null }
function Scope() {
  return <AuthContext.Provider value={auth}><SWRConfig value={{ provider: () => new Map() }}>
    <ReportExportScope report="sales" section="categories" siteId={mockSiteId} siteName={mockSiteId}
      segmentId="all" segmentName="All segments" startDate={format(start, "yyyy-MM-dd")} endDate={format(end, "yyyy-MM-dd")}>
      <ReportExportButton /><Resource />
    </ReportExportScope>
  </SWRConfig></AuthContext.Provider>
}

beforeEach(() => { fetchMock.mockReset(); jest.mocked(downloadReportExport).mockClear() })

it.each(availableDemos)("exports loaded anonymous demo data: $id", async ({ id }) => {
  mockSiteId = id
  const { unmount } = render(<Scope />)
  await waitFor(() => expect(getReportExportSnapshot()?.ready).toBe(true))
  expect(getReportExportSnapshot()?.siteId).toBe(id)
  expect(getReportExportSnapshot()?.userId).toBe(id)
  expect(screen.getByRole("button", { name: "Export current section (CSV)" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "Export current section (CSV)" }))
  expect(downloadReportExport).toHaveBeenCalledWith("demo csv", "demo.csv")
  expect(fetchMock).not.toHaveBeenCalled()
  unmount()
})
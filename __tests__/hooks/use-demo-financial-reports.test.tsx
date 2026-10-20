import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { subDays } from "date-fns"
import { availableDemos } from "@/lib/demo-data"
import { useSalesReport } from "@/app/components/dashboard/sales/use-sales-report"
import { useCostReport } from "@/app/components/dashboard/use-cost-report"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"

let mockSiteId = availableDemos[0].id
let mockUser: { id: string } | null = null
let mockAuthLoading = false
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }) }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))
const end = new Date()
const start = subDays(end, 29)
const fetchMock = fetch as jest.Mock

function wrapper() {
  const cache = new Map()
  return function Scope({ children }: { children: React.ReactNode }) {
    return <AuthContext.Provider value={{ user: mockUser, isLoading: mockAuthLoading } as AuthContextValue}>
      <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
    </AuthContext.Provider>
  }
}

beforeEach(() => { fetchMock.mockReset(); mockUser = null; mockAuthLoading = false })

describe.each(availableDemos)("local financial hooks: $id", ({ id }) => {
  it.each([false, true])("loads Sales and Costs while real authentication loading is %s", async loading => {
    mockSiteId = id
    mockAuthLoading = loading
    const { result } = renderHook(() => ({
      sales: useSalesReport(start, end, "all", "", true),
      costs: useCostReport(mockSiteId, start, end, "all", "all", true),
    }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.sales.data?.totalSales.actual).toBeGreaterThan(0))
    await waitFor(() => expect(result.current.costs.costs.data?.totalCosts.actual).toBeGreaterThan(0))
    await waitFor(() => expect(result.current.costs.revenue.data?.totalSales.actual).toBeGreaterThan(0))
    expect(result.current.sales.data?.salesCategories.length).toBeGreaterThan(0)
    expect(result.current.costs.revenue.data?.currency).toBe(result.current.costs.costs.data?.currency)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it("does not keep demo figures when switching to unknown or signed-out real sites", async () => {
  mockSiteId = availableDemos[0].id
  const { result, rerender } = renderHook(() => ({
    sales: useSalesReport(start, end, "all", "", true),
    costs: useCostReport(mockSiteId, start, end, "all", "all", true),
  }), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.sales.data).toBeDefined())
  for (const id of ["demo-unknown", "real-site"]) {
    mockSiteId = id
    rerender()
    expect(result.current.sales.data).toBeUndefined()
    expect(result.current.costs.costs.data).toBeUndefined()
    expect(result.current.costs.revenue.data).toBeUndefined()
  }
  expect(fetchMock).not.toHaveBeenCalled()
  mockUser = { id: "real-user" }
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ totalSales: { actual: 123 }, transactions: {}, metadata: {}, monthlyData: [] }) })
  rerender()
  await waitFor(() => expect(result.current.sales.data?.totalSales.actual).toBe(123))
  expect(fetchMock.mock.calls.some(([url]) => url.includes("siteId=real-site"))).toBe(true)
})
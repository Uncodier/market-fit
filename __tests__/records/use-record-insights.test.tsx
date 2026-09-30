import { renderHook, waitFor } from "@testing-library/react"
import { getHistoricalRelatedRecords, getRecords, resolveRelationsForSidebar } from "@/app/records/actions"
import { useRecordInsights } from "@/app/records/[id]/components/use-record-insights"
import { insightRecord, relationField } from "./insights-test-fixtures"

jest.mock("@/app/records/actions", () => ({
  getHistoricalRelatedRecords: jest.fn(),
  getRecords: jest.fn(),
  resolveRelationsForSidebar: jest.fn(),
}))

const fields = [
  { id: "amount", name: "Amount", type: "number" },
  { id: "status", name: "Status", type: "select" },
  relationField,
]

describe("record insight calculations", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(new Date("2026-01-05T12:00:00Z"))
    jest.mocked(getRecords).mockResolvedValue({ records: [], error: null })
    jest.mocked(getHistoricalRelatedRecords).mockResolvedValue({ records: [], error: null })
    jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "customer-1": "Example Customer" })
  })

  afterEach(() => jest.useRealTimers())

  it("keeps empty insights empty and skips history requests without a saved record", () => {
    const props = { fields: [], formData: {} }
    const { result } = renderHook(() => useRecordInsights(props))
    expect(result.current).toMatchObject({
      hasDescription: false,
      chartData: [],
      numericData: [],
      metaAnalysis: null,
      macroAnalysis: null,
      dynamicCrosses: [],
      activeRelations: [],
    })
    expect(getRecords).not.toHaveBeenCalled()
    expect(getHistoricalRelatedRecords).not.toHaveBeenCalled()
    expect(resolveRelationsForSidebar).not.toHaveBeenCalled()
  })

  it("merges unsaved values into chronological history and preserves all analysis levels", async () => {
    const history = [
      insightRecord({ id: "older", created_at: "2026-01-01T12:00:00Z", data: { Amount: 10, Status: "Won" } }),
      insightRecord({ data: { Amount: 20, Status: "Won" } }),
    ]
    jest.mocked(getHistoricalRelatedRecords).mockResolvedValue({ records: history, error: null })
    jest.mocked(getRecords).mockResolvedValue({
      records: [...history, insightRecord({ id: "other", data: { Amount: 90, Status: "Lost" } })],
      error: null,
    })
    const props = {
      fields,
      formData: { Amount: 30, Status: "Won" },
      record: insightRecord(),
      relationsData: { Customer: "customer-1" },
    }
    const { result, rerender } = renderHook(currentProps => useRecordInsights(currentProps), { initialProps: props })

    await waitFor(() => expect(result.current.primaryRelationLabel).toBe("Example Customer"))
    expect(getHistoricalRelatedRecords).toHaveBeenCalledWith("category-1", "Customer", "customer-1")
    expect(getRecords).toHaveBeenCalledWith("site-1", "category-1")
    expect(resolveRelationsForSidebar).toHaveBeenCalledWith([{ target: "lead", ids: ["customer-1"] }])
    expect(result.current.chartData.map(point => [point.id, point.Amount])).toEqual([
      ["older", 10], ["current-record", 30],
    ])
    expect(result.current.chartData[1].rawDate.toLocaleDateString()).toBe(new Date().toLocaleDateString())
    expect(result.current.metaAnalysis).toEqual({
      activity: { totalRecords: 2, avgPeriodicity: 4, daysSinceFirst: 4, daysSinceLast: 0 },
      numericStats: [{ name: "Amount", avg: "20.0", min: 10, max: 30, current: 30, trend: "50.0" }],
      categoricalStats: [{ name: "Status", mode: "Won", count: 3 }],
    })
    expect(result.current.macroAnalysis).toEqual({
      totalRecords: 3,
      numericStats: [{ name: "Amount", avg: "40.0", min: 10, max: 90 }],
      categoricalStats: [{ name: "Status", type: "select", modeId: "Won", count: 3 }],
    })
    expect(result.current.dynamicCrosses).toEqual([{
      type: "cat_vs_num", catName: "Status", catVal: "Won", isRelation: false,
      numName: "Amount", subsetAvg: 15, overallAvg: 40, diff: -62.5, count: 2,
    }])

    rerender({ ...props, formData: { Amount: 50, Status: "Won" } })
    expect(result.current.numericData).toEqual([{ name: "Amount", value: 50 }])
    expect(result.current.chartData.map(point => point.Amount)).toEqual([10, 50])
    expect(history[1].data.Amount).toBe(20)
  })

  it("ignores empty categorical values and preserves deduplicated category correlations", async () => {
    const props = {
      fields: [
        { id: "status", name: "Status", type: "select" },
        { id: "region", name: "Region", type: "text" },
      ],
      formData: { Status: "Won", Region: "North" },
      record: insightRecord(),
    }
    jest.mocked(getRecords).mockResolvedValue({
      records: [
        insightRecord({ id: "one", data: { Status: "Won", Region: "North" } }),
        insightRecord({ id: "two", data: { Status: "Won", Region: "North" } }),
        insightRecord({ id: "empty", data: { Status: "", Region: undefined } }),
      ],
      error: null,
    })
    const { result } = renderHook(() => useRecordInsights(props))
    await waitFor(() => expect(result.current.macroAnalysis?.totalRecords).toBe(3))
    expect(result.current.macroAnalysis?.categoricalStats).toEqual([
      { name: "Status", type: "select", modeId: "Won", count: 3 },
      { name: "Region", type: "text", modeId: "North", count: 3 },
    ])
    expect(result.current.dynamicCrosses).toEqual([{
      type: "cat_vs_cat", catName: "Status", catVal: "Won", isRelation: false,
      otherCatName: "Region", otherCatVal: "North", isOtherRelation: false,
      count: 2, totalSubset: 2, percentage: 100,
    }])
  })
})
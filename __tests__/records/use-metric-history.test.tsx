import { act, renderHook, waitFor } from "@testing-library/react"
import { getHistoricalRelatedRecords } from "@/app/records/actions"
import { useMetricHistory } from "@/app/records/[id]/components/use-metric-history"
import { insightRecord, relationField } from "./insights-test-fixtures"

jest.mock("@/app/records/actions", () => ({ getHistoricalRelatedRecords: jest.fn() }))

const props = {
  fields: [relationField], formData: {}, record: insightRecord(),
  relationsData: { Customer: "customer-1" },
}

describe("metric history lifecycle", () => {
  beforeEach(() => jest.resetAllMocks())

  it("requires a choice when multiple relations could identify the subject", async () => {
    jest.mocked(getHistoricalRelatedRecords).mockResolvedValue({ records: [], error: null })
    const { result } = renderHook(() => useMetricHistory({
      ...props, fields: [...props.fields, { ...relationField, id: "project", name: "Project" }],
      relationsData: { ...props.relationsData, Project: "project-1" },
    }))
    expect(result.current.primaryRelationName).toBeNull()
    expect(result.current.historyStatus).toBe("idle")
    expect(getHistoricalRelatedRecords).not.toHaveBeenCalled()
    act(() => result.current.setHistoryRelation("Project"))
    await waitFor(() => expect(result.current.historyStatus).toBe("ready"))
    expect(getHistoricalRelatedRecords).toHaveBeenCalledWith("category-1", "Project", "project-1")
  })

  it("clears old data immediately and ignores late responses after changing the subject", async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof getHistoricalRelatedRecords>>) => void
    jest.mocked(getHistoricalRelatedRecords)
      .mockRejectedValue(new Error("unavailable"))
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ records: [insightRecord({ id: "new-subject" })], error: null })
    const { result, rerender } = renderHook(useMetricHistory, { initialProps: props })
    expect(result.current.historyStatus).toBe("loading")
    rerender({ ...props, relationsData: { Customer: "customer-2" } })
    expect(result.current.history).toEqual([])
    await waitFor(() => expect(result.current.history[0]?.id).toBe("new-subject"))
    await act(async () => resolveOld({ records: [insightRecord({ id: "old-subject" })], error: null }))
    expect(result.current.history.map(item => item.id)).toEqual(["new-subject"])
    rerender({ ...props, record: insightRecord({ site_id: "another-site", category_id: "another-category" }) })
    expect(result.current.history).toEqual([])
    await waitFor(() => expect(result.current.historyStatus).toBe("error"))
  })

  it("reports returned errors and rejected requests, then retries explicitly", async () => {
    jest.mocked(getHistoricalRelatedRecords)
      .mockResolvedValueOnce({ records: null, error: "unavailable" })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ records: [], error: null })
    const { result } = renderHook(() => useMetricHistory(props))
    await waitFor(() => expect(result.current.historyStatus).toBe("error"))
    act(() => result.current.retryHistory())
    await waitFor(() => expect(result.current.historyStatus).toBe("error"))
    act(() => result.current.retryHistory())
    await waitFor(() => expect(result.current.historyStatus).toBe("ready"))
    expect(getHistoricalRelatedRecords).toHaveBeenCalledTimes(3)
  })
})
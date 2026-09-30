import { act, renderHook, waitFor } from "@testing-library/react"
import { fetchIcpMiningLists, type IcpMiningList } from "@/app/components/settings/icp-mining-lists"
import { useIcpMiningLists } from "@/app/components/settings/use-icp-mining-lists"
import { deferred, miningList } from "./icp-mining-list-fixtures"

jest.mock("@/app/components/settings/icp-mining-lists", () => ({
  fetchIcpMiningLists: jest.fn(), ICP_MINING_LIST_ERROR: "Unable to load this site's pending mining lists. Please try again.",
}))

describe("mining lists asynchronous site scope", () => {
  beforeEach(() => jest.clearAllMocks())

  it("does not query without a site and clears options when the site is removed", async () => {
    jest.mocked(fetchIcpMiningLists).mockResolvedValue([miningList(1)])
    const { result, rerender } = renderHook(({ siteId }: { siteId?: string }) => useIcpMiningLists(siteId), { initialProps: {} })
    expect(result.current).toMatchObject({ lists: [], loading: false, error: "" })
    expect(fetchIcpMiningLists).not.toHaveBeenCalled()
    rerender({ siteId: "site-a" })
    await waitFor(() => expect(result.current.lists).toEqual([miningList(1)]))
    rerender({})
    expect(result.current).toMatchObject({ lists: [], loading: false, error: "" })
    expect(jest.mocked(fetchIcpMiningLists).mock.calls[0][1]?.aborted).toBe(true)
  })

  it("hides loaded old-site rows in the render before effects and ignores old retries after A→B→A", async () => {
    const pending = deferred<IcpMiningList[]>()
    jest.mocked(fetchIcpMiningLists).mockResolvedValueOnce([miningList(1)]).mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([miningList(2)]).mockResolvedValueOnce([miningList(3)])
    const renders: { siteId: string; ids: string[] }[] = []
    const { result, rerender } = renderHook(({ siteId }) => {
      const state = useIcpMiningLists(siteId)
      renders.push({ siteId, ids: state.lists.map(list => list.id) })
      return state
    }, { initialProps: { siteId: "a" } })
    await waitFor(() => expect(result.current.lists).toEqual([miningList(1)]))
    act(() => result.current.retry())
    rerender({ siteId: "b" })
    await waitFor(() => expect(result.current.lists).toEqual([miningList(2)]))
    expect(renders.filter(render => render.siteId === "b").every(render => !render.ids.includes(miningList(1).id))).toBe(true)
    rerender({ siteId: "a" })
    await waitFor(() => expect(result.current.lists).toEqual([miningList(3)]))
    await act(async () => pending.resolve([miningList(99)]))
    expect(result.current.lists).toEqual([miningList(3)])
    expect(jest.mocked(fetchIcpMiningLists).mock.calls[1][1]?.aborted).toBe(true)
  })

  it("aborts in-flight loads on unmount", async () => {
    const pending = deferred<IcpMiningList[]>()
    jest.mocked(fetchIcpMiningLists).mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(() => useIcpMiningLists("site-a"))
    const signal = jest.mocked(fetchIcpMiningLists).mock.calls[0][1]!
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.reject(new Error("Late failure")))
  })
})
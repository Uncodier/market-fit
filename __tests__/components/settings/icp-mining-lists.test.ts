import { fetchIcpMiningLists, ICP_MINING_LIST_ERROR } from "@/app/components/settings/icp-mining-lists"
import { listId, miningList } from "./icp-mining-list-fixtures"

const mockFetch = jest.fn()
const originalFetch = global.fetch
const response = (lists: unknown[], next_cursor: string | null) => ({ ok: true, json: async () => ({ lists, next_cursor }) })

describe("authenticated mining list reads", () => {
  beforeEach(() => { jest.clearAllMocks(); global.fetch = mockFetch })
  afterAll(() => { global.fetch = originalFetch })

  it.each([200, 50])("loads every page even when the server returns at most %i rows", async cap => {
    const rows = Array.from({ length: 425 }, (_, index) => miningList(index))
    mockFetch.mockImplementation(async (url: string) => {
      const params = new URL(url, "https://example.test").searchParams
      expect(params.get("site_id")).toBe("site-a")
      const cursor = params.get("after")
      const page = rows.filter(row => !cursor || row.id > cursor).slice(0, cap)
      return response(page, page.at(-1)?.id ?? null)
    })
    const signal = new AbortController().signal
    const lists = await fetchIcpMiningLists("site-a", signal)
    expect(lists).toEqual(rows)
    expect(mockFetch).toHaveBeenCalledTimes(Math.ceil(425 / cap) + 1)
    for (const [url, options] of mockFetch.mock.calls) {
      expect(url).toMatch(/^\/api\/settings\/icp-mining-lists\?/)
      expect(options).toEqual({ credentials: "same-origin", cache: "no-store", signal })
    }
    expect(new URL(mockFetch.mock.calls[1][0], "https://example.test").searchParams.get("after")).toBe(listId(cap - 1))
  })
  it.each([401, 403, 500])("does not publish partial lists or private errors after HTTP %s", async status => {
    mockFetch.mockResolvedValueOnce(response([miningList(1)], listId(1)))
      .mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: "private details" }) })
    await expect(fetchIcpMiningLists("site-a")).rejects.toThrow(ICP_MINING_LIST_ERROR)
  })
  it.each([
    { lists: null, next_cursor: null },
    { lists: [], next_cursor: listId(1) },
    { lists: [miningList(1)], next_cursor: null },
    { lists: [miningList(1)], next_cursor: listId(2) },
    { lists: [miningList(2), miningList(1)], next_cursor: listId(1) },
  ])("rejects malformed or inconsistent pages", async payload => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => payload })
    await expect(fetchIcpMiningLists("site-a")).rejects.toThrow(ICP_MINING_LIST_ERROR)
  })
  it("rejects a non-advancing cursor instead of loading indefinitely", async () => {
    mockFetch.mockResolvedValue(response([miningList(1)], listId(1)))
    await expect(fetchIcpMiningLists("site-a")).rejects.toThrow(ICP_MINING_LIST_ERROR)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
  it("does not query without a site or after cancellation", async () => {
    expect(await fetchIcpMiningLists("")).toEqual([])
    const controller = new AbortController()
    controller.abort()
    await expect(fetchIcpMiningLists("site-a", controller.signal)).rejects.toThrow()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
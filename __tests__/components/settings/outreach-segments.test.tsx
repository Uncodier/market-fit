import { act, renderHook, waitFor } from "@testing-library/react"
import { createClient } from "@/lib/supabase/client"
import { fetchOutreachSegments } from "@/app/components/settings/outreach-segments"
import { useOutreachSegments } from "@/app/components/settings/use-outreach-segments"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

describe("site-scoped outreach segment loading", () => {
  const client = (order: jest.Mock) => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order }
    const supabase = { from: jest.fn().mockReturnValue(query) }
    jest.mocked(createClient).mockReturnValue(supabase as any)
    return { query, supabase }
  }

  it("uses the existing RLS client and an explicit site filter", async () => {
    const { query, supabase } = client(jest.fn().mockResolvedValue({ data: [{ id: "s", name: "Segment" }], error: null }))
    expect(await fetchOutreachSegments("site-a")).toEqual([{ id: "s", name: "Segment" }])
    expect(supabase.from).toHaveBeenCalledWith("segments")
    expect(query.select).toHaveBeenCalledWith("id, name")
    expect(query.eq).toHaveBeenCalledWith("site_id", "site-a")
  })

  it("ignores stale responses after switching sites", async () => {
    let resolveA!: (value: any) => void
    const promiseA = new Promise(resolve => { resolveA = resolve })
    client(jest.fn().mockReturnValueOnce(promiseA).mockResolvedValueOnce({ data: [{ id: "b", name: "B" }], error: null }))
    const { result, rerender } = renderHook(({ siteId }) => useOutreachSegments(siteId), { initialProps: { siteId: "site-a" } })
    rerender({ siteId: "site-b" })
    expect(result.current.segments).toEqual([])
    await waitFor(() => expect(result.current.segments).toEqual([{ id: "b", name: "B" }]))
    await act(async () => resolveA({ data: [{ id: "a", name: "A" }], error: null }))
    expect(result.current.segments).toEqual([{ id: "b", name: "B" }])
  })

  it("fails closed and allows retry without leaking database errors", async () => {
    client(jest.fn().mockResolvedValueOnce({ data: null, error: { message: "private database detail" } }).mockResolvedValueOnce({ data: [], error: null }))
    const { result } = renderHook(() => useOutreachSegments("site-a"))
    await waitFor(() => expect(result.current.error).toContain("Unable to load"))
    expect(result.current.error).not.toContain("private")
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.error).toBe(""))
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
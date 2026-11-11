import { renderHook, waitFor, act } from "@testing-library/react"
import { useRelationOptions } from "@/app/records/hooks/useRelationOptions"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

const firstCategory = "00000000-0000-4000-8000-000000000001"
const secondCategory = "00000000-0000-4000-8000-000000000002"
const fields = [firstCategory, secondCategory].map(targetCategoryId => ({
  type: "relation", relationTarget: "record", targetCategoryId,
}))
const selectedIds: string[] = []

function queryClient(resolve: (filters: Record<string, string | null>) => Promise<{ data: unknown[]; error: unknown }>) {
  return { from: jest.fn(() => {
    const filters: Record<string, string | null> = {}
    const query: { select: jest.Mock; eq: jest.Mock; is: jest.Mock; limit: jest.Mock; order: jest.Mock; ilike: jest.Mock; in: jest.Mock; then: (callback: (value: unknown) => unknown) => Promise<unknown> } = {
      select: jest.fn(() => query),
      eq: jest.fn((key: string, value: string) => { filters[key] = value; return query }),
      is: jest.fn((key: string, value: null) => { filters[key] = value; return query }),
      limit: jest.fn(() => query), order: jest.fn(() => query),
      ilike: jest.fn((key: string, value: string) => { filters.search = value; return query }), in: jest.fn(() => query),
      then: (callback: (value: unknown) => unknown) => resolve(filters).then(callback),
    }
    return query
  }) }
}

beforeEach(() => jest.clearAllMocks())

it("scopes every internal relation query to its site and category", async () => {
  const calls: Record<string, string | null>[] = []
  const client = queryClient(async filters => {
    calls.push({ ...filters })
    return { data: [{ id: filters.category_id, title: filters.category_id }], error: null }
  })
  jest.mocked(createClient).mockReturnValue(client as never)
  const { result } = renderHook(() => useRelationOptions(fields, "site-one", selectedIds))
  await waitFor(() => expect(Object.keys(result.current.relationOptions)).toHaveLength(2))
  expect(calls).toEqual(expect.arrayContaining([
    { site_id: "site-one", category_id: firstCategory, deleted_at: null },
    { site_id: "site-one", category_id: secondCategory, deleted_at: null },
  ]))
  expect(result.current.relationOptions[`record:${firstCategory}`][0].id).toBe(firstCategory)
  expect(result.current.relationOptions[`record:${secondCategory}`][0].id).toBe(secondCategory)
})

it("discards late requests after switching sites", async () => {
  let release: ((value: { data: unknown[]; error: null }) => void) | undefined
  jest.mocked(createClient).mockReturnValue(queryClient(async filters => {
    if (filters.site_id === "old-site") return new Promise(resolve => { release = resolve })
    return { data: [{ id: "new", title: "New site" }], error: null }
  }) as never)
  const oneField = [fields[0]]
  const { result, rerender } = renderHook(({ site }) => useRelationOptions(oneField, site, selectedIds), {
    initialProps: { site: "old-site" },
  })
  await waitFor(() => expect(release).toBeDefined())
  rerender({ site: "new-site" })
  await waitFor(() => expect(result.current.relationOptions[`record:${firstCategory}`]?.[0].id).toBe("new"))
  await act(async () => release?.({ data: [{ id: "old", title: "Old site" }], error: null }))
  expect(result.current.relationOptions[`record:${firstCategory}`][0].id).toBe("new")
})

it("never queries an unsupported person target or arbitrary table", async () => {
  const client = queryClient(async () => ({ data: [], error: null }))
  jest.mocked(createClient).mockReturnValue(client as never)
  const invalid = [{ type: "relation", relationTarget: "person" }]
  const { result } = renderHook(() => useRelationOptions(invalid, "site", selectedIds))
  await waitFor(() => expect(result.current.relationErrors.person).toMatch(/unavailable/))
  expect(client.from).not.toHaveBeenCalled()
})

it("does not preserve stale selected values after read failure", async () => {
  jest.mocked(createClient).mockReturnValue(queryClient(async () => ({ data: [], error: { message: "denied" } })) as never)
  const { result } = renderHook(() => useRelationOptions(fields, "site", ["previous-id"]))
  await waitFor(() => expect(result.current.relationErrors[`record:${firstCategory}`]).toMatch(/Unable/))
  expect(result.current.relationOptions[`record:${firstCategory}`]).toEqual([])
})

it.each([false, true])("preserves another target's search across selection changes (in-flight=%s)", async inFlight => {
  jest.useFakeTimers()
  try {
    const calls: Record<string, string | null>[] = []
    let release: ((value: { data: unknown[]; error: null }) => void) | undefined
    jest.mocked(createClient).mockReturnValue(queryClient(async filters => {
      calls.push({ ...filters })
      if (filters.search) return new Promise(resolve => { release = resolve })
      return { data: [{ id: "default", title: "Default" }], error: null }
    }) as never)
    const { result, rerender } = renderHook(({ selected }) => useRelationOptions(fields, "site", selected), {
      initialProps: { selected: [] as string[] },
    })
    await act(async () => {})
    const key = `record:${firstCategory}`
    act(() => result.current.handleSearchChange(key, "needle"))
    if (inFlight) await act(async () => { jest.advanceTimersByTime(300) })
    rerender({ selected: [secondCategory] })
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(release).toBeDefined()
    await act(async () => release?.({ data: [{ id: "match", title: "Needle" }], error: null }))
    expect(result.current.relationOptions[key]).toEqual([expect.objectContaining({ id: "match" })])
    rerender({ selected: [secondCategory, "another-selection"] })
    await act(async () => {})
    expect(result.current.relationOptions[key]).toEqual([expect.objectContaining({ id: "match" })])
    expect(calls.filter(call => call.category_id === firstCategory)).toEqual([
      { site_id: "site", category_id: firstCategory, deleted_at: null },
      { site_id: "site", category_id: firstCategory, deleted_at: null, search: "%needle%" },
    ])
  } finally { jest.useRealTimers() }
})

it("preserves the legacy lead default for an omitted relationTarget", async () => {
  const client = queryClient(async () => ({ data: [], error: null }))
  jest.mocked(createClient).mockReturnValue(client as never)
  const { result } = renderHook(() => useRelationOptions([{ type: "relation" }], "site", []))
  await waitFor(() => expect(result.current.relationOptions.lead).toEqual([]))
  expect(client.from).toHaveBeenCalledWith("leads")
})

it("excludes trashed categories from internal category options", async () => {
  const calls: Record<string, string | null>[] = []
  jest.mocked(createClient).mockReturnValue(queryClient(async filters => {
    calls.push({ ...filters })
    return { data: [], error: null }
  }) as never)
  const { result } = renderHook(() => useRelationOptions([{ type: "relation", relationTarget: "record_category" }], "site", []))
  await waitFor(() => expect(result.current.relationOptions.record_category).toEqual([]))
  expect(calls).toEqual([{ site_id: "site", deleted_at: null }])
})
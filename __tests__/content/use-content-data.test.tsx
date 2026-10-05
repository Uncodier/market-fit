import { act, renderHook, waitFor } from "@testing-library/react"
import { getContentById, type ContentItem } from "@/app/content/actions"
import { useContentData } from "@/app/content/[id]/hooks/use-content-data"

jest.mock("@/app/content/actions", () => ({ getContentById: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn(() => {
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
  }
  return { from: jest.fn(() => query) }
}) }))

const content = (id: string): ContentItem => ({
  id, title: "Test content", description: null, type: "blog_post", content: "Copy",
  text: "Copy", instructions: null, status: "draft", segment_id: null, campaign_id: null,
  site_id: "site-one", author_id: null, user_id: null, created_at: "2026-10-05",
  updated_at: "2026-10-05", published_at: null, tags: null, word_count: 1,
  estimated_reading_time: null, seo_score: null, performance_rating: null,
})
const fetchContent = jest.mocked(getContentById)
const setEditForm = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  fetchContent.mockReset()
})

it("shows a recoverable network error and retries only when requested", async () => {
  fetchContent.mockRejectedValueOnce(new TypeError("Load failed"))
  const { result } = renderHook(() => useContentData({ contentId: "one", setEditForm }))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.content).toBeNull()
  expect(result.current.loadError).toContain("Check your connection")
  expect(fetchContent).toHaveBeenCalledTimes(1)

  fetchContent.mockResolvedValueOnce({ content: content("one"), error: null })
  await act(async () => { await result.current.loadContent() })
  expect(result.current.content?.id).toBe("one")
  expect(result.current.loadError).toBeNull()
  expect(result.current.isLoading).toBe(false)
})

it.each([
  { content: null, error: null },
  { content: content("wrong-id"), error: null },
])("does not render missing or mismatched content", async response => {
  fetchContent.mockResolvedValueOnce(response)
  const { result } = renderHook(() => useContentData({ contentId: "one", setEditForm }))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.content).toBeNull()
  expect(result.current.loadError).toBe("Content not found or no longer available.")
  expect(setEditForm).not.toHaveBeenCalled()
})

it("does not expose returned database errors", async () => {
  fetchContent.mockResolvedValueOnce({ content: null, error: "private SQL detail" })
  const { result } = renderHook(() => useContentData({ contentId: "one", setEditForm }))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.loadError).not.toContain("private")
  expect(result.current.content).toBeNull()
})

it("clears previously loaded content when a reload fails", async () => {
  fetchContent.mockResolvedValueOnce({ content: content("one"), error: null })
  const { result } = renderHook(() => useContentData({ contentId: "one", setEditForm }))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  fetchContent.mockRejectedValueOnce(new TypeError("Load failed"))
  await act(async () => { await result.current.loadContent() })
  expect(result.current.content).toBeNull()
  expect(result.current.loadError).not.toBeNull()
})

it("ignores an older request after navigating to another content item", async () => {
  let resolveOld!: (value: Awaited<ReturnType<typeof getContentById>>) => void
  fetchContent.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  fetchContent.mockResolvedValueOnce({ content: content("two"), error: null })
  const { result, rerender } = renderHook(({ id }) => useContentData({ contentId: id, setEditForm }), {
    initialProps: { id: "one" },
  })
  rerender({ id: "two" })
  await waitFor(() => expect(result.current.content?.id).toBe("two"))
  await act(async () => { resolveOld({ content: content("one"), error: null }) })
  expect(result.current.content?.id).toBe("two")
  expect(result.current.loadError).toBeNull()
  expect(setEditForm).toHaveBeenCalledTimes(1)
})
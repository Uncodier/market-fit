import { act, renderHook } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteContent } from "@/app/content/actions"
import { useContentItemController } from "@/app/content/[id]/hooks/use-content-item-controller"

jest.mock("sonner", () => ({ toast: { success: jest.fn() } }))
jest.mock("@/app/content/actions", () => ({ deleteContent: jest.fn() }))
jest.mock("@/app/content/[id]/hooks/use-content-data", () => ({
  useContentData: () => ({ content: { id: "content-one", tags: ["outstand_id_post-one"] }, loadContent: jest.fn() }),
}))
jest.mock("@/app/content/[id]/hooks/use-content-editors", () => ({ useContentEditors: () => ({}) }))
jest.mock("@/app/content/[id]/hooks/use-content-generation", () => ({ useContentGeneration: () => ({}) }))
jest.mock("@/app/content/[id]/hooks/use-content-publishing", () => ({ useContentPublishing: () => ({}) }))
jest.mock("@/app/content/[id]/hooks/use-content-save", () => ({ useContentSave: () => ({}) }))

const push = jest.fn()
const refresh = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({ push, refresh } as unknown as ReturnType<typeof useRouter>)
})

it.each([true, false])("forwards deleteFromOutstand=%s and navigates only on confirmed success", async deleteFromOutstand => {
  jest.mocked(deleteContent).mockResolvedValue({ success: true })
  const { result } = renderHook(() => useContentItemController("content-one"))
  await act(async () => {
    expect(await result.current.handleDeleteContent({ deleteFromOutstand })).toEqual({ success: true })
  })
  expect(deleteContent).toHaveBeenCalledWith("content-one", { deleteFromOutstand })
  expect(push).toHaveBeenCalledWith("/content")
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(toast.success).toHaveBeenCalledWith(deleteFromOutstand
    ? "Content and linked social posts deleted successfully" : "Content deleted successfully")
})

it("returns API errors to the modal without success notification or navigation", async () => {
  const failure = { success: false as const, error: "Local content was not deleted.", status: 409 }
  jest.mocked(deleteContent).mockResolvedValue(failure)
  const { result } = renderHook(() => useContentItemController("content-one"))
  await act(async () => {
    expect(await result.current.handleDeleteContent({ deleteFromOutstand: true })).toEqual(failure)
  })
  expect(push).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it("does not expose thrown errors or navigate away after an uncertain request", async () => {
  jest.mocked(deleteContent).mockRejectedValue(new Error("private detail"))
  const { result } = renderHook(() => useContentItemController("content-one"))
  await act(async () => {
    const failure = await result.current.handleDeleteContent({ deleteFromOutstand: true })
    expect(failure.success).toBe(false)
    expect(failure.error).not.toContain("private detail")
  })
  expect(push).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})
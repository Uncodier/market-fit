import { act, renderHook } from "@testing-library/react"
import type { Editor } from "@tiptap/react"
import { toast } from "sonner"
import { useContentGeneration } from "@/app/content/[id]/hooks/use-content-generation"
import { EMPTY_CONTENT_EDIT_FORM, type ContentActiveTab } from "@/app/content/[id]/content-item-types"
import { CONTENT_GENERATION_UNCONFIRMED } from "@/app/api/agents/copywriter/content-editor/contract"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const siteId = "00000000-0000-4000-8000-000000000001"
const contentId = "00000000-0000-4000-8000-000000000002"
const segmentId = "00000000-0000-4000-8000-000000000003"
const campaignId = "00000000-0000-4000-8000-000000000004"
const accepted = { success: true, data: {
  status: "completed", contentId, siteId, saved_to_database: true,
  edited_content: { title: "New title", description: "New summary", text: "# New copy" },
} }
const originalTimeout = AbortSignal.timeout

beforeAll(() => {
  AbortSignal.timeout = jest.fn(() => new AbortController().signal)
})

afterAll(() => {
  AbortSignal.timeout = originalTimeout
})

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300, status,
    json: jest.fn().mockResolvedValue(body), text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response
}

function options(activeTab: ContentActiveTab = "copy") {
  const editor = {
    commands: { setContent: jest.fn() },
    getText: jest.fn().mockReturnValue("New copy"),
    getHTML: jest.fn().mockReturnValue("<h1>New copy</h1>"),
  }
  const instructionsEditor = { commands: { setContent: jest.fn() } }
  return {
    content: { id: contentId, site_id: siteId },
    editForm: { ...EMPTY_CONTENT_EDIT_FORM, segment_id: segmentId, campaign_id: campaignId, instructions: "Keep instructions" },
    setEditForm: jest.fn(), activeTab,
    editor: editor as unknown as Editor,
    instructionsEditor: instructionsEditor as unknown as Editor,
    hasUnsavedChanges: jest.fn().mockReturnValue(false),
    saveContent: jest.fn().mockResolvedValue(undefined),
    loadContent: jest.fn().mockResolvedValue(undefined),
    setHasUserMadeChanges: jest.fn(),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(fetch).mockReset().mockResolvedValue(response(accepted))
})

it.each(["copy", "ai", "instructions"] as const)("uses the same-origin session and applies saved edited_content to copy from the %s tab", async (tab) => {
  const props = options(tab)
  const { result } = renderHook(() => useContentGeneration(props))
  act(() => {
    result.current.setAiPrompt("Improve clarity")
    result.current.setExpertise("Writing")
    result.current.setInterests("Research")
    result.current.setTopicsToAvoid("Speculation")
  })
  await act(async () => { await result.current.generateContent("improve") })
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, init] = jest.mocked(fetch).mock.calls[0]
  expect(url).toBe("/api/agents/copywriter/content-editor")
  expect(init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error" })
  expect(init?.signal).toBeInstanceOf(AbortSignal)
  expect(AbortSignal.timeout).toHaveBeenCalledWith(120_000)
  expect(init?.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" })
  expect(init).not.toHaveProperty("mode", "cors")
  const body = JSON.parse(String(init?.body))
  expect(body).toEqual({
    contentId, siteId, segmentId, campaignId, quickAction: "improve",
    aiPrompt: "Improve clarity", whatImGoodAt: "Writing", topicsImInterestedIn: "Research", topicsToAvoid: "Speculation",
    styleControls: { tone: "neutral", complexity: "moderate", creativity: "balanced",
      persuasiveness: "balanced", targetAudience: "specific", engagement: "balanced", size: "medium" },
  })
  expect(body).not.toHaveProperty("userId")
  expect(props.loadContent).toHaveBeenCalledTimes(1)
  expect(props.editor.commands.setContent).toHaveBeenCalledWith(expect.stringContaining("<h1>New copy</h1>"), { emitUpdate: false })
  expect(props.instructionsEditor.commands.setContent).not.toHaveBeenCalled()
  const nextForm = props.setEditForm.mock.calls[0][0](props.editForm)
  expect(nextForm).toMatchObject({
    title: "New title", description: "New summary", content: "<h1>New copy</h1>",
    text: "New copy", word_count: 2, char_count: 8, instructions: "Keep instructions",
  })
  expect(props.setHasUserMadeChanges).toHaveBeenLastCalledWith(false)
  expect(toast.success).toHaveBeenCalledWith("Content generated successfully")
  expect(toast.error).not.toHaveBeenCalled()
  expect(result.current.isGenerating).toBe(false)
})

it.each([401, 403, 500])("does not expose raw backend failures or claim success for HTTP %i", async (status) => {
  const props = options()
  const upstream = response({ error: "private backend detail" }, status)
  jest.mocked(fetch).mockResolvedValueOnce(upstream)
  const logger = jest.spyOn(console, "error").mockImplementation(() => {})
  try {
    const { result } = renderHook(() => useContentGeneration(props))
    await act(async () => { await result.current.generateContent() })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(status === 401 ? "Please sign in again to generate content."
      : status === 403 ? "You do not have permission to generate this content." : CONTENT_GENERATION_UNCONFIRMED)
    expect(upstream.text).not.toHaveBeenCalled()
    expect(upstream.json).not.toHaveBeenCalled()
    expect(logger).not.toHaveBeenCalled()
    expect(props.loadContent).not.toHaveBeenCalled()
    expect(props.setEditForm).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(false)
  } finally {
    logger.mockRestore()
  }
})

it.each([
  {}, { message: "Accepted" }, { content: "Legacy copy" }, { success: false, error: "private detail" },
  { ...accepted, data: { ...accepted.data, status: "running" } },
  { ...accepted, data: { ...accepted.data, saved_to_database: false } },
  { ...accepted, data: { ...accepted.data, contentId: siteId } },
  { ...accepted, data: { ...accepted.data, siteId: contentId } },
  { ...accepted, data: { ...accepted.data, edited_content: { text: "" } } },
])("rejects unconfirmed success responses without changing the editor", async (body) => {
  const props = options()
  jest.mocked(fetch).mockResolvedValueOnce(response(body))
  const { result } = renderHook(() => useContentGeneration(props))
  await act(async () => { await result.current.generateContent() })
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith(CONTENT_GENERATION_UNCONFIRMED)
  expect(props.loadContent).not.toHaveBeenCalled()
  expect(props.setEditForm).not.toHaveBeenCalled()
  expect(props.editor.commands.setContent).not.toHaveBeenCalled()
})

it("does not replay or log network/JSON failures", async () => {
  const props = options()
  const logger = jest.spyOn(console, "error").mockImplementation(() => {})
  try {
    const { result } = renderHook(() => useContentGeneration(props))
    jest.mocked(fetch).mockRejectedValueOnce(new Error("private network detail"))
    await act(async () => { await result.current.generateContent() })
    jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: jest.fn().mockRejectedValue(new Error("invalid JSON")) } as unknown as Response)
    await act(async () => { await result.current.generateContent() })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenLastCalledWith(CONTENT_GENERATION_UNCONFIRMED)
    expect(logger).not.toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  } finally {
    logger.mockRestore()
  }
})

it("blocks duplicate clicks until the current generation finishes", async () => {
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  const { result } = renderHook(() => useContentGeneration(options()))
  let pending!: Promise<void>
  act(() => { pending = result.current.generateContent() })
  expect(result.current.isGenerating).toBe(true)
  await act(async () => { await result.current.generateContent() })
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => { finish(response(accepted)); await pending })
  expect(result.current.isGenerating).toBe(false)
  expect(toast.success).toHaveBeenCalledTimes(1)
})

it("preserves autosave before generation for unsaved edits", async () => {
  const props = options()
  props.hasUnsavedChanges.mockReturnValue(true)
  const { result } = renderHook(() => useContentGeneration(props))
  await act(async () => { await result.current.generateContent() })
  expect(props.saveContent).toHaveBeenCalledTimes(1)
  expect(props.saveContent.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(fetch).mock.invocationCallOrder[0])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(props.setHasUserMadeChanges).toHaveBeenLastCalledWith(false)
  expect(toast.success).toHaveBeenCalledWith("Content generated successfully")
  expect(result.current.isGenerating).toBe(false)
})

it("does not generate or leak error details when autosave rejects", async () => {
  const props = options()
  props.hasUnsavedChanges.mockReturnValue(true)
  props.saveContent.mockRejectedValueOnce(new Error("private save details"))
  const { result } = renderHook(() => useContentGeneration(props))
  await act(async () => { await result.current.generateContent() })
  expect(props.setHasUserMadeChanges).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith("Failed to save changes before generating content")
  expect(toast.success).not.toHaveBeenCalled()
  expect(result.current.isGenerating).toBe(false)
})

it("rejects a missing content/site identity before fetching", async () => {
  const props = { ...options(), content: null }
  const { result } = renderHook(() => useContentGeneration(props))
  await act(async () => { await result.current.generateContent() })
  expect(fetch).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith("Content ID or site ID not available")
})

it("updates the form even if the copy editor is not mounted and normalizes a nullable description", async () => {
  const props = { ...options(), editor: null }
  jest.mocked(fetch).mockResolvedValueOnce(response({ ...accepted, data: {
    ...accepted.data, edited_content: { ...accepted.data.edited_content, description: null },
  } }))
  const { result } = renderHook(() => useContentGeneration(props))
  await act(async () => { await result.current.generateContent() })
  const nextForm = props.setEditForm.mock.calls[0][0](props.editForm)
  expect(nextForm).toMatchObject({ title: "New title", description: "", text: "# New copy" })
  expect(nextForm.content).toContain("<h1>New copy</h1>")
  expect(toast.success).toHaveBeenCalledTimes(1)
})
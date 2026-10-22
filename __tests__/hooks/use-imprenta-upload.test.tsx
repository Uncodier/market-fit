import { act, renderHook } from "@testing-library/react"
import type { ChangeEvent } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { uploadAssetFile } from "@/app/assets/actions"
import { useImprentaUpload } from "@/app/hooks/use-imprenta-upload"
import type { InstanceNode } from "@/app/types/instance-nodes"

jest.mock("sonner", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/assets/actions", () => ({ uploadAssetFile: jest.fn() }))

const insert = jest.fn()
const single = jest.fn()
const getSession = jest.fn()
const onUploaded = jest.fn()
const fileUrl = "https://example.test/assets/upload.png"
const savedNode = { id: "saved", instance_id: "instance-a", site_id: "site-a" } as InstanceNode

function selectFile(type = "image/png", name = "Photo.png") {
  const input = document.createElement("input")
  Object.defineProperty(input, "files", { value: [new File(["contents"], name, { type })] })
  return { currentTarget: input } as ChangeEvent<HTMLInputElement>
}

const options = {
  instanceId: "instance-a", siteId: "site-a", onUploaded,
  getViewport: () => ({
    canvasWidth: 1000, canvasHeight: 800, scale: 2,
    position: { x: 100, y: 200 }, interacting: false,
  }),
}

beforeEach(() => {
  jest.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: { user: { id: "user-a" } } } })
  single.mockResolvedValue({ data: savedNode, error: null })
  insert.mockReturnValue({ select: () => ({ single }) })
  onUploaded.mockResolvedValue(undefined)
  jest.mocked(uploadAssetFile).mockResolvedValue({ path: fileUrl })
  jest.mocked(createClient).mockReturnValue({
    auth: { getSession }, from: () => ({ insert }),
  } as unknown as ReturnType<typeof createClient>)
})

it.each([
  ["image/png", "image"], ["video/mp4", "video"],
  ["audio/mpeg", "audio"], ["application/pdf", "text"], ["text/plain", "text"],
])("persists %s and publishes the confirmed node before reporting success", async (mimeType, mediaType) => {
  const { result } = renderHook(() => useImprentaUpload(options))
  const event = selectFile(mimeType)
  await act(async () => { await result.current.handleFileChange(event) })
  expect(uploadAssetFile).toHaveBeenCalledWith(event.currentTarget.files![0])
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({
    instance_id: "instance-a", site_id: "site-a", user_id: "user-a",
    type: `generate-${mediaType}`, status: "completed",
    settings: { imprenta_mode: true, imprenta_source: "upload", media_type: mediaType, ui_position: { x: -40, y: -50 } },
    result: { outputs: [{ url: fileUrl, type: mediaType }] },
  })])
  expect(onUploaded).toHaveBeenCalledWith(savedNode)
  expect(onUploaded.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(toast.success).mock.invocationCallOrder[0])
  expect(event.currentTarget.value).toBe("")
  expect(result.current.isUploadingAsset).toBe(false)
})

it.each([
  { data: null, error: null }, { data: null, error: { message: "private SQL detail" } },
])("does not report success when the node was not saved", async response => {
  single.mockResolvedValue(response)
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined)
  const { result } = renderHook(() => useImprentaUpload(options))
  await act(async () => { await result.current.handleFileChange(selectFile()) })
  expect(onUploaded).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith("The uploaded file could not be saved to Content Creator")
  expect(result.current.isUploadingAsset).toBe(false)
  log.mockRestore()
})

it("does not upload without a session", async () => {
  getSession.mockResolvedValue({ data: { session: null } })
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined)
  const { result } = renderHook(() => useImprentaUpload(options))
  await act(async () => { await result.current.handleFileChange(selectFile()) })
  expect(uploadAssetFile).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith("Sign in before uploading a file")
  log.mockRestore()
})

it("does not persist a canvas node after Storage fails", async () => {
  jest.mocked(uploadAssetFile).mockResolvedValue({ error: "private storage detail" })
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined)
  const { result } = renderHook(() => useImprentaUpload(options))
  await act(async () => { await result.current.handleFileChange(selectFile()) })
  expect(insert).not.toHaveBeenCalled()
  expect(onUploaded).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith("The file could not be uploaded. Please try again.")
  log.mockRestore()
})

it("retains the original target when navigation occurs during upload", async () => {
  let finish!: (value: { path: string }) => void
  jest.mocked(uploadAssetFile).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { result, rerender } = renderHook(({ instanceId }) => useImprentaUpload({ ...options, instanceId }), {
    initialProps: { instanceId: "instance-a" },
  })
  let upload!: Promise<void>
  await act(async () => { upload = result.current.handleFileChange(selectFile()) })
  rerender({ instanceId: "instance-b" })
  await act(async () => { finish({ path: fileUrl }); await upload })
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({ instance_id: "instance-a" })])
})

it("prevents duplicate submissions while a file is uploading", async () => {
  let finish!: (value: { path: string }) => void
  jest.mocked(uploadAssetFile).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { result } = renderHook(() => useImprentaUpload(options))
  let upload!: Promise<void>
  await act(async () => {
    upload = result.current.handleFileChange(selectFile())
    await result.current.handleFileChange(selectFile())
  })
  expect(result.current.isUploadingAsset).toBe(true)
  expect(uploadAssetFile).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ path: fileUrl }); await upload })
  expect(insert).toHaveBeenCalledTimes(1)
})
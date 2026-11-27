import { getRecordById, updateRecord, type RecordItem } from "@/app/records/actions"
import { recordDocumentDraft, saveRecordDocument } from "@/app/records/lib/record-document-save"

jest.mock("@/app/records/actions", () => ({ getRecordById: jest.fn(), updateRecord: jest.fn() }))

const opened: RecordItem = {
  id: "record", site_id: "site", category_id: "category", title: "Original", description: null,
  data: { calls: 0, notes: { a: 1, b: 2 } }, relations: { seller: "original" }, status: "draft",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:01.000001Z",
}
const latestVersion = "2026-01-01T00:00:01.000002Z"
const stale = { error: "Version changed", conflict: true }
const read = jest.mocked(getRecordById)
const write = jest.mocked(updateRecord)

beforeEach(() => {
  jest.resetAllMocks()
  read.mockResolvedValue({ record: { ...opened, updated_at: latestVersion }, error: null })
  write.mockResolvedValue({ record: { updated_at: "2026-01-01T00:00:02Z" } })
})

it("recovers when only the version changed, keeping exact timestamp precision", async () => {
  write.mockResolvedValueOnce(stale)
  expect(await saveRecordDocument(opened, { ...recordDocumentDraft(opened), title: "Edited" }))
    .toMatchObject({ record: { title: "Edited" } })
  expect(write.mock.calls).toEqual([
    [opened.id, { title: "Edited" }, opened.updated_at],
    [opened.id, { title: "Edited" }, latestVersion],
  ])
})

it("preserves remote-only fields, relation changes and the order-insensitive JSON values", async () => {
  write.mockResolvedValueOnce(stale)
  read.mockResolvedValueOnce({ record: { ...opened, title: "New title", updated_at: latestVersion,
    data: { calls: 0, notes: { b: 2, a: 1 }, demos: 9 }, relations: { seller: "other" } }, error: null })
  const input = { ...recordDocumentDraft(opened), data: { ...opened.data, calls: 4 } }
  expect(await saveRecordDocument(opened, input)).toMatchObject({ record: { title: "New title", relations: { seller: "other" } } })
  expect(write).toHaveBeenLastCalledWith(opened.id, { data: { calls: 4, notes: { a: 1, b: 2 }, demos: 9 } }, latestVersion)
})

it("accepts an already-saved edit without writing again", async () => {
  write.mockResolvedValueOnce(stale)
  read.mockResolvedValueOnce({ record: { ...opened, title: "Edited", updated_at: latestVersion }, error: null })
  expect(await saveRecordDocument(opened, { ...recordDocumentDraft(opened), title: " Edited " }))
    .toMatchObject({ record: { title: "Edited", updated_at: latestVersion } })
  expect(write).toHaveBeenCalledTimes(1)
})

it("retries a transient lock but bounds repeated contention", async () => {
  write.mockResolvedValue({ error: "Busy", retryable: true })
  expect(await saveRecordDocument(opened, { ...recordDocumentDraft(opened), title: "Edited" }))
    .toEqual({ error: "Busy" })
  expect(read).toHaveBeenCalledTimes(2)
  expect(write).toHaveBeenCalledTimes(3)
})

it("does not retry against a different template", async () => {
  write.mockResolvedValueOnce(stale)
  read.mockResolvedValueOnce({ record: { ...opened, category_id: "new-category", updated_at: latestVersion }, error: null })
  expect(await saveRecordDocument(opened, { ...recordDocumentDraft(opened), title: "Edited" })).toMatchObject({ conflict: true })
  expect(write).toHaveBeenCalledTimes(1)
})

it("keeps the draft retryable after repeated version changes with no overlap", async () => {
  write.mockResolvedValue(stale)
  expect(await saveRecordDocument(opened, { ...recordDocumentDraft(opened), title: "Edited" }))
    .toMatchObject({ error: expect.stringMatching(/try saving again/i) })
  expect(write).toHaveBeenCalledTimes(3)
  expect(read).toHaveBeenCalledTimes(3)
})

it("preserves the inline editor's null when clearing notes", async () => {
  await saveRecordDocument({ ...opened, description: "Old notes" }, { description: null })
  expect(write).toHaveBeenCalledWith(opened.id, { description: null }, opened.updated_at)
})
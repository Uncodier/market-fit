import React from "react"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { RecordsTrashDialog } from "@/app/records/components/RecordsTrashDialog"
import { DeleteRecordCategory } from "@/app/records/components/DeleteRecordCategory"
import { useRecordsBulkActions } from "@/app/records/hooks/useRecordsBulkActions"
import { deleteRecord, deleteRecordCategory, getRecordTrash, restoreRecord, restoreRecordCategory, updateRecord } from "@/app/records/actions"
import type { RecordCategory, RecordItem } from "@/app/records/actions"
import type { TrashItem } from "@/app/records/trash-actions"
import { toast } from "sonner"

jest.mock("@/app/records/actions", () => ({
  deleteRecord: jest.fn(), deleteRecordCategory: jest.fn(), getRecordTrash: jest.fn(),
  restoreRecord: jest.fn(), restoreRecordCategory: jest.fn(), updateRecord: jest.fn(),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const category = { id: "collection", name: "Populated collection" } as RecordCategory
const root: TrashItem = { id: category.id, kind: "category", title: category.name, deleted_at: "2026-11-01T12:00:00Z", deletion_root_category_id: category.id }
const standalone: TrashItem = { id: "standalone", kind: "record", title: "Earlier deleted record", deleted_at: root.deleted_at }

beforeEach(() => jest.resetAllMocks())

it("confirms the full collection including hidden records, supports cancel, and retains truthful errors", async () => {
  const onDeleted = jest.fn()
  render(<DeleteRecordCategory category={category} disabled={false} onDeleted={onDeleted} />)
  fireEvent.click(screen.getByRole("button", { name: "Delete collection" }))
  expect(screen.getByText(/including records hidden by your current filters/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(deleteRecordCategory).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Delete collection" }))
  jest.mocked(deleteRecordCategory).mockResolvedValueOnce({ error: "Not authenticated" }).mockResolvedValueOnce({ success: true })
  fireEvent.click(screen.getByRole("button", { name: "Move collection to Trash" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Not authenticated")
  expect(onDeleted).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Move collection to Trash" }))
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  expect(deleteRecordCategory).toHaveBeenLastCalledWith(category.id)
})

it("shows only batch roots and standalone records and refreshes after restoration", async () => {
  jest.mocked(getRecordTrash).mockResolvedValueOnce({ items: [root, standalone,
    { ...root, id: "child", title: "Batch child" },
    { ...root, id: "contained", kind: "record", title: "Batch record" },
  ], error: null }).mockResolvedValueOnce({ items: [standalone], error: null })
  jest.mocked(restoreRecordCategory).mockResolvedValue({ success: true })
  const refresh = jest.fn()
  render(<RecordsTrashDialog siteId="site" onClose={jest.fn()} onRestored={refresh} />)
  fireEvent.click(await screen.findByRole("button", { name: `Restore ${category.name}` }))
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  expect(restoreRecordCategory).toHaveBeenCalledWith(category.id)
  expect(restoreRecord).not.toHaveBeenCalled()
  expect(screen.queryByText("Batch child")).not.toBeInTheDocument()
  expect(screen.queryByText("Batch record")).not.toBeInTheDocument()
  expect(await screen.findByText(standalone.title)).toBeVisible()
})

it("does not describe an authorization failure as empty Trash", async () => {
  jest.mocked(getRecordTrash).mockResolvedValue({ items: null, error: "Not authorized to view Trash" })
  render(<RecordsTrashDialog siteId="site" onClose={jest.fn()} onRestored={jest.fn()} />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized to view Trash")
  expect(screen.queryByText("Trash is empty.")).not.toBeInTheDocument()
})

it("keeps an individual item when restore fails and never reports success", async () => {
  jest.mocked(getRecordTrash).mockResolvedValue({ items: [standalone], error: null })
  jest.mocked(restoreRecord).mockResolvedValue({ error: "Restore the parent collection first" })
  const refresh = jest.fn()
  render(<RecordsTrashDialog siteId="site" onClose={jest.fn()} onRestored={refresh} />)
  fireEvent.click(await screen.findByRole("button", { name: `Restore ${standalone.title}` }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Restore the parent collection first")
  expect(screen.getByText(standalone.title)).toBeVisible()
  expect(refresh).not.toHaveBeenCalled()
})

it("blocks duplicate collection submissions while pending", async () => {
  let resolve!: (result: { success: true }) => void
  jest.mocked(deleteRecordCategory).mockReturnValue(new Promise(done => { resolve = done }))
  render(<DeleteRecordCategory category={category} disabled={false} onDeleted={jest.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Delete collection" }))
  fireEvent.click(screen.getByRole("button", { name: "Move collection to Trash" }))
  expect(screen.getByRole("button", { name: "Moving..." })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await act(async () => resolve({ success: true }))
  expect(deleteRecordCategory).toHaveBeenCalledTimes(1)
})

it("restores an individual record and then displays confirmed empty Trash", async () => {
  jest.mocked(getRecordTrash).mockResolvedValueOnce({ items: [standalone], error: null })
    .mockResolvedValueOnce({ items: [], error: null })
  jest.mocked(restoreRecord).mockResolvedValue({ success: true })
  const refresh = jest.fn()
  render(<RecordsTrashDialog siteId="site" onClose={jest.fn()} onRestored={refresh} />)
  fireEvent.click(await screen.findByRole("button", { name: `Restore ${standalone.title}` }))
  expect(await screen.findByText("Trash is empty.")).toBeVisible()
  expect(restoreRecord).toHaveBeenCalledWith(standalone.id)
  expect(refresh).toHaveBeenCalledTimes(1)
})

it("ignores an older StrictMode read that settles after the current read", async () => {
  let resolve!: (value: { items: TrashItem[]; error: null }) => void
  jest.mocked(getRecordTrash).mockReturnValueOnce(new Promise(done => { resolve = done }))
    .mockResolvedValueOnce({ items: [], error: null })
  render(<React.StrictMode><RecordsTrashDialog siteId="site" onClose={jest.fn()} onRestored={jest.fn()} /></React.StrictMode>)
  expect(await screen.findByText("Trash is empty.")).toBeVisible()
  await act(async () => resolve({ items: [standalone], error: null }))
  expect(screen.queryByText(standalone.title)).not.toBeInTheDocument()
})

it("checks resolved bulk errors, retains failed selections and refreshes partial changes", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true)
  jest.mocked(deleteRecord).mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ error: "Not authorized" })
  const refresh = jest.fn()
  const { result } = renderHook(() => useRecordsBulkActions([], refresh))
  act(() => result.current.setSelectedRecords(new Set(["ok", "denied"])))
  await act(() => result.current.handleBulkDelete())
  expect(result.current.selectedRecords).toEqual(new Set(["denied"]))
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Not authorized"))
  expect(refresh).toHaveBeenCalled()
  jest.restoreAllMocks()
})

it("uses the loaded version for edits and never retries a stale write", async () => {
  jest.mocked(updateRecord).mockResolvedValue({ error: "Record changed. Reload before saving." })
  const records = [{ id: "record", updated_at: "loaded-version" }] as RecordItem[]
  const { result } = renderHook(() => useRecordsBulkActions(records, jest.fn()))
  act(() => result.current.setSelectedRecords(new Set(["record"])))
  await act(() => result.current.handleBulkStatusChange("active"))
  expect(updateRecord).toHaveBeenCalledTimes(1)
  expect(updateRecord).toHaveBeenCalledWith("record", { status: "active" }, "loaded-version")
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Record changed"))
})
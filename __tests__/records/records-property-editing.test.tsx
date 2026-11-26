/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { RECORDS_TABLE_PAGE_SIZES, RecordsTable } from "@/app/records/components/RecordsTable"
import { RecordsCalendarViews } from "@/app/records/components/records-calendar-views"
import { recordPropertyUpdate } from "@/app/records/lib/record-properties"
import { resolveRelationsForSidebar, type RecordCategory, type RecordItem } from "@/app/records/actions"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
jest.mock("@/app/records/hooks/useRelationOptions", () => ({
  useRelationOptions: () => ({
    relationOptions: { team_member: [{ id: "replacement-id", label: "Jordan" }] },
    relationErrors: {}, handleSearchChange: jest.fn(),
  }),
}))

const category: RecordCategory = {
  id: "category", site_id: "site", name: "Orders", description: null, icon: null,
  created_at: "2026-06-12T12:00:00Z", updated_at: "2026-06-12T12:00:00Z",
  template_fields: [
    { id: "amount", name: "amount", label: "Amount", type: "number" },
    { id: "paid", name: "paid", label: "Paid", type: "boolean" },
    { id: "owner", name: "owner", label: "Owner", type: "relation", relationTarget: "team_member" },
    { id: "priority", name: "priority", label: "Priority", type: "select", options: ["Low", "High"] },
  ],
}
const record: RecordItem = {
  id: "record", site_id: "site", category_id: category.id, category,
  title: "Order A", description: "Old description", status: "draft",
  data: { amount: 0, paid: false }, relations: { owner: "owner-id", historical: "other-id" },
  created_at: category.created_at, updated_at: category.updated_at,
}

function renderTable(activeCategory?: RecordCategory, onSave = jest.fn().mockResolvedValue({}), records = [record]) {
  const onOpen = jest.fn()
  const onAdd = jest.fn().mockResolvedValue({})
  const onManage = jest.fn()
  const onView = jest.fn()
  render(<RecordsTable records={records} categories={[category]} activeCategory={activeCategory}
    currentPage={1} itemsPerPage={RECORDS_TABLE_PAGE_SIZES[0]} totalRecords={records.length} onPageChange={jest.fn()} onItemsPerPageChange={jest.fn()}
    selectedRecords={new Set()} onToggleRecordSelection={jest.fn()} onRecordClick={onOpen} onSaveProperty={onSave}
    onAddProperty={onAdd} onManageProperties={onManage} onViewCategory={onView} />)
  return { onOpen, onSave, onAdd, onManage, onView }
}

beforeEach(() => {
  jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "team_member:owner-id": "Alex" })
})

it("shows category fields in order, resolves relation labels, and edits a cell without opening the record", async () => {
  const { onOpen, onSave } = renderTable(category)
  expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual([
    "Title", "Notes", "Status", "Created At", "Amount", "Paid", "Owner", "Priority", "",
  ])
  expect(screen.getByText("0")).toBeInTheDocument()
  expect(screen.getByText("No")).toBeInTheDocument()
  expect(await screen.findByText("Alex")).toBeInTheDocument()
  act(() => screen.getByRole("button", { name: "Edit Amount for Order A" }).focus())
  const input = screen.getByRole("spinbutton", { name: "Amount" })
  expect(input).toHaveFocus()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
  fireEvent.change(input, { target: { value: "42.5" } })
  fireEvent.keyDown(input, { key: "Enter" })
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  expect(onSave).toHaveBeenCalledWith(record, { data: { amount: 42.5, paid: false } })
  expect(onOpen).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Open record: Order A" }))
  expect(onOpen).toHaveBeenCalledWith(record)
})

it("keeps inline editing and category navigation in All records without row property buttons", async () => {
  const { onOpen, onSave, onView } = renderTable(undefined, jest.fn().mockResolvedValue({ error: "Record changed", conflict: true }))
  expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument()
  expect(screen.queryByRole("columnheader", { name: "Paid" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit properties for Order A" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Orders" }))
  expect(onView).toHaveBeenCalledWith(category)
  fireEvent.click(screen.getByRole("button", { name: "Edit Status for Order A" }))
  fireEvent.click(screen.getByRole("option", { name: "Published" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Record changed")
  expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument()
  expect(onSave).toHaveBeenCalledWith(record, { status: "published" })
  expect(onOpen).not.toHaveBeenCalled()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("discards an inline draft with Escape without reopening the editor or saving", () => {
  const { onSave } = renderTable()
  act(() => screen.getByRole("button", { name: "Edit Title for Order A" }).focus())
  const input = screen.getByRole("textbox", { name: "Title" })
  fireEvent.change(input, { target: { value: "Abandoned draft" } })
  fireEvent.keyDown(input, { key: "Escape" })
  expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Edit Title for Order A" })).toHaveFocus()
  expect(onSave).not.toHaveBeenCalled()
})

it.each([undefined, category])("puts notes in their own editable cell", async activeCategory => {
  const { onSave } = renderTable(activeCategory)
  const title = screen.getByRole("button", { name: "Edit Title for Order A" })
  const notes = screen.getByRole("button", { name: "Edit Notes for Order A" })
  expect(screen.getByRole("columnheader", { name: "Notes" })).toBeInTheDocument()
  expect(title.closest("td")).not.toBe(notes.closest("td"))
  expect(notes).toHaveTextContent("Old description")
  act(() => notes.focus())
  fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "First line\nSecond line" } })
  act(() => screen.getByRole("button", { name: "Open record: Order A" }).focus())
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(record, { description: "First line\nSecond line" }))
  if (activeCategory) await screen.findByText("Alex")
})

it("opens the relation menu on focus and saves as soon as an option is picked", async () => {
  const { onSave } = renderTable(category)
  await screen.findByText("Alex")
  act(() => screen.getByRole("button", { name: "Edit Owner for Order A" }).focus())
  const input = screen.getByRole("combobox", { name: "Owner" })
  expect(input).toHaveFocus()
  const option = await screen.findByRole("option", { name: "Jordan" })
  expect(fireEvent.mouseDown(option)).toBe(false)
  fireEvent.click(option)
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(record, { relations: { owner: "replacement-id", historical: "other-id" } }))
  expect(screen.queryByRole("listbox", { name: "Owner" })).not.toBeInTheDocument()
})

it("lets the user choose a select option with the keyboard and saves immediately", async () => {
  const { onSave } = renderTable(category)
  await screen.findByText("Alex")
  act(() => screen.getByRole("button", { name: "Edit Priority for Order A" }).focus())
  const input = screen.getByRole("combobox", { name: "Priority" })
  expect(screen.getByRole("listbox", { name: "Priority" })).toBeInTheDocument()
  fireEvent.keyDown(input, { key: "ArrowDown" })
  fireEvent.keyDown(input, { key: "ArrowDown" })
  fireEvent.keyDown(input, { key: "Enter" })
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(record, { data: { amount: 0, paid: false, priority: "High" } }))
  expect(screen.queryByRole("listbox", { name: "Priority" })).not.toBeInTheDocument()
})

it("adds a typed property from the header of an empty category", async () => {
  const { onAdd, onManage, onView } = renderTable(category, undefined, [])
  fireEvent.click(screen.getByRole("button", { name: "Amount" }))
  expect(onManage).toHaveBeenCalledWith(category, "amount")
  const trigger = screen.getByRole("button", { name: "Add property" })
  expect(trigger.closest("th")).not.toBeNull()
  expect(trigger.textContent).toBe("")
  fireEvent.click(trigger)
  const dialog = within(screen.getByRole("dialog", { name: "Add property" }))
  fireEvent.change(dialog.getByLabelText("Property name"), { target: { value: "Stage" } })
  fireEvent.change(dialog.getByLabelText("Property type"), { target: { value: "select" } })
  fireEvent.click(dialog.getByRole("button", { name: "Add" }))
  expect(dialog.getByRole("alert")).toHaveTextContent("Add at least one select option")
  expect(onAdd).not.toHaveBeenCalled()
  fireEvent.change(dialog.getByLabelText("Options (one per line)"), { target: { value: "Low\nHigh" } })
  fireEvent.click(dialog.getByRole("button", { name: "Add" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(onAdd).toHaveBeenCalledWith(category, expect.objectContaining({ label: "Stage", type: "select", options: ["Low", "High"] }))
  expect(onView).not.toHaveBeenCalled()
})

it("uses the selected category for a property added from All records", async () => {
  const { onAdd, onView } = renderTable()
  fireEvent.click(screen.getByRole("button", { name: "Add property" }))
  expect(screen.queryByLabelText("Property name")).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: category.id } })
  fireEvent.change(screen.getByLabelText("Property name"), { target: { value: "Reference" } })
  fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
  await waitFor(() => expect(onView).toHaveBeenCalledWith(category))
  expect(onAdd).toHaveBeenCalledWith(category, expect.objectContaining({ label: "Reference", type: "text" }))
})

it("stores relation edits separately without discarding other links", () => {
  expect(recordPropertyUpdate(record, { key: "field", label: "Owner", field: category.template_fields[2] }, null))
    .toEqual({ relations: { owner: null, historical: "other-id" } })
})

it("exposes separate open and edit actions in the calendar", async () => {
  const date = new Date(2026, 5, 12, 12)
  const onSave = jest.fn().mockResolvedValue({})
  const onOpen = jest.fn()
  render(<RecordsCalendarViews records={[record]} selectedDate={date} viewMode="month"
    onRecordClick={onOpen} onSaveProperty={onSave}
    time={{ currentDate: date, currentTime: date, isToday: () => false, isSameDay: () => false, getCurrentTimePosition: () => 0 }} />)
  const edit = screen.getByRole("button", { name: "Edit properties for Order A" })
  expect(edit).toHaveClass("[@media(hover:hover)]:opacity-0", "group-hover/record:opacity-100", "focus-visible:opacity-100")
  fireEvent.click(edit)
  fireEvent.click(screen.getByRole("button", { name: "Description Old description" }))
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Updated description" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(onSave).toHaveBeenCalledWith(record, { description: "Updated description" })
  expect(onOpen).not.toHaveBeenCalled()
  fireEvent.click(screen.getByTitle("Open record"))
  expect(onOpen).toHaveBeenCalledWith(record.id, [record.id])
})
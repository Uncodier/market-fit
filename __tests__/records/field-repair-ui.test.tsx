import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RecordDynamicForm } from "@/app/records/[id]/components/RecordDynamicForm"
import { CategoryTemplateEditor } from "@/app/records/components/CategoryTemplateEditor"
import type { RecordCategory, RecordItem } from "@/app/records/actions"
import type { RelationSelect } from "@/app/components/ui/relation-select"

jest.mock("@/app/records/actions", () => ({ deleteRecordCategory: jest.fn() }))

type SelectProps = React.PropsWithChildren<{ value: string; onValueChange: (value: string) => void }>

const mockSearch = jest.fn()
const mockRelationOptions = jest.fn(() => ({
  relationOptions: {
    "record:category-a": [{ id: "record-a", label: "Category A record" }],
    "record:category-b": [{ id: "record-b", label: "Category B record" }],
  },
  relationErrors: { person: "This relation target is no longer supported." },
  handleSearchChange: mockSearch,
}))
jest.mock("@/app/records/[id]/components/use-relation-options", () => ({
  useRelationOptions: (...args: unknown[]) => mockRelationOptions(...args as []),
}))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/records/[id]/components/AIFieldPreview", () => ({ AIFieldPreview: () => null }))
jest.mock("@/app/records/[id]/components/TableWidget", () => ({ TableWidget: () => null }))
jest.mock("@/app/components/ui/emoji-picker", () => ({ EmojiPicker: () => null }))
jest.mock("@/app/components/ui/date-picker", () => ({
  DatePicker: ({ date, setDate }: { date?: Date; setDate: (date?: Date) => void }) => (
    <div>
      <output data-testid="date-value">{date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : "empty"}</output>
      <button onClick={() => setDate(new Date(2026, 2, 8))}>Pick date</button>
      <button onClick={() => setDate(undefined)}>Clear date</button>
    </div>
  ),
}))
jest.mock("@/app/components/ui/select", () => {
  const Context = React.createContext<{ value: string; onValueChange: (value: string) => void }>({ value: "", onValueChange: () => {} })
  return {
    Select: ({ value, onValueChange, children }: SelectProps) => <Context.Provider value={{ value, onValueChange }}>{children}</Context.Provider>,
    SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: React.PropsWithChildren) => {
      const { value, onValueChange } = React.useContext(Context)
      return <select aria-label="Select value" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>
    },
    SelectItem: ({ children, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) => <option {...props}>{children}</option>,
  }
})
jest.mock("@/app/components/ui/relation-select", () => ({
  RelationSelect: ({ label, options, allowCreate, onValueChange, onSearchChange }: React.ComponentProps<typeof RelationSelect>) => (
    <div data-testid={`picker-${label}`} data-allow-create={String(allowCreate)}>
      {options.map(option => <button key={option.id} onClick={() => onValueChange({ mode: "existing", ...option })}>{option.label}</button>)}
      <button onClick={() => onValueChange({ mode: "create", label: "Unexpected value" })}>Attempt create {label}</button>
      <button onClick={() => onValueChange(null)}>Clear {label}</button>
      <button onClick={() => onSearchChange?.("query")}>Search {label}</button>
    </div>
  ),
}))

const field = (name: string, type: string, extra = {}) => ({ id: name, name, type, ...extra })
const baseProps = { status: "draft", record: { site_id: "site-a" } as RecordItem, onStatusChange: jest.fn(), relationsData: {}, formData: {} }

describe("RecordDynamicForm field repairs", () => {
  beforeEach(() => jest.clearAllMocks())

  it("does not load relation options under a different active site", () => {
    render(<RecordDynamicForm {...baseProps} record={{ site_id: "other-site" } as RecordItem}
      onChange={jest.fn()} fields={[field("client", "relation", { relationTarget: "lead" })]} />)
    expect(mockRelationOptions).toHaveBeenCalledWith(expect.any(Array), undefined, [])
  })

  it("exposes stable accessible names for field groups and text inputs", () => {
    render(<RecordDynamicForm {...baseProps} onChange={jest.fn()} fields={[
      field("reference", "text", { label: "Reference" }),
      field("notes", "description", { label: "Notes" }),
      field("place", "location", { label: "Place" }),
    ]} />)
    for (const name of ["Reference", "Notes", "Place"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name })).toBeInTheDocument()
    }
  })

  it("shows numeric zero and keeps label separate from the storage key", () => {
    const onChange = jest.fn()
    render(<RecordDynamicForm {...baseProps} onChange={onChange} fields={[field("count", "number", { label: "Quantity", min: 0, max: 10 })]} formData={{ count: 0 }} />)
    const input = screen.getByRole("spinbutton", { name: "Quantity" })
    expect(input).toHaveValue(0)
    expect(input).toHaveAttribute("min", "0")
    fireEvent.change(input, { target: { value: "3" } })
    expect(onChange).toHaveBeenLastCalledWith("count", 3, "field")
    fireEvent.change(input, { target: { value: "" } })
    expect(onChange).toHaveBeenLastCalledWith("count", null, "field")
  })

  it("uses date-only serialization and local display", () => {
    const onChange = jest.fn()
    render(<RecordDynamicForm {...baseProps} onChange={onChange} fields={[field("day", "date")]} formData={{ day: "2026-03-08" }} />)
    expect(screen.getByTestId("date-value")).toHaveTextContent("2026-3-8")
    fireEvent.click(screen.getByText("Pick date"))
    expect(onChange).toHaveBeenLastCalledWith("day", "2026-03-08", "field")
    fireEvent.click(screen.getByText("Clear date"))
    expect(onChange).toHaveBeenLastCalledWith("day", null, "field")
  })

  it("distinguishes optional unset, false and true booleans", () => {
    const onChange = jest.fn()
    const props = { ...baseProps, onChange, fields: [field("approved", "boolean")] }
    const { rerender } = render(<RecordDynamicForm {...props} />)
    let select = screen.getAllByRole("combobox")[1]
    expect(select).toHaveValue("unset")
    fireEvent.change(select, { target: { value: "false" } })
    expect(onChange).toHaveBeenLastCalledWith("approved", false, "field")
    rerender(<RecordDynamicForm {...props} formData={{ approved: false }} />)
    select = screen.getAllByRole("combobox")[1]
    expect(select).toHaveValue("false")
    fireEvent.change(select, { target: { value: "true" } })
    expect(onChange).toHaveBeenLastCalledWith("approved", true, "field")
    fireEvent.change(select, { target: { value: "unset" } })
    expect(onChange).toHaveBeenLastCalledWith("approved", null, "field")
  })

  it("closes enum creation and uses category-specific relation lookup and search", () => {
    const onChange = jest.fn()
    const fields = [field("state", "select", { options: ["Open"] }), field("first", "relation", { relationTarget: "record", targetCategoryId: "category-a" }), field("second", "relation", { relationTarget: "record", targetCategoryId: "category-b" })]
    render(<RecordDynamicForm {...baseProps} fields={fields} onChange={onChange} relationsData={{ first: "record-a" }} />)
    for (const name of ["state", "first", "second"]) {
      expect(screen.getByTestId(`picker-${name}`)).toHaveAttribute("data-allow-create", "false")
      fireEvent.click(screen.getByText(`Attempt create ${name}`))
    }
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("Open"))
    expect(onChange).toHaveBeenLastCalledWith("state", "Open", "field")
    fireEvent.click(screen.getByText("Category B record"))
    expect(onChange).toHaveBeenLastCalledWith("second", "record-b", "relation")
    fireEvent.click(screen.getByText("Search first"))
    expect(mockSearch).toHaveBeenLastCalledWith("record:category-a", "query")
    expect(mockRelationOptions).toHaveBeenCalledWith(fields, "site-a", ["record-a"])
  })

  it("surfaces relation load errors instead of presenting them as empty results", () => {
    render(<RecordDynamicForm {...baseProps} fields={[field("contact", "relation", { relationTarget: "person" })]} onChange={jest.fn()} />)
    expect(screen.getByRole("alert")).toHaveTextContent("This relation target is no longer supported.")
  })
})

describe("CategoryTemplateEditor field repairs", () => {
  it("clears incompatible bounds when a new field changes from number to text", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    render(<CategoryTemplateEditor isOpen onClose={jest.fn()} onSave={onSave} category={{ id: "cat", name: "Category", template_fields: [] } as unknown as RecordCategory} />)
    fireEvent.click(screen.getByText("Add Field"))
    fireEvent.change(screen.getByLabelText("Field Name (Storage Key)"), { target: { value: "new_field" } })
    const type = screen.getAllByRole("combobox").find(select => [...(select as HTMLSelectElement).options].some(option => option.value === "number"))!
    fireEvent.change(type, { target: { value: "number" } })
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "0" } })
    fireEvent.change(screen.getByLabelText("Maximum"), { target: { value: "10" } })
    fireEvent.change(type, { target: { value: "text" } })
    fireEvent.change(screen.getByLabelText("Minimum Length"), { target: { value: "2" } })
    fireEvent.click(screen.getByText("Save Template"))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0][0].template_fields[0]
    expect(saved).toMatchObject({ name: "new_field", type: "text", minLength: 2 })
    expect(saved).not.toHaveProperty("min")
    expect(saved).not.toHaveProperty("max")
  })

  it("clears record category scope on target change and relation metadata on type change", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    const category = { id: "cat", name: "Category", template_fields: [field("related", "relation", { relationTarget: "record", targetCategoryId: "target" })] } as RecordCategory
    const { unmount } = render(<CategoryTemplateEditor isOpen onClose={jest.fn()} onSave={onSave} category={category} />)
    fireEvent.click(screen.getByText("related"))
    const target = screen.getAllByRole("combobox").find(select => [...(select as HTMLSelectElement).options].some(option => option.value === "lead"))!
    fireEvent.change(target, { target: { value: "lead" } })
    fireEvent.click(screen.getByText("Save Template"))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].template_fields[0]).toMatchObject({ name: "related", relationTarget: "lead" })
    expect(onSave.mock.calls[0][0].template_fields[0]).not.toHaveProperty("targetCategoryId")
    unmount()
    render(<CategoryTemplateEditor isOpen onClose={jest.fn()} onSave={onSave} category={category} />)
    fireEvent.click(screen.getByText("related"))
    const type = screen.getAllByRole("combobox").find(select => [...(select as HTMLSelectElement).options].some(option => option.value === "number"))!
    fireEvent.change(type, { target: { value: "number" } })
    fireEvent.click(screen.getByText("Save Template"))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    const saved = onSave.mock.calls[1][0].template_fields[0]
    expect(saved).toMatchObject({ name: "related", type: "number" })
    expect(saved).not.toHaveProperty("relationTarget")
    expect(saved).not.toHaveProperty("targetCategoryId")
  })

  it("preserves existing storage keys while saving a label, required flag and zero bound", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    render(<CategoryTemplateEditor isOpen onClose={jest.fn()} category={{ id: "cat", name: "Category", template_fields: [field("count", "number")] } as RecordCategory} onSave={onSave} />)
    fireEvent.click(screen.getByText("count"))
    expect(screen.getByLabelText("Field Name (Storage Key)")).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Display Label (Optional)"), { target: { value: "Quantity" } })
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "0" } })
    fireEvent.click(screen.getByLabelText("Required"))
    fireEvent.click(screen.getByText("Save Template"))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ template_fields: [expect.objectContaining({ name: "count", label: "Quantity", required: true, min: 0 })] })))
  })

  it("offers supplier and category-scoped records but not new person targets", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    render(<CategoryTemplateEditor isOpen onClose={jest.fn()} onSave={onSave} category={{ id: "cat", name: "Category", template_fields: [] } as unknown as RecordCategory} categories={[{ id: "target", name: "Target category" } as RecordCategory]} />)
    fireEvent.click(screen.getByText("Add Field"))
    expect(screen.getByLabelText("Field Name (Storage Key)")).not.toBeDisabled()
    fireEvent.change(screen.getByLabelText("Field Name (Storage Key)"), { target: { value: "related" } })
    const type = screen.getAllByRole("combobox").find(select => [...(select as HTMLSelectElement).options].some(option => option.value === "relation"))!
    fireEvent.change(type, { target: { value: "relation" } })
    expect(screen.getByRole("option", { name: "Supplier" })).toBeEnabled()
    expect(screen.queryByRole("option", { name: /Contact \/ Person/ })).not.toBeInTheDocument()
    const target = screen.getAllByRole("combobox").find(select => [...(select as HTMLSelectElement).options].some(option => option.value === "supplier"))!
    fireEvent.change(target, { target: { value: "record" } })
    expect(screen.getByText("Target Record Category")).toBeInTheDocument()
    expect(screen.getAllByRole("option", { name: "Target category" })).toHaveLength(2)
    const category = screen.getAllByRole("combobox").find(select => [...(select as HTMLSelectElement).options].some(option => option.value === "any"))!
    fireEvent.change(category, { target: { value: "target" } })
    fireEvent.click(screen.getByText("Save Template"))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ template_fields: [expect.objectContaining({ name: "related", relationTarget: "record", targetCategoryId: "target" })] })))
  })

  it("retains the disabled legacy person target", () => {
    render(<CategoryTemplateEditor isOpen onClose={jest.fn()} onSave={jest.fn()} category={{ id: "cat", name: "Category", template_fields: [field("contact", "relation", { relationTarget: "person" })] } as RecordCategory} />)
    fireEvent.click(screen.getByText("contact"))
    expect(screen.getByRole("option", { name: "Contact / Person (Legacy)" })).toBeDisabled()
  })
})
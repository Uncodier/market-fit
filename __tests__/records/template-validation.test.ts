import { validateScalarValue, validateTemplateFields, validateTemplateFieldUpdate } from "@/app/records/lib/template-validation"

const field = { id: "stable", name: "Storage Key", type: "number", required: true, min: 0, max: 5 }

describe("record template validation", () => {
  it("preserves legacy human-readable keys and optional display labels", () => {
    expect(validateTemplateFields([{ ...field, label: "Visible label" }]).valid).toBe(true)
    expect(validateTemplateFields([
      { id: "ai-feedback-rating", name: "Rating", type: "select", options: ["Like", "Dislike", "Error"] },
      { id: "ai-feedback-source", name: "Source", type: "select", options: ["Robots", "Chat"] },
    ]).valid).toBe(true)
  })
  it.each([
    null, {}, [{ ...field, id: "" }], [{ ...field, name: "__proto__" }],
    [field, field], [{ ...field, type: "unknown" }], [{ ...field, required: "true" }],
    [{ ...field, min: 9 }], [{ ...field, max: Infinity }],
    [{ id: "x", name: "Choice", type: "select", options: ["A", "A"] }],
    [{ id: "x", name: "Link", type: "relation", relationTarget: "users" }],
    [{ id: "x", name: "Link", type: "relation", targetCategoryId: "bad" }],
  ])("rejects malformed schemas %j", fields => {
    expect(validateTemplateFields(fields).valid).toBe(false)
  })
  it("blocks populated destructive schema changes while allowing labels/reordering", () => {
    expect(validateTemplateFieldUpdate([field], [{ ...field, label: "New label" }], true).valid).toBe(true)
    expect(validateTemplateFieldUpdate([field], [{ ...field, name: "New key" }], false).valid).toBe(false)
    expect(validateTemplateFieldUpdate([field], [], true).valid).toBe(false)
    expect(validateTemplateFieldUpdate([field], [{ ...field, id: "replacement", name: "Renamed" }], true).valid).toBe(false)
    expect(validateTemplateFieldUpdate([field], [{ ...field, id: "replacement" }], true).valid).toBe(false)
    expect(validateTemplateFieldUpdate(null, [{ ...field, required: false }], true).valid).toBe(true)
    expect(validateTemplateFieldUpdate([field], [{ id: field.id, name: field.name, type: "text" }], true).valid).toBe(false)
    const link = { id: "link", name: "Link", type: "relation", relationTarget: "lead" }
    expect(validateTemplateFieldUpdate([link], [{ ...link, relationTarget: "supplier" }], true).valid).toBe(false)
  })
  it("rejects tightening populated constraints and introducing person fields", () => {
    expect(validateTemplateFieldUpdate([field], [{ ...field, max: 4 }], true).valid).toBe(false)
    expect(validateTemplateFieldUpdate([field], [{ ...field, max: 6 }], true).valid).toBe(true)
    expect(validateTemplateFieldUpdate([], [field], true).valid).toBe(false)
    expect(validateTemplateFieldUpdate([], [{ id: "p", name: "Person", type: "relation", relationTarget: "person" }], false).valid).toBe(false)
  })
})

describe("record scalar validation", () => {
  it("does not confuse zero, false, and unset", () => {
    expect(validateScalarValue(field, 0, true).valid).toBe(true)
    expect(validateScalarValue({ id: "b", name: "Boolean", type: "boolean", required: true }, false, true).valid).toBe(true)
    expect(validateScalarValue(field, null, true).valid).toBe(false)
    expect(validateScalarValue(field, undefined, false).valid).toBe(true)
  })
  it.each(["1", NaN, Infinity, -1, 6, {}, []])("rejects nonnumeric/out-of-range input %j", value => {
    expect(validateScalarValue(field, value, true).valid).toBe(false)
  })
  it("enforces closed enums and text bounds", () => {
    const select = { id: "s", name: "State", type: "select", options: ["Open"] }
    expect(validateScalarValue(select, "Other", false).valid).toBe(false)
    expect(validateScalarValue(select, "Open", false).valid).toBe(true)
    expect(validateScalarValue({ id: "t", name: "Text", type: "text", minLength: 2, maxLength: 4 }, "x", false).valid).toBe(false)
  })
  it("accepts date-only and legacy timestamps but rejects rolled-over dates", () => {
    const date = { id: "d", name: "Date", type: "date" }
    for (const value of ["2024-02-29", "2024-02-29T10:20:00.000Z"]) expect(validateScalarValue(date, value, false).valid).toBe(true)
    for (const value of ["2025-02-29", "2024-13-01", "tomorrow", "2024-02-30T00:00:00Z"]) expect(validateScalarValue(date, value, false).valid).toBe(false)
  })
  it("preserves the editable table widget array-of-rows contract", () => {
    const table = { id: "t", name: "Table", type: "table" }
    expect(validateScalarValue(table, [], false).valid).toBe(true)
    expect(validateScalarValue(table, [{ "Column 1": "Text", "Column 2": 0 }], true).valid).toBe(true)
    expect(validateScalarValue(table, [{ nested: {} }], false).valid).toBe(false)
    for (const row of [0, false, null, "text", [], { nested: [] }, { invalid: Infinity }]) {
      expect(validateScalarValue(table, [row], false).valid).toBe(false)
    }
    expect(validateScalarValue(table, [{ empty: null, checked: false, count: 0, text: "" }], false).valid).toBe(true)
    expect(validateScalarValue({ ...table, required: true }, [], true).valid).toBe(false)
  })
})
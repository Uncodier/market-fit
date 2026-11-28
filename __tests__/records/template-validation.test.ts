import { validateScalarValue, validateTemplateFields, validateTemplateFieldUpdate } from "@/app/records/lib/template-validation"
import { formatRecordCurrency, recordFieldPresentation } from "@/app/records/lib/record-field-presentation"

const field = { id: "stable", name: "Storage Key", type: "number", required: true, min: 0, max: 5 }

it("adds and removes currency formatting without changing the storage key or numeric contract", () => {
  const money = { ...field, currency: { code: "MXN", display: "code" as const } }
  expect(recordFieldPresentation(money)).toBe("currency")
  expect(validateTemplateFieldUpdate([field], [money]).valid).toBe(true)
  expect(validateTemplateFieldUpdate([money], [field]).valid).toBe(true)
  expect(validateScalarValue(money, 0, true).valid).toBe(true)
  expect(validateScalarValue(money, "1.25", true).valid).toBe(false)
  expect(validateScalarValue(money, 6, true).valid).toBe(false)
  expect(formatRecordCurrency(1.25, money.currency)).toContain("MXN")
  expect(formatRecordCurrency(null, money.currency)).toBeUndefined()
})

it("rejects malformed currency metadata and currency metadata on non-numeric fields", () => {
  for (const currency of [{ code: "MX", display: "code" }, { code: "USD", display: "custom" }, { code: "USD", display: "code", extra: true }]) {
    expect(validateTemplateFields([{ ...field, currency }]).valid).toBe(false)
  }
  expect(validateTemplateFields([{ id: "x", name: "Title", type: "text", currency: { code: "USD", display: "symbol" } }]).valid).toBe(false)
})

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
  it("keeps storage keys immutable and defers value compatibility to PostgreSQL", () => {
    expect(validateTemplateFieldUpdate([field], [{ ...field, label: "New label" }]).valid).toBe(true)
    expect(validateTemplateFieldUpdate([field], [{ ...field, name: "New key" }]).valid).toBe(false)
    expect(validateTemplateFieldUpdate([field], []).valid).toBe(true)
    expect(validateTemplateFieldUpdate(null, [field]).valid).toBe(true)
    expect(validateTemplateFieldUpdate([field], [{ id: field.id, name: field.name, type: "text" }]).valid).toBe(true)
    expect(validateTemplateFieldUpdate([field], [{ ...field, max: 4 }]).valid).toBe(true)
    const link = { id: "link", name: "Link", type: "relation", relationTarget: "lead" }
    expect(validateTemplateFieldUpdate([link], [{ ...link, relationTarget: "supplier" }]).valid).toBe(true)
  })
  it("still rejects introducing person fields", () => {
    expect(validateTemplateFieldUpdate([], [{ id: "p", name: "Person", type: "relation", relationTarget: "person" }]).valid).toBe(false)
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
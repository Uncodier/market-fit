import { recordFieldDate, recordFieldLabel, serializeRecordFieldDate } from "@/app/records/lib/field-values"

describe("record field values", () => {
  it("round trips date-only values as local calendar dates", () => {
    for (const value of ["2026-01-01", "2026-03-08", "2026-11-01", "2024-02-29"]) {
      const date = recordFieldDate(value)!
      expect(date.getHours()).toBe(0)
      expect(date.getDate()).toBe(Number(value.slice(-2)))
      expect(serializeRecordFieldDate(date)).toBe(value)
    }
  })

  it("keeps legacy timestamps readable without rewriting their instant", () => {
    const value = "2026-03-08T23:30:00.000Z"
    expect(recordFieldDate(value)?.getTime()).toBe(new Date(value).getTime())
  })

  it("handles empty and invalid dates without throwing or rolling calendar days", () => {
    for (const value of [null, undefined, "", "invalid", "2026-02-30", "2026-13-01"]) {
      expect(recordFieldDate(value)).toBeUndefined()
    }
    expect(serializeRecordFieldDate(undefined)).toBeNull()
    expect(serializeRecordFieldDate(new Date("invalid"))).toBeNull()
  })

  it("uses optional labels only for display", () => {
    expect(recordFieldLabel({ name: "stored_key", label: "Friendly name" })).toBe("Friendly name")
    expect(recordFieldLabel({ name: "stored_key", label: " " })).toBe("stored_key")
  })
})
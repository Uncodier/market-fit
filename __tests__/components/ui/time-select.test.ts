import {
  buildTimeOptions,
  filterTimeOptions,
  normalizeTimeValue,
  parseTypedTime,
} from "@/app/components/ui/time-select"

describe("time select", () => {
  it("normalizes hour and strips seconds", () => {
    expect(normalizeTimeValue("9:00")).toBe("09:00")
    expect(normalizeTimeValue("09:15:00")).toBe("09:15")
    expect(normalizeTimeValue("")).toBe("")
  })

  it("builds 30-minute options and keeps off-grid values", () => {
    const options = buildTimeOptions(["09:15", "09:00"])
    const values = options.map((option) => option.value)

    expect(values).toContain("09:00")
    expect(values).toContain("09:30")
    expect(values).toContain("09:15")
    expect(values.indexOf("09:15")).toBeGreaterThan(values.indexOf("09:00"))
    expect(values.indexOf("09:15")).toBeLessThan(values.indexOf("09:30"))
    expect(values.filter((value) => value === "09:00")).toHaveLength(1)
  })

  it("parses typed hours in 12h and 24h forms", () => {
    expect(parseTypedTime("9")).toBe("09:00")
    expect(parseTypedTime("18")).toBe("18:00")
    expect(parseTypedTime("9:30")).toBe("09:30")
    expect(parseTypedTime("930")).toBe("09:30")
    expect(parseTypedTime("9am")).toBe("09:00")
    expect(parseTypedTime("9 pm")).toBe("21:00")
    expect(parseTypedTime("12am")).toBe("00:00")
    expect(parseTypedTime("12pm")).toBe("12:00")
    expect(parseTypedTime("6p")).toBe("18:00")
    expect(parseTypedTime("25")).toBeNull()
    expect(parseTypedTime("")).toBeNull()
  })

  it("filters suggestions to the typed hour and keeps off-grid values", () => {
    const options = buildTimeOptions()
    const filtered = filterTimeOptions(options, "18")
    expect(filtered.map((option) => option.value)).toEqual(["18:00", "18:30"])

    const offGrid = filterTimeOptions(options, "09:15")
    expect(offGrid.map((option) => option.value)).toContain("09:15")
    expect(offGrid.map((option) => option.value)).toContain("09:00")
  })
})

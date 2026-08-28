import { CONTEXT_COLLECTIONS } from "@/app/components/context/context-collections"

describe("Context Collections", () => {
  it("should have correct properties for all 8 collections", () => {
    expect(CONTEXT_COLLECTIONS).toHaveLength(8)
    
    const keys = CONTEXT_COLLECTIONS.map(c => c.key)
    expect(keys).toContain("leads")
    expect(keys).toContain("contents")
    expect(keys).toContain("campaigns")
    expect(keys).toContain("requirements")
    expect(keys).toContain("tasks")
    expect(keys).toContain("quotations")
    expect(keys).toContain("deals")
    expect(keys).toContain("records")

    CONTEXT_COLLECTIONS.forEach(col => {
      expect(col.label).toBeDefined()
      expect(col.navKey).toBeDefined()
      expect(col.icon).toBeDefined()
    })
  })
})

import { isSectionDirty, snapshotsDiffer, sectionCardShellClassName } from "@/app/components/ui/section-card"

describe("section card helpers", () => {
  it("detects dirty fields by path", () => {
    const dirtyFields = {
      about: true,
      goals: { yearly: true },
      swot: { strengths: true },
    }

    expect(isSectionDirty(dirtyFields, "about")).toBe(true)
    expect(isSectionDirty(dirtyFields, "currency")).toBe(false)
    expect(isSectionDirty(dirtyFields, "goals.yearly")).toBe(true)
    expect(isSectionDirty(dirtyFields, "goals.quarterly")).toBe(false)
    expect(isSectionDirty(dirtyFields, ["about", "currency"])).toBe(true)
    expect(isSectionDirty(dirtyFields, "swot")).toBe(true)
    expect(isSectionDirty(undefined, "about")).toBe(false)
  })

  it("compares snapshots", () => {
    expect(snapshotsDiffer({ a: 1 }, { a: 1 })).toBe(false)
    expect(snapshotsDiffer({ a: 1 }, { a: 2 })).toBe(true)
    expect(snapshotsDiffer(null, undefined)).toBe(false)
  })

  it("builds the table-matching shell class", () => {
    expect(sectionCardShellClassName()).toContain("rounded-xl")
    expect(sectionCardShellClassName()).toContain("border-border/70")
    expect(sectionCardShellClassName("mt-4")).toContain("mt-4")
  })
})

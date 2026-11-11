import {
  getRelationTargetConfig,
  keepSelectedRelationOptions,
  relationOptionSearchText,
  uniqueRelationTargets,
} from "@/app/records/[id]/components/relation-target"

describe("relation target helpers", () => {
  it("maps sales orders and suppliers to existing tables and rejects unsafe targets", () => {
    expect(getRelationTargetConfig("sales_order")?.table).toBe("sale_orders")
    expect(getRelationTargetConfig("supplier")?.table).toBe("suppliers")
    for (const target of ["person", "users", "arbitrary_table", "__proto__", "constructor"]) {
      expect(getRelationTargetConfig(target)).toBeNull()
    }
  })

  it("separates internal relation options by expected category", () => {
    expect(uniqueRelationTargets([
      { type: "relation", relationTarget: "record", targetCategoryId: "category-a" },
      { type: "relation", relationTarget: "record", targetCategoryId: "category-b" },
    ])).toEqual(["record:category-a", "record:category-b"])
  })
  it("maps lead fields to the leads table", () => {
    expect(getRelationTargetConfig("lead")).toEqual({
      table: "leads",
      selectFields: "id, name, company",
      nameField: "name",
      idField: "id",
    })
  })

  it("maps team members through site membership user IDs", () => {
    expect(getRelationTargetConfig("team_member")).toEqual({
      table: "site_members",
      selectFields: "user_id, name, email",
      nameField: "name",
      idField: "user_id",
    })
  })

  it("collects unique relation targets from template fields", () => {
    expect(
      uniqueRelationTargets([
        { type: "text" },
        { type: "relation" },
        { type: "relation", relationTarget: "lead" },
        { type: "relation", relationTarget: "company" },
      ]),
    ).toEqual(["lead", "company"])
  })

  it("builds search text from string columns only", () => {
    expect(
      relationOptionSearchText(
        { id: "1", name: "EMMANUEL ALEJANDRO PINEDA LOPEZ", company: { name: "Acme" } },
        "name",
      ),
    ).toBe("EMMANUEL ALEJANDRO PINEDA LOPEZ")
  })

  it("keeps the selected option when a new search page omits it", () => {
    const selected = { id: "selected", label: "Current client" }
    const incoming = [{ id: "2", label: "EMMANUEL ALEJANDRO PINEDA LOPEZ" }]
    expect(
      keepSelectedRelationOptions(incoming, [selected], new Set(["selected"])),
    ).toEqual([
      { id: "2", label: "EMMANUEL ALEJANDRO PINEDA LOPEZ" },
      selected,
    ])
  })
})

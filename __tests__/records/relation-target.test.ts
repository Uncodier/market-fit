import {
  getRelationTargetConfig,
  keepSelectedRelationOptions,
  relationOptionSearchText,
  uniqueRelationTargets,
} from "@/app/records/[id]/components/relation-target"

describe("relation target helpers", () => {
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

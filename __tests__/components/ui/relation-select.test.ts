import {
  filterRelationSelectOptions,
  shouldFilterRelationSelectOptions,
} from "@/app/components/ui/relation-select-filter"

const options = [
  { id: "1", label: "Order - 3:45 PM (Ada)", searchText: "Ada" },
  { id: "2", label: "Window table", searchText: "notes for two" },
  { id: "3", label: "Order - 4:00 PM", searchText: "" },
]

describe("relation select filtering", () => {
  it("does not filter when the query is the committed selection", () => {
    expect(
      shouldFilterRelationSelectOptions(
        "Order - 3:45 PM (Ada)",
        "Order - 3:45 PM (Ada)",
      ),
    ).toBe(false)
    expect(
      filterRelationSelectOptions(options, "Order - 3:45 PM (Ada)", "Order - 3:45 PM (Ada)"),
    ).toEqual(options)
  })

  it("does not filter an empty query", () => {
    expect(shouldFilterRelationSelectOptions("", undefined)).toBe(false)
    expect(filterRelationSelectOptions(options, "")).toEqual(options)
  })

  it("filters once the user types a distinct query", () => {
    const filtered = filterRelationSelectOptions(
      options,
      "window",
      "Order - 3:45 PM (Ada)",
    )
    expect(filtered.map((option) => option.id)).toEqual(["2"])
  })

  it("matches the visible label even when searchText omits it", () => {
    const filtered = filterRelationSelectOptions(options, "4:00")
    expect(filtered.map((option) => option.id)).toEqual(["3"])
  })
})

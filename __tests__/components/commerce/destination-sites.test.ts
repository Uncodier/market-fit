import {
  mergeDestinationSites,
  sameDestinationSites,
} from "@/app/components/commerce/destination-sites"

describe("destination sites", () => {
  it("merges owned sites without duplicating memberships", () => {
    expect(
      mergeDestinationSites(
        [{ id: "a", name: "Corebooks" }],
        [
          { id: "a", name: "Corebooks" },
          { id: "b", name: "Pigs" },
        ]
      )
    ).toEqual([
      { id: "a", name: "Corebooks" },
      { id: "b", name: "Pigs" },
    ])
  })

  it("treats identical lists as unchanged so React can skip rerenders", () => {
    const list = [{ id: "a", name: "Corebooks" }]
    expect(sameDestinationSites(list, [{ id: "a", name: "Corebooks" }])).toBe(true)
    expect(sameDestinationSites(list, [{ id: "b", name: "Pigs" }])).toBe(false)
  })
})

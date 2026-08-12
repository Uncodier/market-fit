import {
  buildShopCategoryOffsets,
  groupItemsByCategory,
  SHOP_UNCATEGORIZED_NAME,
  uniqueCategoryNames,
} from "@/app/shop/[siteSlug]/shop-catalog-shared"

describe("groupItemsByCategory", () => {
  it("merges interleaved category runs into one section per name", () => {
    const sections = groupItemsByCategory([
      { id: "1", _shop: { categoryName: "Brews" } },
      { id: "2", _shop: { categoryName: "Coffee" } },
      { id: "3", _shop: { categoryName: "Brews" } },
    ])

    expect(sections.map((s) => s.name)).toEqual(["Brews", "Coffee"])
    expect(sections[0].items.map((i) => i.id)).toEqual(["1", "3"])
    expect(sections[1].items.map((i) => i.id)).toEqual(["2"])
  })

  it("buckets missing category names as Other", () => {
    const sections = groupItemsByCategory([{ id: "1" }, { id: "2", _shop: {} }])
    expect(sections).toEqual([
      {
        name: SHOP_UNCATEGORIZED_NAME,
        items: [{ id: "1" }, { id: "2", _shop: {} }],
      },
    ])
  })
})

describe("buildShopCategoryOffsets", () => {
  it("builds first-seen offsets and total counts per category", () => {
    const offsets = buildShopCategoryOffsets([
      "Combos",
      "Combos",
      "Brews",
      "Brews",
      "Brews",
      "Coffee",
      "Coffee",
    ])

    expect(offsets).toEqual([
      { name: "Combos", offset: 0, count: 2 },
      { name: "Brews", offset: 2, count: 3 },
      { name: "Coffee", offset: 5, count: 2 },
    ])
  })

  it("counts interleaved runs toward the same category total", () => {
    const offsets = buildShopCategoryOffsets([
      "Brews",
      "Brews",
      "Coffee",
      "Brews",
      "Tizanas",
      "Tizanas",
    ])

    expect(offsets).toEqual([
      { name: "Brews", offset: 0, count: 3 },
      { name: "Coffee", offset: 2, count: 1 },
      { name: "Tizanas", offset: 4, count: 2 },
    ])
  })

  it("treats empty names as Other", () => {
    const offsets = buildShopCategoryOffsets(["Brews", "", ""])
    expect(offsets).toEqual([
      { name: "Brews", offset: 0, count: 1 },
      { name: SHOP_UNCATEGORIZED_NAME, offset: 1, count: 2 },
    ])
  })
})

describe("uniqueCategoryNames", () => {
  it("drops duplicate names while preserving first-seen order", () => {
    expect(uniqueCategoryNames(["Brews", "Coffee", "Brews", "Pigs"])).toEqual([
      "Brews",
      "Coffee",
      "Pigs",
    ])
  })
})

import {
  buildShopCategoryOffsets,
  buildShopCategorySections,
  mapShopCategoryOffsetRows,
  countItemsByCategory,
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

describe("mapShopCategoryOffsetRows", () => {
  it("normalizes RPC rows into chip offsets", () => {
    expect(
      mapShopCategoryOffsetRows([
        { name: "Brews", offset: "0", count: "3" },
        { name: null, offset: 3, count: 1 },
      ])
    ).toEqual([
      { name: "Brews", offset: 0, count: 3 },
      { name: SHOP_UNCATEGORIZED_NAME, offset: 3, count: 1 },
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

describe("countItemsByCategory", () => {
  it("counts items per category name", () => {
    const counts = countItemsByCategory([
      { _shop: { categoryName: "Brews" } },
      { _shop: { categoryName: "Brews" } },
      { _shop: { categoryName: "Coffee" } },
      {},
    ])
    expect(counts.get("Brews")).toBe(2)
    expect(counts.get("Coffee")).toBe(1)
    expect(counts.get(SHOP_UNCATEGORIZED_NAME)).toBe(1)
  })
})

describe("buildShopCategorySections", () => {
  const offsets = [
    { name: "Coffee", offset: 0, count: 3 },
    { name: "Tea", offset: 3, count: 2 },
    { name: "Other", offset: 5, count: 1 },
  ]

  it("reserves missing slots in server category order, including entirely unloaded categories", () => {
    const items = [{ id: "tea", _shop: { categoryName: "Tea" } }]
    expect(buildShopCategorySections(items, offsets)).toEqual([
      { name: "Coffee", items: [], pendingCount: 3 },
      { name: "Tea", items, pendingCount: 1 },
      { name: "Other", items: [], pendingCount: 1 },
    ])
  })

  it("does not reserve slots for loaded items hidden by fulfillment", () => {
    const loaded = [{ id: "coffee", _shop: { categoryName: "Coffee" } }, { id: "other" }]
    const sections = buildShopCategorySections([], offsets, loaded)
    expect(sections).toEqual([
      { name: "Coffee", items: [], pendingCount: 2 },
      { name: "Tea", items: [], pendingCount: 2 },
    ])
  })

  it("handles missing metadata and stale counts without negative placeholder counts", () => {
    const items = [{ id: "one" }, { id: "two" }]
    expect(buildShopCategorySections(items, [{ name: "Other", offset: 0, count: 1 }])).toEqual([
      { name: "Other", items, pendingCount: 0 },
    ])
    expect(buildShopCategorySections(items, [])).toEqual([
      { name: "Other", items, pendingCount: 0 },
    ])
  })
})

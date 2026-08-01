import { VARIANT_AXES_CATALOG, getSuggestedVariantAxes, getVariantWidgetForKind } from "@/app/catalog/variant-axes"
import { CatalogItem } from "@/app/types"

describe("variant-axes catalog", () => {
  it("maps size to chips and color to swatches", () => {
    expect(getVariantWidgetForKind("size")).toBe("chips")
    expect(getVariantWidgetForKind("color")).toBe("swatches")
    expect(VARIANT_AXES_CATALOG.size.defaultValues?.length).toBeGreaterThan(0)
  })

  it("suggests product-oriented axes for products", () => {
    const item = { kind: "product" } as CatalogItem
    const suggested = getSuggestedVariantAxes(item)
    expect(suggested).toContain("size")
    expect(suggested).toContain("color")
  })

  it("suggests duration/capacity for services", () => {
    const item = { kind: "service" } as CatalogItem
    const suggested = getSuggestedVariantAxes(item)
    expect(suggested).toContain("duration")
    expect(suggested).toContain("capacity")
  })
})

describe("variant option resolve", () => {
  it("resolves child by option_values combination", () => {
    const selected = { size: "m", color: "red" }
    const children = [
      { id: "a", metadata: { option_values: { size: "s", color: "red" } } },
      { id: "b", metadata: { option_values: { size: "m", color: "red" } } },
      { id: "c", metadata: { option_values: { size: "m", color: "blue" } } },
    ]

    const resolved = children.find((c) =>
      Object.entries(selected).every(
        ([aId, vId]) => c.metadata?.option_values?.[aId] === vId
      )
    )

    expect(resolved?.id).toBe("b")
  })
})

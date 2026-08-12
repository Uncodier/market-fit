import {
  resolveVariantAxesForDisplay,
  FALLBACK_VARIANT_AXIS_ID,
  shortVariantLabel,
} from "@/app/catalog/variant-resolve"
import { CatalogItem } from "@/app/types"
import { requiresVariantSelection } from "@/app/catalog/product-details"

describe("resolveVariantAxesForDisplay", () => {
  it("keeps formal axes when children have option_values", () => {
    const item = {
      id: "p1",
      name: "Latte",
      metadata: {
        variant_axes: [
          {
            id: "style",
            kind: "style",
            values: [
              { id: "hot", label: "Hot" },
              { id: "iced", label: "Iced" },
            ],
          },
        ],
      },
    } as CatalogItem

    const children = [
      { id: "c1", name: "Latte / Hot", metadata: { option_values: { style: "hot" } } },
      { id: "c2", name: "Latte / Iced", metadata: { option_values: { style: "iced" } } },
    ] as CatalogItem[]

    const resolved = resolveVariantAxesForDisplay(item, children)
    expect(resolved.axes[0].id).toBe("style")
    expect(resolved.children[0].metadata?.option_values?.style).toBe("hot")
  })

  it("synthesizes a single Option axis from legacy parent_id children", () => {
    const item = {
      id: "p1",
      name: "Latte",
      metadata: {},
      is_purchasable: true,
    } as CatalogItem

    const children = [
      { id: "c1", name: "Frappe", metadata: {} },
      { id: "c2", name: "Helado", metadata: {} },
      { id: "c3", name: "Caliente", metadata: {} },
    ] as CatalogItem[]

    const resolved = resolveVariantAxesForDisplay(item, children)
    expect(resolved.axes).toHaveLength(1)
    expect(resolved.axes[0].id).toBe(FALLBACK_VARIANT_AXIS_ID)
    expect(resolved.axes[0].values.map((v) => v.label)).toEqual([
      "Frappe",
      "Helado",
      "Caliente",
    ])
    expect(resolved.children[1].metadata?.option_values).toEqual({
      [FALLBACK_VARIANT_AXIS_ID]: "c2",
    })
  })
})

describe("requiresVariantSelection", () => {
  it("detects listing flag from child SKUs", () => {
    expect(
      requiresVariantSelection({
        id: "p1",
        is_purchasable: true,
        metadata: {},
        _shop: { hasVariants: true },
      } as any)
    ).toBe(true)
  })
})

describe("shortVariantLabel", () => {
  it("strips parent prefix from generated SKU names", () => {
    expect(shortVariantLabel("Latte", "Latte / Hot")).toBe("Hot")
    expect(shortVariantLabel("Latte", "Frappe")).toBe("Frappe")
  })
})

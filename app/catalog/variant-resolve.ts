import type { CatalogItem, VariantAxis } from "@/app/types"

export const FALLBACK_VARIANT_AXIS_ID = "variant"

export type VariantListingPreview = {
  hasVariants: boolean
  /** Short labels for listing chips (max few). */
  labels: string[]
}

/**
 * Build axes + normalized children for PDP/POS when parents have child SKUs
 * but metadata.variant_axes / option_values were never written (legacy parent_id links).
 */
export function resolveVariantAxesForDisplay(
  item: CatalogItem,
  children: CatalogItem[]
): { axes: VariantAxis[]; children: CatalogItem[] } {
  if (!children.length) {
    return {
      axes: item.metadata?.variant_axes || [],
      children,
    }
  }

  const existingAxes = item.metadata?.variant_axes || []
  const allHaveOptionValues = children.every((child) => {
    const opts = child.metadata?.option_values
    return !!opts && typeof opts === "object" && Object.keys(opts).length > 0
  })

  if (existingAxes.length > 0 && allHaveOptionValues) {
    return { axes: existingAxes, children }
  }

  const axes: VariantAxis[] = [
    {
      id: FALLBACK_VARIANT_AXIS_ID,
      kind: "custom",
      values: children.map((child) => {
        const lbl = shortVariantLabel(item.name || "", child.name || "");
        return {
          id: child.id,
          label: lbl || child.name || "Option",
        };
      }),
    },
  ]

  const normalizedChildren = children.map((child) => ({
    ...child,
    metadata: {
      ...(child.metadata || {}),
      option_values:
        allHaveOptionValues && child.metadata?.option_values
          ? child.metadata.option_values
          : { [FALLBACK_VARIANT_AXIS_ID]: child.id },
    },
  }))

  return { axes, children: normalizedChildren }
}

export function shortVariantLabel(parentName: string, childName: string): string {
  const prefix = `${parentName} / `
  if (childName.startsWith(prefix)) return childName.slice(prefix.length)
  return childName
}

/** Parent ids that have at least one active purchasable child SKU. */
export async function loadParentIdsWithVariantChildren(
  supabase: { from: (table: string) => any },
  parentIds: string[]
): Promise<Set<string>> {
  const previews = await loadVariantListingPreviews(
    supabase,
    parentIds.map((id) => ({ id, name: "" }))
  )
  return new Set(
    Array.from(previews.entries())
      .filter(([, preview]) => preview.hasVariants)
      .map(([id]) => id)
  )
}

/** Labels + hasVariants for storefront listing cards. */
export async function loadVariantListingPreviews(
  supabase: { from: (table: string) => any },
  parents: { id: string; name?: string | null }[]
): Promise<Map<string, VariantListingPreview>> {
  const result = new Map<string, VariantListingPreview>()
  const unique = Array.from(
    new Map(
      parents
        .filter((p) => p.id)
        .map((p) => [p.id, p] as const)
    ).values()
  )
  if (unique.length === 0) return result

  const nameById = new Map(unique.map((p) => [p.id, p.name || ""]))

  const { data } = await supabase
    .from("catalog_items")
    .select("id, parent_id, name")
    .in(
      "parent_id",
      unique.map((p) => p.id)
    )
    .eq("status", "active")
    .eq("is_purchasable", true)
    .order("name", { ascending: true })

  for (const row of data || []) {
    if (!row.parent_id) continue
    const parentName = nameById.get(row.parent_id) || ""
    const label = shortVariantLabel(parentName, row.name)
    const existing = result.get(row.parent_id) || { hasVariants: true, labels: [] }
    if (existing.labels.length < 4) {
      existing.labels.push(label)
    }
    existing.hasVariants = true
    result.set(row.parent_id, existing)
  }

  return result
}

export type TenderFacet = { value: string; label: string }
export type TenderFacets = { regions: TenderFacet[]; categories: TenderFacet[] }
export type TenderFacetOption = TenderFacet & { count: number }

/** Count each publication once, even when several requirements share a category. */
export function tenderFacetOptions(rows: { facets?: TenderFacets }[], key: keyof TenderFacets): TenderFacetOption[] {
  const options = new Map<string, TenderFacetOption>()
  for (const row of rows) {
    for (const facet of new Map((row.facets?.[key] ?? []).map(item => [item.value, item])).values()) {
      options.set(facet.value, { ...facet, count: (options.get(facet.value)?.count ?? 0) + 1 })
    }
  }
  return [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function matchesTenderFacets(row: { facets?: TenderFacets }, region: string, category: string) {
  return (!region || !!row.facets?.regions.some(item => item.value === region)) &&
    (!category || !!row.facets?.categories.some(item => item.value === category))
}
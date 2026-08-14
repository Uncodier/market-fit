export type RelationSelectFilterOption = {
  id: string
  label: string
  searchText?: string
}

/** Filter only after the user types a query distinct from the committed label. */
export function shouldFilterRelationSelectOptions(
  searchQuery: string,
  selectedLabel?: string,
): boolean {
  if (!searchQuery.trim()) return false
  if (selectedLabel && searchQuery === selectedLabel) return false
  return true
}

export function filterRelationSelectOptions<T extends RelationSelectFilterOption>(
  options: T[],
  searchQuery: string,
  selectedLabel?: string,
): T[] {
  if (!shouldFilterRelationSelectOptions(searchQuery, selectedLabel)) {
    return options
  }
  const lowerCaseQuery = searchQuery.toLowerCase()
  return options.filter((option) => {
    const haystack = [option.label, option.searchText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(lowerCaseQuery)
  })
}

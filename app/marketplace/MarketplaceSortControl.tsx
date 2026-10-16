"use client"

import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import type { MarketplaceSort } from "./marketplace-sort"

const SORT_OPTIONS: Array<{ value: MarketplaceSort; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "best_selling", label: "Best selling" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
]

export function MarketplaceSortControl({ selectedSort, setSelectedSort }: {
  selectedSort: MarketplaceSort
  setSelectedSort: (sort: MarketplaceSort) => void
}) {
  return <SortDropdown sortBy={selectedSort} setSortBy={setSelectedSort}
    options={SORT_OPTIONS} className="!w-auto !rounded-full" />
}
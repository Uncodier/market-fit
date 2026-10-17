"use client"

import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { MarketplaceSort } from "./marketplace-sort"

const SORT_OPTIONS: Array<{ value: MarketplaceSort; key: string }> = [
  { value: "featured", key: "marketplace.sort.featured" },
  { value: "best_selling", key: "marketplace.sort.best_selling" },
  { value: "newest", key: "marketplace.sort.newest" },
  { value: "price_asc", key: "marketplace.sort.price_asc" },
  { value: "price_desc", key: "marketplace.sort.price_desc" },
]

export function MarketplaceSortControl({ selectedSort, setSelectedSort }: {
  selectedSort: MarketplaceSort
  setSelectedSort: (sort: MarketplaceSort) => void
}) {
  const { t } = useLocalization()
  return <SortDropdown sortBy={selectedSort} setSortBy={setSelectedSort}
    options={SORT_OPTIONS.map(({ value, key }) => ({ value, label: t(key) }))}
    title={t("marketplace.sort.by")} className="!w-auto !rounded-full" />
}
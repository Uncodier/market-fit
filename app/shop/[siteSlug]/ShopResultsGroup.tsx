"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import type { CatalogResultKind } from "@/lib/catalog-search/types"

type Props = {
  isSearching: boolean
  resultKind: CatalogResultKind
  count: number
  isLoading: boolean
  showCount?: boolean
}

/** Search classification comes from the service, never from an empty local filter. */
export function ShopResultsGroup({ isSearching, resultKind, count, isLoading, showCount = false }: Props) {
  const { t } = useLocalization()
  const title = !isSearching ? t("shop.trendingNow")
    : resultKind === "related" && count > 0 && !isLoading ? t("catalog.search.relatedProducts")
    : t("shop.results")
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 justify-between">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
      {showCount && (isLoading ? (
        <Skeleton className="h-6 w-24" aria-hidden />
      ) : (
        <span className="text-gray-500 font-medium whitespace-nowrap">
          {count} {t(count === 1 ? "shop.product" : "shop.products")}
        </span>
      ))}
    </div>
  )
}
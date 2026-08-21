"use client"

import { CatalogItem } from "@/app/types"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Search, Calendar } from "@/app/components/ui/icons"
import { resolveItemImage } from "@/app/lib/image-utils"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

interface PosCatalogGridProps {
  items: CatalogItem[]
  loading: boolean
  onAdd: (item: CatalogItem) => void
  t: (key: string) => string
}

export function PosCatalogGrid({ items, loading, onAdd, t }: PosCatalogGridProps) {
  const { formatPrice } = useDisplayCurrency()

  return (
    <div className="p-4 bg-muted/30">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 15 }).map((_, i) => (
            <Card key={i} className="relative overflow-hidden flex flex-col h-40">
              <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-10" />
              <div className="relative z-20 p-3 flex-1 flex flex-col justify-end">
                <div className="flex-1" />
                <Skeleton className="h-4 w-3/4 mb-1.5 bg-white/30" />
                <Skeleton className="h-3 w-1/2 mb-3 bg-white/20" />
                <Skeleton className="h-5 w-1/3 bg-white/40" />
              </div>
            </Card>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-full py-8">
            <EmptyCard
              variant="fancy"
              icon={<Search className="w-8 h-8 text-muted-foreground" />}
              title={t("pos.empty.title") || "No items found"}
              description={
                t("pos.empty.desc") ||
                "No products or services found for your current search."
              }
            />
          </div>
        ) : (
          items.map((item) => {
            const isAvailable =
              item.availability_mode !== "manual" ||
              item.availability_status === "available"
            return (
              <Card
                key={item.id}
                className={`relative cursor-pointer transition-shadow hover:shadow-md overflow-hidden flex flex-col h-40 ${!isAvailable ? "opacity-50 grayscale" : ""}`}
                onClick={() => isAvailable && onAdd(item)}
              >
                <img
                  src={resolveItemImage(item, "card")}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />

                {item.is_reservation && (
                  <div className="absolute top-2 right-2 z-20">
                    <Badge 
                      className="bg-black/40 hover:bg-black/40 text-white border-white/20 backdrop-blur-md p-1.5 pointer-events-none"
                      title={t("pos.reservable") || "Reservable"}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </Badge>
                  </div>
                )}

                <div className="relative z-20 p-3 flex-1 flex flex-col justify-end">
                  <div className="flex-1" />
                  <h3 className="font-medium text-sm text-white line-clamp-2 leading-snug">
                    {item.name}
                  </h3>
                  
                  {!!(item as any)._shop?.variantLabels?.length && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {(item as any)._shop.variantLabels.slice(0, 3).map((label: string) => (
                        <span
                          key={label}
                          className="inline-flex max-w-[7.5rem] truncate rounded-md bg-white/20 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white/90"
                        >
                          {label}
                        </span>
                      ))}
                      {(item as any)._shop.variantLabels.length > 3 && (
                        <span className="text-[10px] font-semibold text-white/70">
                          +{(item as any)._shop.variantLabels.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {item.sku && !(item as any)._shop?.variantLabels?.length && (
                    <p className="text-xs text-white/80 font-mono mt-0.5">{item.sku}</p>
                  )}
                  
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold text-white">
                      {formatPrice((item as any).cartPrice || item.target_sale_price || 0, item.currency || "USD")}
                    </span>
                    {!isAvailable && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-red-400 border-red-400 bg-black/50"
                      >
                        {t("pos.soldOut") || "Sold Out"}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

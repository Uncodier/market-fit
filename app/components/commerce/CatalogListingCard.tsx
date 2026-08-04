"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { CatalogItem } from "@/app/types"
import { resolveItemImage } from "@/app/lib/image-utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import {
  getListingTypeLabel,
  getListingMetaChips,
  getListingCtaLabel,
  getListingPriceSuffix
} from "@/app/catalog/product-details"

interface CatalogListingCardProps {
  item: CatalogItem & { 
    site?: { id: string; name: string; logo_url?: string | null };
    _shop?: { availableQty?: number; sellable?: boolean; categoryName?: string };
  }
  href: string
  onPrimaryAction: (item: any) => void
  showSeller?: boolean
  primaryDisabled?: boolean
  disabledLabel?: string
  descriptionLineClamp?: "line-clamp-1" | "line-clamp-2" | "none"
  isOwned?: boolean
  canBook?: boolean
}

export function CatalogListingCard({
  item,
  href,
  onPrimaryAction,
  showSeller = false,
  primaryDisabled = false,
  disabledLabel = "Sold Out",
  descriptionLineClamp = "line-clamp-2",
  isOwned = false,
  canBook = false
}: CatalogListingCardProps) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  const typeLabelKey = getListingTypeLabel(item)
  const metaChips = getListingMetaChips(item)
  const ctaLabelKey = getListingCtaLabel(item, { isOwned, canBook })
  const priceSuffixKey = getListingPriceSuffix(item)

  const isSoldOut = !item._shop?.sellable && item._shop?.availableQty === 0

  return (
    <div className="group bg-card rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col relative">
      <Link href={href} className="flex flex-col flex-1 cursor-pointer">
        {/* Media */}
        <div className="aspect-[4/3] bg-muted relative overflow-hidden shrink-0">
          <img 
            src={resolveItemImage(item)} 
            alt={item.name} 
            onError={(e) => {
              e.currentTarget.style.opacity = '0';
            }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
          <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-md shadow-sm">
            {t(typeLabelKey) || typeLabelKey.split('.').pop()}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          {showSeller && item.site && (
            <div className="flex items-center gap-2 mb-2 shrink-0">
              {item.site.logo_url ? (
                <img src={item.site.logo_url} className="w-5 h-5 min-w-5 object-contain shrink-0" alt={item.site.name} />
              ) : (
                <div className="w-5 h-5 min-w-5 bg-muted rounded-full shrink-0" />
              )}
              <span className="text-xs text-muted-foreground">{item.site.name}</span>
            </div>
          )}

          {!showSeller && item._shop?.categoryName && (
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 shrink-0">
              {item._shop.categoryName}
            </span>
          )}

          <h3 className="font-bold text-lg mb-1 leading-tight text-foreground">{item.name}</h3>
          
          {item.description && (
            <p className={`text-sm text-muted-foreground ${descriptionLineClamp} mb-3`}>
              {item.description}
            </p>
          )}

          {/* Meta Chips */}
          {metaChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 shrink-0">
              {metaChips.map((chip, idx) => (
                <span key={idx} className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border">
                  {chip.value} {chip.labelKey ? (t(chip.labelKey) || chip.labelKey.split('.').pop()) : ''}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between pt-2">
            <div className="font-black text-xl text-foreground">
              {formatPrice(item.target_sale_price || 0, item.currency || 'USD')}
              {priceSuffixKey && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {t(priceSuffixKey) || '/mo'}
                </span>
              )}
            </div>
            
            {!showSeller && item._shop?.availableQty !== undefined && item._shop.availableQty <= 5 && item._shop.availableQty > 0 && (
              <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-md">
                {t('shop.onlyLeft', { count: item._shop.availableQty }) || `Only ${item._shop.availableQty} left`}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* CTA Row - OUTSIDE the Link so button click doesn't trigger navigation */}
      <div className="px-5 pb-5 shrink-0 flex gap-2">
        {!(isSoldOut || primaryDisabled) ? (
          <Button 
            onClick={(e) => {
              e.preventDefault();
              onPrimaryAction(item);
            }} 
            className="flex-1 h-11 rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]"
          >
            {t(ctaLabelKey) || ctaLabelKey.split('.').pop()}
          </Button>
        ) : (
          <Button 
            disabled
            className="flex-1 h-11 rounded-xl bg-muted text-muted-foreground font-bold shadow-none cursor-not-allowed"
          >
            {disabledLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

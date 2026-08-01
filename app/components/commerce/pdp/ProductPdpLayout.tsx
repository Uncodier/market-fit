"use client"

import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay } from "@/app/catalog/product-details"
import { Button } from "@/app/components/ui/button"
import { ShoppingCart } from "@/app/components/ui/icons"
import { getAttributeFieldsForItem } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { useState, useMemo } from "react"
import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { PdpMetricChips } from "./PdpMetricChips"
import { VariantPicker } from "./VariantPicker"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"

export function ProductPdpLayout({ item, backUrl, experience: _experience }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: any }) {
  const { t } = useLocalization()
  const router = useRouter()
  // Wait, usePdpCart needs the right item id.
  // I will resolve it below.

  const metadata = item.metadata || {}
  const axes = metadata.variant_axes || []
  const hasVariants = axes.length > 0
  const children = item._shop?.children || []
  
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  
  // Resolve selected child
  const resolvedChild = useMemo(() => {
    if (!hasVariants) return item
    
    // Need all axes selected
    if (Object.keys(selectedOptions).length !== axes.length) return null
    
    return children.find((c: CatalogItem) => {
      const childOpts = c.metadata?.option_values
      if (!childOpts) return false
      return Object.entries(selectedOptions).every(([aId, vId]) => childOpts[aId] === vId)
    }) || null
  }, [selectedOptions, hasVariants, axes.length, children, item])

  // Get cart context using the resolved child's ID (so it merges by variant)
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)

  const activeItem = resolvedChild || item
  
  // Display price: if no variant selected, maybe show min price or parent price
  // But for now, activeItem has the target_sale_price.
  // Actually, if resolvedChild is null but hasVariants is true, we should show a range or parent price.
  const displayPrice = activeItem.target_sale_price || item.target_sale_price || 0
  const isSelectionComplete = !hasVariants || !!resolvedChild
  const isSellable = isSelectionComplete && (hasVariants ? activeItem.availability_status !== 'sold_out' && activeItem.status === 'active' : item._shop?.sellable !== false)

  const gallery = [resolveItemImage(activeItem), resolveItemImage(item), ...(Array.isArray(metadata.gallery) ? metadata.gallery : [])].filter(Boolean)
  // unique gallery items
  const uniqueGallery = Array.from(new Set(gallery))
  
  const customSpecsFromDB = (item.item_specs || []).filter(s => !s.category?.is_system);
  const specs = [
    ...customSpecsFromDB.map(s => ({ label: s.category?.name || 'Custom', value: s.name })),
    ...(Array.isArray(metadata.specs) ? metadata.specs.filter(s => s.label || s.value) : [])
  ]
  const attributes = metadata.attributes || {}
  const attrFields = getAttributeFieldsForItem(item).filter(f => attributes[f]?.trim())

  const brand = resolveItemSpecDisplay(item, 'brand')
  const collection = resolveItemSpecDisplay(item, 'collection')
  
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  const handleOptionSelect = (axisId: string, valueId: string) => {
    setSelectedOptions(prev => ({ ...prev, [axisId]: valueId }))
  }

  const handleAdd = () => {
    if (!resolvedChild && hasVariants) return toast.error("Please select all options")
    
    addToCartStorage(activeItem)
    toast.success(`${activeItem.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
    router.push(`${backUrl}?cart=1`)
  }

  const handleBuyNow = () => {
    if (!resolvedChild && hasVariants) return toast.error("Please select all options")
    startBuyNow(activeItem, 1, backUrl)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 pb-32 lg:pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20">
        
        {/* Left Column: Gallery */}
        <div className="space-y-4">
          {gallery.length > 0 ? (
            <div className="aspect-[4/5] bg-muted rounded-[2rem] overflow-hidden border shadow-sm">
              <img src={uniqueGallery[activeImageIdx] || uniqueGallery[0]} alt={item.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
          ) : (
            <div className="aspect-[4/5] bg-muted rounded-[2rem] overflow-hidden border shadow-sm flex items-center justify-center">
              <span className="text-muted-foreground font-medium">No Image</span>
            </div>
          )}
          
          {uniqueGallery.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {uniqueGallery.map((url, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImageIdx(i)}
                  className={`relative aspect-square w-20 sm:w-24 shrink-0 bg-muted rounded-2xl overflow-hidden cursor-pointer shadow-sm snap-start transition-all ${activeImageIdx === i ? 'ring-2 ring-primary ring-offset-2' : 'border hover:border-primary/50'}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Right Column: Details & Actions */}
        <div className="flex flex-col py-0 sm:py-4 lg:py-8">
          <div className="mb-8 sm:mb-10">
            <PdpMetricChips 
              className="mb-4 sm:mb-6"
              chips={[
                item.category_id ? { label: item._shop?.categoryName || "Product" } : null,
                brand ? { imageUrl: brand.image_url, label: brand.name } : null,
                collection ? { imageUrl: collection.image_url, label: collection.name } : null
              ]}
            />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">{item.name}</h1>
            
            <div className="hidden lg:block">
              <PdpPriceBlock price={displayPrice} currency={item.currency || 'USD'} />
              {activeItem._shop?.availableQty !== undefined && activeItem._shop.availableQty <= 5 && activeItem._shop.availableQty > 0 && (
                <span className="inline-block mt-4 text-sm font-bold text-red-600 bg-red-50 px-4 py-1.5 rounded-full ring-1 ring-red-600/20">
                  {t('pdp.onlyUnitsLeft') || 'Only'} {activeItem._shop.availableQty} {t('pdp.unitsLeftInStock') || 'units left in stock'}
                </span>
              )}
            </div>
          </div>

          {hasVariants && (
            <VariantPicker 
              axes={axes}
              selectedOptions={selectedOptions}
              onOptionSelect={handleOptionSelect}
              childrenItems={children}
            />
          )}

          <div className="hidden lg:block p-8 bg-card border border-border/50 rounded-3xl shadow-2xl shadow-black/5 mb-12 relative overflow-hidden">
            <div className="space-y-3">
              <PdpCtaButton 
                onClick={handleBuyNow}
                disabled={!isSellable}
              >
                {!isSellable ? (isSelectionComplete ? t('pdp.soldOut') || 'Sold Out' : t('pdp.selectOptions') || 'Select Options') : (t('pdp.buyNow') || 'Buy Now')}
              </PdpCtaButton>
              <PdpCtaButton 
                variant="outline"
                onClick={handleAdd}
                disabled={!isSellable}
              >
                {t('marketplace.add') || 'Add to Cart'}
              </PdpCtaButton>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              <span>{t('pdp.secureCheckout') || 'Secure Checkout'}</span>
              <span>•</span>
              <span>{t('pdp.fastShipping') || 'Fast Shipping'}</span>
            </div>
          </div>

          {item.description && (
            <div className="mb-10 sm:mb-12">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('marketplace.catalogDetails.about') || 'Product Description'}</h3>
              <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                <p>{item.description}</p>
              </div>
            </div>
          )}

          {attrFields.length > 0 && (
            <div className="mb-10 sm:mb-12 grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-6">
              {attrFields.map(f => {
                const camelCaseKey = f.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                return (
                  <div key={f}>
                    <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1 sm:mb-2">
                      {t(`marketplace.catalogDetails.${camelCaseKey}`) || f.replace('_', ' ')}
                    </div>
                    <div className="font-semibold text-base sm:text-lg">{attributes[f]}</div>
                  </div>
                )
              })}
            </div>
          )}

          {specs.length > 0 && (
            <div className="pt-8 border-t">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('marketplace.catalogDetails.specs') || 'Technical Specifications'}</h3>
              <div className="border rounded-2xl sm:rounded-[1.5rem] overflow-hidden">
                {specs.map((s, i) => (
                  <div key={i} className="flex border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <div className="w-1/3 bg-muted/30 p-4 sm:p-5 font-bold text-muted-foreground text-xs sm:text-sm uppercase tracking-wider">{s.label}</div>
                    <div className="w-2/3 p-4 sm:p-5 font-semibold text-sm sm:text-base text-foreground">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {_experience?.kind === 'subscription' && _experience.subscription && (
            <div className="pt-8 mt-8 border-t">
              <SubscriptionManagePanel subscription={_experience.subscription} />
            </div>
          )}
        </div>
      </div>
      
      <PdpMobileBuyBar price={displayPrice}>
        <div className="flex gap-2 w-full">
          <PdpCtaButton 
            variant="outline"
            onClick={handleAdd}
            disabled={!isSellable}
            className="px-4 shrink-0 w-auto"
          >
            {t('marketplace.add') || 'Add'}
          </PdpCtaButton>
          <PdpCtaButton 
            onClick={handleBuyNow}
            disabled={!isSellable}
            className="flex-1"
          >
            {!isSellable ? (isSelectionComplete ? t('pdp.soldOut') || 'Sold Out' : t('pdp.selectOptions') || 'Select Options') : (t('pdp.buyNow') || 'Buy Now')}
          </PdpCtaButton>
        </div>
      </PdpMobileBuyBar>
    </div>
  )
}
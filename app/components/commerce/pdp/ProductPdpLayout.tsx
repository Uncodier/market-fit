"use client"

import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { buildPdpGalleryEntries, resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay } from "@/app/catalog/product-details"
import { getAttributeFieldsForItem, isAccessOnlyItem } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter, usePathname } from "next/navigation"

import { useState, useMemo, useEffect } from "react"
import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpItemDescription } from "./PdpItemDescription"
import { PdpProductDetails } from "./PdpProductDetails"
import { PdpProductGallery } from "./PdpProductGallery"
import { PdpModifierSkeleton } from "./PdpPageSkeleton"
import { hasPdpProductDetails } from "./pdp-item-description"
import { VariantPicker } from "./VariantPicker"
import {
  ModifierPickerPanel,
  isModifierSelectionValid,
} from "@/app/components/commerce/ModifierPickerPanel"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import {
  modifiersUnitTotal,
  type CartModifier,
} from "@/app/commerce/cart-modifiers"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"
import {
  DynamicQuoteMobileBar,
  DynamicQuotePdpFields,
  DynamicQuotePdpProvider,
  DynamicQuotePdpRail,
} from "./DynamicQuotePdpPanel"
import { isDynamicPricedItem } from "@/app/catalog/dynamic-pricing"
import { getDynamicPricingConfig } from "@/app/catalog/dynamic-pricing"

export function ProductPdpLayout({ item, backUrl, experience: _experience }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: any }) {
  const { t } = useLocalization()
  const router = useRouter()
  const pathname = usePathname()
  // Wait, usePdpCart needs the right item id.
  // I will resolve it below.

  const metadata = item.metadata || {}
  const axes = metadata.variant_axes || []
  const hasVariants = axes.length > 0
  const children = item._shop?.children || []
  
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupWithItems[]>([])
  const [selectedModifiers, setSelectedModifiers] = useState<CartModifier[]>([])
  const [modifiersReady, setModifiersReady] = useState(false)
  
  // Resolve selected child
  const resolvedChild = useMemo(() => {
    if (!hasVariants) return item
    
    // Need all axes selected
    if (Object.keys(selectedOptions).length !== axes.length) return null
    
    const child = children.find((c: CatalogItem) => {
      const childOpts = c.metadata?.option_values
      if (!childOpts) return false
      return Object.entries(selectedOptions).every(([aId, vId]) => childOpts[aId] === vId)
    })
    
    return child ? { ...child, _parent: { name: item.name } } : null
  }, [selectedOptions, hasVariants, axes.length, children, item])

  // Get cart context using the resolved child's ID (so it merges by variant)
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)

  const activeItem = resolvedChild || item

  // Load modifier groups for the host (parent) — children inherit via server action
  useEffect(() => {
    let cancelled = false
    setModifiersReady(false)
    const hostId = item.id
    getModifierGroupsForCatalogItem(hostId)
      .then((res) => {
        if (cancelled) return
        setModifierGroups(res.data || [])
        setSelectedModifiers([])
      })
      .finally(() => {
        if (!cancelled) setModifiersReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [item.id])
  
  // Display price: if no variant selected, maybe show min price or parent price
  // But for now, activeItem has the target_sale_price.
  // Actually, if resolvedChild is null but hasVariants is true, we should show a range or parent price.
  const isDynamic = isDynamicPricedItem(item)
  const dynamicConfig = isDynamic ? getDynamicPricingConfig(item) : null
  const basePrice = isDynamic
    ? (dynamicConfig?.min_price ?? item.lowest_sale_price ?? 0)
    : (activeItem.target_sale_price || item.target_sale_price || 0)
  const displayPrice = basePrice + modifiersUnitTotal(selectedModifiers)
  const isSelectionComplete = !hasVariants || !!resolvedChild
  const isDropIn = activeItem.is_reservation && !isAccessOnlyItem(activeItem) && (!activeItem.pass_uses || activeItem.pass_uses === 1)
  const modifierValidationResult = isModifierSelectionValid(modifierGroups, selectedModifiers)
  const modifiersValid =
    modifiersReady &&
    (modifierGroups.length === 0 || modifierValidationResult.ok)
  const isSellable =
    isSelectionComplete &&
    modifiersValid &&
    (hasVariants
      ? activeItem.availability_status !== "sold_out" && activeItem.status === "active"
      : item._shop?.sellable !== false)
  const disabledCtaLabel = isSellable
    ? null
    : !isSelectionComplete
      ? t("pdp.selectOptions") || "Select Options"
      : !modifiersReady
        ? null
        : !modifiersValid && "error" in modifierValidationResult
          ? modifierValidationResult.error
          : t("pdp.soldOut") || "Sold Out"

  const galleryEntries = useMemo(
    () =>
      buildPdpGalleryEntries({
        parent: item,
        children,
        size: "full",
      }),
    [item, children]
  )
  const imageContext = {
    parentName: item.name,
    parentDescription: item.description,
    category:
      item._shop?.categoryName ||
      (typeof item.category === "object" && item.category?.name) ||
      (typeof item.category === "string" ? item.category : null) ||
      null,
    siteDescription:
      item._shop?.siteDescription || item.site?.description || null,
    siteName: item.site?.name || null,
  }
  const displayImageUrl =
    galleryEntries[0]?.url ||
    resolveItemImage(
      resolvedChild
        ? {
            ...activeItem,
            parent: {
              name: item.name,
              description: item.description,
            },
            category: imageContext.category,
            siteDescription: imageContext.siteDescription,
          }
        : item,
      "full",
    )
  
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

  const selectChildInGallery = (child: CatalogItem) => {
    const opts = child.metadata?.option_values
    if (!opts || typeof opts !== "object") return
    setSelectedOptions({ ...opts })
    const idx = galleryEntries.findIndex((e) => e.catalogItemId === child.id)
    if (idx >= 0) setActiveImageIdx(idx)
  }

  const handleOptionSelect = (axisId: string, valueId: string) => {
    const next = { ...selectedOptions, [axisId]: valueId }
    setSelectedOptions(next)

    if (Object.keys(next).length !== axes.length) return
    const child = children.find((c: CatalogItem) => {
      const childOpts = c.metadata?.option_values
      if (!childOpts) return false
      return Object.entries(next).every(([aId, vId]) => childOpts[aId] === vId)
    })
    if (!child) return
    const idx = galleryEntries.findIndex((e) => e.catalogItemId === child.id)
    if (idx >= 0) setActiveImageIdx(idx)
  }

  const handleGalleryThumbClick = (index: number) => {
    setActiveImageIdx(index)
    const entry = galleryEntries[index]
    if (!entry?.catalogItemId) return
    const child = children.find((c: CatalogItem) => c.id === entry.catalogItemId)
    if (child) selectChildInGallery(child)
  }

  const handleAdd = () => {
    if (!resolvedChild && hasVariants) {
      return toast.error(t("pdp.selectOptions") || "Please select all options")
    }
    const modCheck = isModifierSelectionValid(modifierGroups, selectedModifiers)
    if (!modCheck.ok) {
      return toast.error(modCheck.error)
    }

    addToCartStorage(activeItem, 1, undefined, undefined, selectedModifiers)
    toast.success(`${activeItem.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
    router.push(`${backUrl}?cart=1`)
  }

  const handleBuyNow = () => {
    if (!resolvedChild && hasVariants) {
      return toast.error(t("pdp.selectOptions") || "Please select all options")
    }
    const modCheck = isModifierSelectionValid(modifierGroups, selectedModifiers)
    if (!modCheck.ok) {
      return toast.error(modCheck.error)
    }
    startBuyNow(activeItem, 1, backUrl, undefined, undefined, selectedModifiers)
  }

  const handleBook = () => {
    if (!resolvedChild && hasVariants) {
      return toast.error(t("pdp.selectOptions") || "Please select all options")
    }
    const modCheck = isModifierSelectionValid(modifierGroups, selectedModifiers)
    if (!modCheck.ok) {
      return toast.error(modCheck.error)
    }
    const bookItemId = resolvedChild?.id || item.id
    const bookPath = pathname.replace(/\/[^/]+\/?$/, `/${bookItemId}`)
    
    if (selectedModifiers.length > 0) {
      const modifiersParam = encodeURIComponent(JSON.stringify(selectedModifiers))
      router.push(`${bookPath}/book?modifiers=${modifiersParam}`)
    } else {
      router.push(`${bookPath}/book`)
    }
  }

  const safeImageIdx =
    galleryEntries.length > 0 ? Math.min(activeImageIdx, galleryEntries.length - 1) : 0
  const mainGallerySrc = galleryEntries[safeImageIdx]?.url || displayImageUrl

  const detailsBelow = (
    <PdpProductDetails
      description={item.description}
      attrFields={attrFields}
      attributes={attributes}
      specs={specs}
    />
  )
  const showDetailsBelow = hasPdpProductDetails({
    description: item.description,
    attrCount: attrFields.length,
    specCount: specs.length,
  })

  if (isDynamic) {
    return (
      <DynamicQuotePdpProvider item={item} backUrl={backUrl}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-4 lg:mb-5">
            <PdpMetricChips
              className="mb-2 sm:mb-3"
              chips={[
                item.category_id ? { label: item._shop?.categoryName || "Product" } : null,
                brand ? { imageUrl: brand.image_url, label: brand.name } : null,
                collection ? { imageUrl: collection.image_url, label: collection.name } : null,
              ]}
            />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
              {item.name}
            </h1>
            <PdpItemDescription
              description={item.description}
              variant="inline"
              className="mt-2 text-sm max-w-2xl"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-7 xl:col-span-8 order-1 space-y-8">
              <div className="max-w-md">
                <div className="relative h-36 sm:h-44 bg-muted rounded-2xl overflow-hidden border shadow-sm">
                  {mainGallerySrc ? (
                    <img
                      src={mainGallerySrc}
                      alt={item.name}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
              </div>
              <DynamicQuotePdpFields />
              {showDetailsBelow && <div className="pt-4 border-t">{detailsBelow}</div>}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 order-2">
              <div className="lg:sticky lg:top-28 bg-card border border-border/50 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/5">
                <DynamicQuotePdpRail />
              </div>
            </div>
          </div>

          {_experience?.kind === "subscription" && _experience.subscription && (
            <div className="pt-8 mt-8 border-t">
              <SubscriptionManagePanel subscription={_experience.subscription} />
            </div>
          )}
        </div>
        <DynamicQuoteMobileBar />
      </DynamicQuotePdpProvider>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
      {/* Sticky gallery only while the options column scrolls; details sit below. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20">
        <div>
          <div className="lg:sticky lg:top-28">
            <PdpProductGallery
              itemName={item.name}
              mainSrc={mainGallerySrc}
              entries={galleryEntries}
              selectedIndex={safeImageIdx}
              onThumbClick={handleGalleryThumbClick}
            />
          </div>
        </div>

        <div className="flex flex-col py-0 sm:py-4 lg:py-8">
          <div className="mb-8 sm:mb-10">
            <PdpMetricChips
              className="mb-4 sm:mb-6"
              chips={[
                item.category_id ? { label: item._shop?.categoryName || "Product" } : null,
                brand ? { imageUrl: brand.image_url, label: brand.name } : null,
                collection ? { imageUrl: collection.image_url, label: collection.name } : null,
              ]}
            />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">
              {item.name}
            </h1>

            <div>
              <PdpPriceBlock price={displayPrice} currency={item.currency || "USD"} />
              {activeItem._shop?.availableQty !== undefined &&
                activeItem._shop.availableQty <= 5 &&
                activeItem._shop.availableQty > 0 && (
                  <span className="inline-block mt-4 text-sm font-bold text-red-600 bg-red-50 px-4 py-1.5 rounded-full ring-1 ring-red-600/20">
                    {t("pdp.onlyUnitsLeft") || "Only"} {activeItem._shop.availableQty}{" "}
                    {t("pdp.unitsLeftInStock") || "units left in stock"}
                  </span>
                )}
            </div>

            <PdpItemDescription
              description={item.description}
              variant="inline"
              className="mt-4 sm:mt-6"
            />
          </div>

          {hasVariants && (
            <VariantPicker
              axes={axes}
              selectedOptions={selectedOptions}
              onOptionSelect={handleOptionSelect}
              childrenItems={children}
              presentation="pdp"
              currency={item.currency || "USD"}
              fallbackImageUrl={item.image_url || galleryEntries[0]?.url || null}
              imageContext={imageContext}
            />
          )}

          {!modifiersReady ? (
            <PdpModifierSkeleton />
          ) : modifierGroups.length > 0 ? (
            <div className="mb-8 sm:mb-10">
              <h3 className="text-lg font-bold mb-4">
                {t("pos.modifiers.title") || "Add extras"}
              </h3>
              <ModifierPickerPanel
                groups={modifierGroups}
                value={selectedModifiers}
                onChange={setSelectedModifiers}
                imageContext={imageContext}
                currency={item.currency || "USD"}
              />
            </div>
          ) : null}

          <div className="hidden lg:block p-8 bg-card border border-border/50 rounded-3xl shadow-2xl shadow-black/5 relative overflow-hidden">
            <div className="space-y-3">
              {isDropIn ? (
                <PdpCtaButton onClick={handleBook} disabled={!isSellable}>
                  {disabledCtaLabel || t("booking.selectTime") || "Select a Time"}
                </PdpCtaButton>
              ) : (
                <>
                  <PdpCtaButton onClick={handleBuyNow} disabled={!isSellable}>
                    {disabledCtaLabel || t("pdp.buyNow") || "Buy Now"}
                  </PdpCtaButton>
                  <PdpCtaButton variant="outline" onClick={handleAdd} disabled={!isSellable}>
                    {t("marketplace.add") || "Add to Cart"}
                  </PdpCtaButton>
                </>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              <span>{t("pdp.secureCheckout") || "Secure Checkout"}</span>
              <span>•</span>
              <span>{t("pdp.fastShipping") || "Fast Shipping"}</span>
            </div>
          </div>
        </div>
      </div>

      {(showDetailsBelow || (_experience?.kind === "subscription" && _experience.subscription)) && (
        <div className="mt-12 sm:mt-16 lg:mt-20 max-w-3xl">
          {showDetailsBelow && detailsBelow}

          {_experience?.kind === "subscription" && _experience.subscription && (
            <div className="pt-8 mt-8 border-t">
              <SubscriptionManagePanel subscription={_experience.subscription} />
            </div>
          )}
        </div>
      )}

      <PdpMobileBuyBar price={displayPrice} fullWidthCta={true}>
        <div className="flex gap-2 w-full">
          {!isDropIn && (
            <PdpCtaButton
              variant="outline"
              onClick={handleAdd}
              disabled={!isSellable}
              className="px-4 shrink-0 w-auto"
            >
              {t("marketplace.add") || "Add"}
            </PdpCtaButton>
          )}
          {isDropIn ? (
            <PdpCtaButton onClick={handleBook} disabled={!isSellable} className="flex-1">
              {disabledCtaLabel || t("booking.selectTime") || "Select a Time"}
            </PdpCtaButton>
          ) : (
            <PdpCtaButton onClick={handleBuyNow} disabled={!isSellable} className="flex-1">
              {disabledCtaLabel || t("pdp.buyNow") || "Buy Now"}
            </PdpCtaButton>
          )}
        </div>
      </PdpMobileBuyBar>
    </div>
  )
}
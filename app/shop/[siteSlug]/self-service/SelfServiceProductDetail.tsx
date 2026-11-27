"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { QuantityStepper } from "@/app/components/commerce/QuantityStepper"
import { PdpCtaButton } from "@/app/components/commerce/pdp/PdpCtaButton"
import { PdpMobileBuyBar } from "@/app/components/commerce/pdp/PdpMobileBuyBar"
import { PdpItemDescription } from "@/app/components/commerce/pdp/PdpItemDescription"
import { PdpModifierSkeleton } from "@/app/components/commerce/pdp/PdpPageSkeleton"
import { PdpProductFrame } from "@/app/components/commerce/pdp/PdpProductFrame"
import { PdpProductGallery } from "@/app/components/commerce/pdp/PdpProductGallery"
import { PdpProductSummary } from "@/app/components/commerce/pdp/PdpProductSummary"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import { ModifierPickerPanel, isModifierSelectionValid } from "@/app/components/commerce/ModifierPickerPanel"
import { modifiersUnitTotal } from "@/app/commerce/cart-modifiers"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { buildPdpGalleryEntries, resolveItemImage } from "@/app/lib/image-utils"
import { usePromptImageDelivery } from "@/app/components/commerce/PublicImageDelivery"
import type { CatalogItem } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { SelfServiceHeader } from "./SelfServiceHeader"
import { useSelfService } from "./SelfServiceProvider"
import { useSelfServiceModifiers } from "./useSelfServiceModifiers"
import { ShopSiteFooter } from "../ShopSiteFooter"

const modifierErrorKeys: Record<string, string> = {
  "Invalid product option request.": "shop.selfService.product.invalidRequest",
  "This order type is unavailable at this location.": "shop.selfService.product.orderTypeUnavailable",
  "This product is unavailable at this location.": "shop.selfService.product.locationUnavailable",
  "This product is unavailable for your selected order type.": "shop.selfService.product.unavailable",
  "Unable to load product options. Please reload this page before ordering.": "shop.selfService.product.loadFailed",
}

// Translate only canonical loader messages; option group names remain user content.
function translateModifierMessage(message: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const key = modifierErrorKeys[message]
  if (key) return t(key)
  const shortage = /^This item is unavailable: not enough options in ([\s\S]*) for this location and order type\. Please choose another item or ask staff for help\.$/.exec(message)
  return shortage ? t("shop.selfService.product.insufficientOptions", { name: shortage[1] }) : message
}

export function SelfServiceProductDetail({ item, modifierGroups, modifierError, modifierFulfillment, modifierUnavailableReason }: {
  item: CatalogItem; modifierGroups: ModifierGroupWithItems[]; modifierError?: string
  modifierFulfillment?: string; modifierUnavailableReason?: string
}) {
  const { context, addItem, fulfillment } = useSelfService()
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const delivery = usePromptImageDelivery()
  const router = useRouter()
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const axes = item.metadata?.variant_axes || []
  const children = useMemo<CatalogItem[]>(() => (item._shop?.children || []).map((child) => ({
    ...child,
    metadata: { ...item.metadata, ...child.metadata },
  })), [item])
  const resolved = useMemo(() => {
    if (!axes.length) return item
    if (Object.keys(selectedOptions).length !== axes.length) return null
    return children.find((child) => Object.entries(selectedOptions).every(([axis, value]) => child.metadata?.option_values?.[axis] === value)) || null
  }, [axes.length, children, item, selectedOptions])
  const modifierState = useSelfServiceModifiers({ locationId: context.location.id, hostId: item.id, selectedId: resolved?.id, fulfillment },
    { data: modifierGroups, error: modifierError, unavailableReason: modifierUnavailableReason }, modifierFulfillment || context.fulfillmentOptions[0])
  const { modifiers, setModifiers } = modifierState
  const available = (candidate: CatalogItem) => candidate.status === "active" && candidate.availability_status !== "sold_out" &&
    candidate._shop?.sellable !== false && isSelfServiceItem(candidate, context.fulfillmentOptions, context.location.id) && isItemCompatibleWithFulfillment(candidate, fulfillment) &&
    isSelfServiceItem(item, context.fulfillmentOptions, context.location.id) && isItemCompatibleWithFulfillment(item, fulfillment)
  const valid = isModifierSelectionValid(modifierState.groups, modifiers)
  const canAdd = !!resolved && resolved.is_purchasable !== false && available(resolved) && valid.ok && modifierState.ready && !modifierState.error && !modifierState.unavailableReason
  const active = resolved || item
  const currency = active.currency || context.site.settings?.currency || "USD"
  const unit = Number(active.target_sale_price || 0) + modifiersUnitTotal(modifiers)
  const home = `/shop/${context.location.id}`
  const gallery = useMemo(() => buildPdpGalleryEntries({ parent: item, children, size: "full", delivery }), [item, children, delivery])
  const variantImageIndex = resolved && resolved.id !== item.id ? gallery.findIndex((entry) => entry.catalogItemId === resolved.id) : -1
  const selectedIndex = previewIndex ?? Math.max(0, variantImageIndex)

  return <div className="flex min-h-screen flex-col bg-background text-foreground">
    <SelfServiceHeader backHref={home} />
    <main className="flex-1 pb-24 lg:pb-0">
      <PdpProductFrame gallery={<PdpProductGallery itemName={item.name} entries={gallery} selectedIndex={selectedIndex}
        mainSrc={gallery[selectedIndex]?.url || resolveItemImage(active, "full", delivery)} onThumbClick={setPreviewIndex} />}
        below={<PdpItemDescription description={item.description} variant="section" className="mt-12 max-w-3xl" />}>
        <PdpProductSummary name={item.name} description={item.description} price={unit} currency={currency}
          chips={[item._shop?.categoryName ? { label: item._shop.categoryName } : null]} />
        {axes.length > 0 && <VariantPicker axes={axes} selectedOptions={selectedOptions} onOptionSelect={(axis, value) => {
          setPreviewIndex(null)
          setSelectedOptions((previous) => ({ ...previous, [axis]: value }))
        }} childrenItems={children} isItemAvailable={available} currency={currency} presentation="pdp"
          fallbackImageUrl={gallery[0]?.url} />}
        {!modifierState.ready ? <div role="status" aria-label={t("shop.selfService.product.loading")}><PdpModifierSkeleton /></div>
          : modifierState.error ? <p role="alert">{translateModifierMessage(modifierState.error, t)}</p>
          : modifierState.unavailableReason ? <p role="alert">{translateModifierMessage(modifierState.unavailableReason, t)}</p>
          : modifierState.groups.length > 0 && <div className="mb-8 sm:mb-10">
            <h2 className="mb-4 text-lg font-bold">{t("pos.modifiers.title")}</h2>
            <ModifierPickerPanel key={modifierState.key} groups={modifierState.groups} value={modifiers} onChange={setModifiers} currency={currency} />
          </div>}
        {!resolved && <p className="text-sm text-muted-foreground">{t("shop.selfService.product.chooseOptions")}</p>}
        {resolved && !available(resolved) && <p role="alert">{t("shop.selfService.product.unavailable")}</p>}
        <PdpMobileBuyBar fullWidthCta className="lg:static lg:mt-4 lg:block lg:rounded-3xl lg:border lg:bg-card lg:p-8">
          <div className="flex items-center gap-3">
            <QuantityStepper compact label={t("shop.selfService.product.quantity")} quantity={quantity}
              min={1} canIncrease={quantity < 1000} onChange={setQuantity} />
            <PdpCtaButton className="min-w-0 flex-1 whitespace-normal" disabled={!canAdd} onClick={() => {
              if (!resolved || !canAdd) return
              addItem(resolved, quantity, modifiers)
              router.push(`${home}?cart=1`)
            }}>{t("shop.selfService.product.add", { price: formatPrice(unit * quantity, currency) })}</PdpCtaButton>
          </div>
        </PdpMobileBuyBar>
      </PdpProductFrame>
    </main>
    <div className="pb-24 lg:pb-0"><ShopSiteFooter siteName={context.site.name} /></div>
  </div>
}
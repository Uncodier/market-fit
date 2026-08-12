"use client"

import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { CheckCircle, Download } from "@/app/components/ui/icons"
import { PdpExperience } from "./pdp-experience"

export function DigitalPdpLayout({ item, backUrl, experience }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: PdpExperience }) {
  const { t } = useLocalization()
  const router = useRouter()
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)
  
  const [ownedEntitlement, setOwnedEntitlement] = useState<any>(null)
  const [loadingOwned, setLoadingOwned] = useState(true)

  useEffect(() => {
    async function checkOwnership() {
      // Import dynamically to avoid top-level import
      const { getActiveDigitalEntitlementForCatalogItem } = await import("@/app/buyer/entitlement-queries")
      try {
        const ent = await getActiveDigitalEntitlementForCatalogItem(item.id)
        if (ent) {
          setOwnedEntitlement(ent)
        }
      } catch (e) {
        // Not logged in or no entitlement
      }
      setLoadingOwned(false)
    }
    checkOwnership()
  }, [item.id])

  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  const author = resolveItemSpecDisplay(item, 'author')
  const publisher = resolveItemSpecDisplay(item, 'publisher')

  const handleAdd = () => {
    addToCartStorage(item)
    toast.success(`${item.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
    router.push(`${backUrl}?cart=1`)
  }

  const handleBuyNow = () => {
    startBuyNow(item, 1, backUrl)
  }

  if (experience?.kind === 'entitlement' && experience.entitlement) {
    return (
      <div className="pb-16 max-w-7xl mx-auto w-full px-4 md:px-8 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-2">
            {item.name}
          </h1>
          <div className="text-muted-foreground font-medium">
            {t('buyer.library.actions.file') || 'Digital Asset'}
          </div>
        </div>

        <div className="mb-10 sm:mb-12">
          <h3 className="text-xl sm:text-2xl font-bold mb-4">{t('buyer.library.actions.file') || 'Downloads'}</h3>
          {experience.extras?.files && experience.extras.files.length > 0 ? (
            <div className="flex flex-col gap-3">
              {experience.extras.files.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border shadow-sm">
                  <div className="flex items-center gap-4 truncate">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div className="font-semibold truncate">{file.file_name}</div>
                  </div>
                  <a href={file.downloadUrl} download target="_blank" rel="noopener noreferrer" className="ml-4 shrink-0">
                    <PdpCtaButton className="px-6 h-10 w-auto">{t('pdp.download') || 'Download'}</PdpCtaButton>
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-muted/50 rounded-2xl text-center text-muted-foreground border">
              {t('pdp.noFiles') || 'No files available for download.'}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 md:py-16 pb-32 lg:pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        <div className="order-2 lg:order-1">
          <PdpMetricChips 
            className="mb-4 sm:mb-6"
            chips={[
              { label: item.digital_subtype || 'Digital Asset' },
              author ? { imageUrl: author.image_url, label: author.name } : null,
              publisher ? { imageUrl: publisher.image_url, label: publisher.name } : null
            ]}
          />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">{item.name}</h1>
          <div className="lg:hidden mb-8">
            <PdpPriceBlock price={item.target_sale_price || 0} currency={item.currency || 'USD'} />
          </div>
          <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed mb-8 sm:mb-10">
            <p>{item.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-10 sm:mb-12">
            {attributes.format && (
              <div className="p-4 sm:p-5 bg-card rounded-2xl sm:rounded-[2rem] border shadow-sm flex flex-col justify-center">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 sm:mb-2">Format</div>
                <div className="font-bold text-base sm:text-lg">{attributes.format}</div>
              </div>
            )}
            {attributes.file_size && (
              <div className="p-4 sm:p-5 bg-card rounded-2xl sm:rounded-[2rem] border shadow-sm flex flex-col justify-center">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 sm:mb-2">Size</div>
                <div className="font-bold text-base sm:text-lg">{attributes.file_size}</div>
              </div>
            )}
            {attributes.license_type && (
              <div className="p-4 sm:p-5 bg-card rounded-2xl sm:rounded-[2rem] border shadow-sm flex flex-col justify-center">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 sm:mb-2">License</div>
                <div className="font-bold text-base sm:text-lg line-clamp-1">{attributes.license_type}</div>
              </div>
            )}
            {attributes.seats && (
              <div className="p-4 sm:p-5 bg-card rounded-2xl sm:rounded-[2rem] border shadow-sm flex flex-col justify-center">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 sm:mb-2">Seats</div>
                <div className="font-bold text-base sm:text-lg">{attributes.seats}</div>
              </div>
            )}
          </div>

          {ownedEntitlement ? (
            <div className="mb-10 sm:mb-12 overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent relative p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full shadow-lg shadow-primary/20 ring-4 ring-primary/5 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-1">
                    {t('pdp.youOwnThisFile') || 'You own this item'}
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('pdp.readyToDownloadText') || 'Access your files in your library.'}
                  </p>
                </div>
              </div>
              <PdpCtaButton onClick={() => router.push(`/buyer/downloads/${ownedEntitlement.id}`)} className="w-full sm:w-auto px-8">
                {t('buyer.library.actions.file') || 'Open Downloads'}
              </PdpCtaButton>
            </div>
            ) : (
            <div className="hidden sm:flex items-center gap-6 p-6 bg-card border border-border/50 rounded-3xl shadow-lg relative">
              <PdpPriceBlock price={item.target_sale_price || 0} currency={item.currency || 'USD'} className="pl-2" />
              <div className="hidden sm:flex flex-1 gap-3">
                <PdpCtaButton 
                  variant="outline"
                  onClick={handleAdd}
                  disabled={item._shop?.sellable === false || loadingOwned}
                  className="w-auto px-6"
                >
                  {t('marketplace.add') || 'Add to Cart'}
                </PdpCtaButton>
                <PdpCtaButton 
                  onClick={handleBuyNow}
                  disabled={item._shop?.sellable === false || loadingOwned}
                >
                  {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (t('pdp.download') || 'Get Download')}
                </PdpCtaButton>
              </div>
            </div>
          )}
        </div>
        
        <div className="order-1 lg:order-2">
          <div className="aspect-[4/5] bg-muted rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl relative max-sm:rotate-0 rotate-3 hover:rotate-0 transition-transform duration-500 mx-auto max-w-md">
            <img src={resolveItemImage(item, "full")} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[2rem] sm:rounded-[3rem]" />
          </div>
        </div>
      </div>

      {experience?.kind === 'subscription' && experience.subscription && (
        <div className="mt-12 pt-12 border-t">
          <SubscriptionManagePanel subscription={experience.subscription} />
        </div>
      )}

      {!ownedEntitlement && !experience && (
        <PdpMobileBuyBar price={item.target_sale_price || 0} fullWidthCta={true}>
          <div className="flex gap-2 w-full">
            <PdpCtaButton 
              variant="outline"
              onClick={handleAdd}
              disabled={item._shop?.sellable === false || loadingOwned}
              className="px-4 shrink-0 w-auto"
            >
              {t('marketplace.add') || 'Add'}
            </PdpCtaButton>
            <PdpCtaButton 
              onClick={handleBuyNow}
              disabled={item._shop?.sellable === false || loadingOwned}
              className="flex-1"
            >
              {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (t('pdp.download') || 'Get Download')}
            </PdpCtaButton>
          </div>
        </PdpMobileBuyBar>
      )}
    </div>
  )
}
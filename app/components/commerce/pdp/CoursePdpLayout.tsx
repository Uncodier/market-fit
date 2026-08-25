"use client"

import { useState, useEffect } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { CheckCircle } from "@/app/components/ui/icons"
import { PdpExperience } from "./pdp-experience"
import { CourseLessonPlayer } from "./CourseLessonPlayer"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"

export function CoursePdpLayout({ item, backUrl, experience }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: PdpExperience }) {
  const { t } = useLocalization()
  const router = useRouter()
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)
  
  const [ownedEntitlement, setOwnedEntitlement] = useState<any>(null)
  
  useEffect(() => {
    async function checkOwnership() {
      // Import dynamically to avoid top-level import
      const { getActiveDigitalEntitlementForCatalogItem } = await import("@/app/buyer/entitlement-queries")
      try {
        const ent = await getActiveDigitalEntitlementForCatalogItem(item.id)
        if (ent) {
          setOwnedEntitlement(ent)
        }
      } catch (e) {}
    }
    checkOwnership()
  }, [item.id])

  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  const videos = Array.isArray(metadata.videos) ? metadata.videos.filter((v: any) => v && v.url) : []
  
  const instructor = resolveItemSpecDisplay(item, 'instructor')
  const author = resolveItemSpecDisplay(item, 'author')
  const primaryPerson = instructor || author

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
          <div className="text-muted-foreground font-medium flex items-center gap-2">
            {t("buyer.library.actions.course") || "Course"}
            {attributes.level && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{attributes.level}</span>
              </>
            )}
            {attributes.duration && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{attributes.duration}</span>
              </>
            )}
          </div>
        </div>

        {videos.length > 0 ? (
          <CourseLessonPlayer
            title={item.name}
            videos={videos}
            progress={experience.extras?.progress || { lastIndex: 0, completedIndexes: [] }}
            onProgressUpdate={experience.extras?.onProgressUpdate}
          />
        ) : (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-10 flex flex-col md:flex-row items-center gap-6 justify-between text-center md:text-left">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-primary font-bold mb-3 text-lg">
                <CheckCircle className="w-6 h-6" />
                <span>{t('pdp.youAreEnrolled') || "You're enrolled in this course"}</span>
              </div>
              <div className="text-primary/80 max-w-lg mx-auto md:mx-0">
                {t('pdp.noVideosYet') || "This course doesn't have any video lessons available yet. Check back later."}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="text-center mb-10 sm:mb-16 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight mb-6">{item.name}</h1>
        <PdpMetricChips 
          className="justify-center"
          chips={[
            attributes.level ? { label: attributes.level } : null,
            attributes.duration ? { label: attributes.duration } : null
          ]}
        />
      </div>

      <div className="aspect-[16/10] sm:aspect-[21/9] bg-muted rounded-[2rem] overflow-hidden shadow-xl mb-10 sm:mb-16 relative">
        <img src={resolveItemImage(item, "full")} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {!ownedEntitlement ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16 max-w-7xl mx-auto">
          {/* Mobile: buy card first */}
          <div className="lg:col-span-1 lg:order-last">
            <div className="lg:sticky lg:top-32 lg:bg-card lg:border lg:border-border/50 lg:rounded-3xl lg:p-8 lg:shadow-2xl lg:shadow-black/5 flex flex-col gap-6 lg:gap-8 text-center relative">
              
              {primaryPerson && (
                <div className="pb-6 lg:pb-8 border-b">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full mx-auto mb-4 overflow-hidden shadow-sm">
                    {primaryPerson.image_url ? (
                      <img src={primaryPerson.image_url} alt={primaryPerson.name} className="absolute inset-0 h-full w-full object-cover object-center" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center text-xl sm:text-2xl font-black">
                        {primaryPerson.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {primaryPerson.category?.name || t('marketplace.catalogDetails.instructor') || 'Instructor'}
                  </div>
                  <div className="font-black text-lg sm:text-xl">{primaryPerson.name}</div>
                </div>
              )}
              
              <div>
                <PdpPriceBlock price={item.target_sale_price || 0} currency={item.currency || 'USD'} className="mb-2" />
                <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  {t('pdp.premiumAccess') || 'Full lifetime access'}
                </div>
              </div>
              
              <div className="hidden lg:block">
                <PdpCtaButton 
                  onClick={handleAdd}
                  disabled={item._shop?.sellable === false}
                >
                  {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (t('pdp.enrollNow') || 'Enroll Now')}
                </PdpCtaButton>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-10 sm:space-y-12">
            {item.description && (
              <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-foreground">{t('marketplace.catalogDetails.about') || 'About the course'}</h3>
                <p className="whitespace-pre-wrap">{item.description}</p>
              </div>
            )}

            {videos.length > 0 && (
              <div className="pt-8 border-t">
                <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('marketplace.catalogDetails.videosTitle') || 'Course Content preview'}</h3>
                <div className="grid gap-3 sm:gap-4">
                  {videos.map((vid: any, i: number) => (
                    <div key={vid.url + i} className="flex items-center justify-between p-4 rounded-2xl bg-card border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => handleBuyNow()}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-sm">{i + 1}</span>
                        </div>
                        <div className="font-semibold">{vid.title || `Lesson ${i + 1}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent relative p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 justify-between">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full shadow-lg shadow-primary/20 ring-4 ring-primary/5 flex items-center justify-center shrink-0">
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-1">
                  {t('pdp.youOwnThisCourse') || 'You are enrolled in this course'}
                </h3>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('pdp.continueLearningText') || 'You can access your lessons from your library.'}
                </p>
              </div>
            </div>
            <PdpCtaButton onClick={() => router.push(`/buyer/course/${ownedEntitlement.id}`)} className="w-full sm:w-auto px-8">
              {t('buyer.library.actions.course') || 'Go to Course'}
            </PdpCtaButton>
          </div>
          
          {item.description && (
            <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed pt-8 border-t border-border/50">
              <h3 className="text-xl font-bold mb-4 text-foreground">{t('marketplace.catalogDetails.about') || 'About the course'}</h3>
              <p className="whitespace-pre-wrap">{item.description}</p>
            </div>
          )}
        </div>
      )}

      {experience?.kind === 'subscription' && experience.subscription && (
        <div className="mt-12 pt-12 border-t">
          <SubscriptionManagePanel subscription={experience.subscription} />
        </div>
      )}

      {!ownedEntitlement && (
        <PdpMobileBuyBar price={item.target_sale_price || 0} fullWidthCta={true}>
          <div className="flex gap-2 w-full">
            <PdpCtaButton 
              variant="outline"
              onClick={handleAdd}
              disabled={item._shop?.sellable === false}
              className="px-4 shrink-0 w-auto"
            >
              {t('marketplace.add') || 'Add'}
            </PdpCtaButton>
            <PdpCtaButton 
              onClick={handleBuyNow}
              disabled={item._shop?.sellable === false}
              className="flex-1"
            >
              {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (t('pdp.enrollNow') || 'Enroll Now')}
            </PdpCtaButton>
          </div>
        </PdpMobileBuyBar>
      )}
    </div>
  )
}
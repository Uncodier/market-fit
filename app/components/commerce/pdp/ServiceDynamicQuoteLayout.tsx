"use client"

import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay, resolveVenueLocation } from "@/app/catalog/product-details"
import { VenueLocationSection } from "./VenueLocationSection"
import { MapPin, User, Clock } from "@/app/components/ui/icons"
import { PdpMetricChips } from "./PdpMetricChips"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"
import {
  DynamicQuoteMobileBar,
  DynamicQuotePdpFields,
  DynamicQuotePdpProvider,
  DynamicQuotePdpRail,
} from "./DynamicQuotePdpPanel"
import { PdpExperience } from "./pdp-experience"

export function ServiceDynamicQuoteLayout({
  item,
  backUrl,
  experience,
}: {
  item: CatalogItem & { _shop?: any }
  backUrl: string
  experience?: PdpExperience
}) {
  const { t } = useLocalization()
  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  const instructor = resolveItemSpecDisplay(item, "instructor") || resolveItemSpecDisplay(item, "host")
  const venueLocation = resolveVenueLocation(item)
  const heroImageUrl = resolveItemImage(item, "full")

  return (
    <DynamicQuotePdpProvider item={item} backUrl={backUrl}>
      <div className="pb-28 lg:pb-0">
        <div className="w-full px-4 md:px-8">
          <div className="w-full h-36 sm:h-44 md:h-52 bg-muted relative rounded-2xl sm:rounded-[1.5rem] overflow-hidden">
            <img src={heroImageUrl} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-4 lg:mb-5">
            <PdpMetricChips
              className="mb-2 sm:mb-3"
              chips={[
                instructor
                  ? {
                      icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />,
                      imageUrl: instructor.image_url,
                      label: instructor.name,
                    }
                  : attributes.instructor
                    ? {
                        icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />,
                        label: attributes.instructor,
                      }
                    : null,
                venueLocation.name
                  ? {
                      icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />,
                      imageUrl: venueLocation.image_url,
                      label: venueLocation.name,
                    }
                  : null,
                attributes.duration
                  ? {
                      icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" />,
                      label: attributes.duration,
                    }
                  : null,
              ]}
            />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
              {item.name}
            </h1>
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div className="lg:col-span-7 xl:col-span-8 order-1 space-y-8">
              <DynamicQuotePdpFields />

              {(venueLocation.address || venueLocation.city || venueLocation.name) && (
                <div className="pt-4 border-t">
                  <VenueLocationSection
                    name={venueLocation.name}
                    address={venueLocation.address}
                    city={venueLocation.city}
                  />
                </div>
              )}

              {item.description && (
                <div className="pt-4 border-t">
                  <h3 className="font-bold text-2xl mb-4">
                    {t("marketplace.catalogDetails.about")}
                  </h3>
                  <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    <p>{item.description}</p>
                  </div>
                </div>
              )}

              {experience?.kind === "subscription" && experience.subscription && (
                <div className="pt-4 border-t">
                  <SubscriptionManagePanel subscription={experience.subscription} />
                </div>
              )}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 order-2">
              <div className="lg:sticky lg:top-28 bg-card border border-border/50 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/5">
                <DynamicQuotePdpRail />
              </div>
            </div>
          </div>
        </div>
        <DynamicQuoteMobileBar />
      </div>
    </DynamicQuotePdpProvider>
  )
}

import { getRRCalendarBySlug, getSiteInfoBySlug } from "@/app/book/actions"
import { resolveShopIconVisual } from "@/app/lib/commerce-metadata"
import { OG_SIZE, renderCommerceOgImage } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const alt = "Book a meeting"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ siteSlug: string; eventSlug: string }>
}) {
  const { siteSlug, eventSlug } = await params
  
  const site = await getSiteInfoBySlug(siteSlug)
  
  if (!site) {
    return renderCommerceOgImage({
      source: { kind: "url", url: "/images/logo.png" },
      fit: "contain",
    })
  }

  const rrData = await getRRCalendarBySlug(eventSlug, site.id)
  
  const visual = resolveShopIconVisual(site)
  
  const eventName = rrData?.calendar?.name || "Meeting"
  const durationText = rrData?.calendar?.duration ? `${rrData.calendar.duration} min` : ""
  
  return renderCommerceOgImage({
    source: visual.source,
    fit: visual.fit,
    title: `Book ${eventName}`,
    subtitle: durationText ? `Schedule a ${durationText} meeting with our team` : "Schedule a meeting with our team",
    eyebrow: site.name || "Booking",
  })
}

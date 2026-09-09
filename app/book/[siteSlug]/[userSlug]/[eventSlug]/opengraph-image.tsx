import { getProfileBySlug, getSiteInfoBySlug } from "@/app/book/actions"
import { resolveShopIconVisual } from "@/app/lib/commerce-metadata"
import { OG_SIZE, renderCommerceOgImage } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const alt = "Book a meeting"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ siteSlug: string; userSlug: string; eventSlug: string }>
}) {
  const { siteSlug, userSlug, eventSlug } = await params
  
  const site = await getSiteInfoBySlug(siteSlug)
  const profile = await getProfileBySlug(userSlug)
  
  if (!site) {
    return renderCommerceOgImage({
      source: { kind: "url", url: "/images/logo.png" },
      fit: "contain",
    })
  }

  // Find the event to get its name/duration for the description
  const event = profile?.settings?.calendar?.events?.find((e: any) => e.slug === eventSlug)
  
  // Use resolveShopIconVisual so we get the logo instead of hero background (cleaner for booking)
  const visual = resolveShopIconVisual(site)
  
  const eventName = event?.name || "Meeting"
  const durationText = event?.duration ? `${event.duration} min` : ""
  const userName = profile?.name || "Team Member"
  
  return renderCommerceOgImage({
    source: visual.source,
    fit: visual.fit,
    title: `Book ${eventName} with ${userName}`,
    subtitle: durationText ? `Schedule a ${durationText} meeting` : "Schedule a meeting",
    eyebrow: site.name || "Booking",
  })
}

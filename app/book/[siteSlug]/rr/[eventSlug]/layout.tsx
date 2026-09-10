import { Metadata } from 'next'
import { getRRCalendarBySlug, getSiteInfoBySlug } from '@/app/book/actions'
import { toAbsoluteShareImageUrl } from '@/app/lib/commerce-metadata'

export async function generateMetadata(
  props: { params: Promise<{ siteSlug: string; eventSlug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const site = await getSiteInfoBySlug(params.siteSlug);
  
  let eventName = "Meeting";
  if (site) {
    const rrData = await getRRCalendarBySlug(params.eventSlug, site.id);
    if (rrData?.calendar?.name) {
      eventName = rrData.calendar.name;
    }
  }
  
  const title = `Book ${eventName}`;
  const description = `Schedule a meeting with our team on ${site?.name || "Makinari"}`;
  const logo = site?.logo_url || '/images/logo.png';
  const imageUrl = toAbsoluteShareImageUrl(logo);
  
  return {
    title,
    description,
    openGraph: { title, description, siteName: site?.name || "Makinari", images: [imageUrl] },
    twitter: { card: 'summary_large_image', title, description, images: [imageUrl] }
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
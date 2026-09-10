import { Metadata } from 'next'
import { getProfileBySlug, getSiteInfoBySlug } from '@/app/book/actions'
import { toAbsoluteShareImageUrl } from '@/app/lib/commerce-metadata'

export async function generateMetadata(
  props: { params: Promise<{ siteSlug: string; userSlug: string; eventSlug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const site = await getSiteInfoBySlug(params.siteSlug);
  const profile = await getProfileBySlug(params.userSlug);
  
  const event = profile?.settings?.calendar?.event_types?.find((e: any) => e.slug === params.eventSlug);
  const eventName = event?.title || "Meeting";
  const userName = profile?.name || "Team Member";
  
  const title = `Book ${eventName} with ${userName}`;
  const description = `Schedule a meeting on ${site?.name || "Makinari"}`;
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
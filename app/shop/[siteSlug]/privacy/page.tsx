import { Suspense } from "react"
import { getShopSite } from "../actions"
import { Metadata } from "next"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { ShopSlugNotFound } from "../ShopSlugNotFound"
import { PrivacyClient } from "./PrivacyClient"

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }): Promise<Metadata> {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  if (!siteSlug) return { title: 'Privacy Policy | Makinari' };

  const site = await getShopSite(siteSlug);
  if (!site) return { title: 'Privacy Policy | Makinari' };

  return {
    title: `Privacy Policy | ${site.name}`,
  };
}

export default async function ShopPrivacyPage({ params }: { params: Promise<{ siteSlug: string }> | { siteSlug: string } }) {
  const resolvedParams = await params;
  const siteSlug = 'siteSlug' in resolvedParams ? resolvedParams.siteSlug : undefined;
  
  if (!siteSlug) {
    return <ShopSlugNotFound />
  }

  const site = await getShopSite(siteSlug);
  
  if (!site) {
    return <ShopSlugNotFound slug={siteSlug} />
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <SiteLocaleBootstrap locale={site.settings?.default_locale} />
      <PrivacyClient siteSlug={siteSlug} site={site} />
    </div>
  )
}

import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { getShopSite } from "../actions"
import { notFound } from "next/navigation"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ShopItemPage({ params }: { params: Promise<{ siteSlug: string, itemId: string }> }) {
  const { siteSlug, itemId } = await params

  // Prefer resolving via catalog item (includes site join) so a flaky slug scan
  // does not block the PDP when we already have a stable item id.
  const item = await getPdpCatalogItem(itemId)
  if (!item) {
    notFound()
  }

  const siteFromItem = (item as any).site as { id: string; name: string; logo_url: string | null } | null | undefined
  const siteSlugFromName = siteFromItem?.name
    ? siteFromItem.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    : null
  const siteMatchesSlug =
    !!siteFromItem &&
    (siteFromItem.id === siteSlug || siteSlugFromName === siteSlug)

  let site = siteMatchesSlug ? siteFromItem : null
  if (!site) {
    const resolved = await getShopSite(siteSlug)
    if (!resolved || resolved.id !== (item as any).site_id) {
      notFound()
    }
    site = resolved
  }

  let experience = undefined
  if (item.is_recurring) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('buyer_user_id', user.id)
        .eq('catalog_item_id', item.id)
        .in('status', ['active', 'paused'])
        .maybeSingle()
        
      if (subscription) {
        experience = { kind: 'subscription', subscription }
      }
    }
  }

  return <ProductDetailPage item={item as any} site={site} backUrl={`/shop/${siteSlug}`} experience={experience as any} />
}
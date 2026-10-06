import 'server-only'
import { getShopSite } from '@/app/shop/[siteSlug]/actions'
import { createServiceClient } from '@/lib/supabase/server'
import { buildItemImagePrompt, type ItemImagePromptInput } from '@/app/lib/image-utils'
import { isStorefrontAvailable } from '@/app/catalog/storefront-availability'
import { isPromotionAvailableForStorefront, type MerchandisingPromotion } from '@/app/promotions/promotion-availability'
import type { PromptImageInput } from './prompt-image-contract'

type CatalogImage = ItemImagePromptInput & {
  id: string
  parent_id?: string | null
  is_marketplace_listed?: boolean
  availability_mode?: string | null
  availability_status?: string | null
}
const catalogFields = 'id, site_id, name, description, image_url, parent_id, is_marketplace_listed, availability_mode, availability_status, category:catalog_categories(name)'

/** Authorize the public resource before using a service credential to spend site credits.
 * The client prompt is not used for generation; database-owned content determines it.
 */
export async function resolvePublicImageResource(input: PromptImageInput): Promise<PromptImageInput | null> {
  if (!input.site_id || !input.resource_id || !input.resource_type) return null
  const site = await getShopSite(input.site_id)
  if (!site || site.id !== input.site_id) return null
  const context = site as typeof site & { description?: string | null; settings?: { shop?: {
    hero_title?: string; hero_subtitle?: string; hero_image_url?: string
  }; business_hours?: { timezone?: string }[] } }
  let prompt: string
  if (input.resource_type === 'hero') {
    const shop = context.settings?.shop
    if (input.resource_id !== site.id || !shop?.hero_title || shop.hero_image_url) return null
    prompt = buildItemImagePrompt({ name: shop.hero_title, description: shop.hero_subtitle || context.description || 'store hero', siteDescription: context.description })
  } else {
    // Site authorization precedes the server-only, tenant-scoped resource lookup.
    const supabase = await createServiceClient(true)
    if (input.resource_type === 'promotion') {
      const { data, error } = await supabase.from('promotions').select(
        'id, name, image_url, status, channels, show_on_shop, show_on_marketplace, starts_at, ends_at, active_weekdays, usage_limit, usage_count',
      ).eq('site_id', site.id).eq('id', input.resource_id).maybeSingle()
      if (error || !data) return null
      const promo = data as MerchandisingPromotion
      if (!['shop', 'marketplace'].some(surface => isPromotionAvailableForStorefront({
        promo, surface: surface as 'shop' | 'marketplace', timezone: context.settings?.business_hours?.[0]?.timezone,
      }))) return null
      prompt = promo.name?.trim() || 'Promotion'
    } else {
      const { data, error } = await supabase.from('catalog_items').select(catalogFields)
        .eq('site_id', site.id).eq('id', input.resource_id).eq('status', 'active').maybeSingle()
      if (error || !data) return null
      const item = data as CatalogImage
      if (!isStorefrontAvailable(item)) return null
      let parent: CatalogImage | null = null
      if (input.host_id) {
        const host = await supabase.from('catalog_items').select(catalogFields)
          .eq('site_id', site.id).eq('id', input.host_id).eq('status', 'active').maybeSingle()
        if (host.error || !host.data) return null
        parent = host.data as CatalogImage
        const memberships = await supabase.from('modifier_group_items').select('modifier_group_id')
          .eq('site_id', site.id).eq('catalog_item_id', item.id)
        if (memberships.error || !memberships.data?.length) return null
        const links = await supabase.from('catalog_item_modifier_groups').select('modifier_group_id')
          .eq('site_id', site.id).eq('catalog_item_id', parent.id)
        const members = memberships.data as { modifier_group_id: string }[]
        const hostLinks = links.data as { modifier_group_id: string }[] | null
        if (links.error || !hostLinks?.some(link => members.some(member => member.modifier_group_id === link.modifier_group_id))) return null
      } else if (item.parent_id) {
        const result = await supabase.from('catalog_items').select(catalogFields)
          .eq('site_id', site.id).eq('id', item.parent_id).eq('status', 'active').maybeSingle()
        if (result.error || !result.data) return null
        parent = result.data as CatalogImage
      }
      const publicItem = parent || item
      if (!publicItem.is_marketplace_listed || !isStorefrontAvailable(publicItem)) return null
      prompt = buildItemImagePrompt({ ...item, siteDescription: context.description,
        parent: parent ? { name: parent.name, description: parent.description } : undefined,
        parentRelation: input.host_id ? 'addon' : 'variant',
        category: item.category || parent?.category })
    }
  }
  // One persistent source image serves all responsive sizes and callers.
  return { prompt, site_id: site.id, width: 1024, height: 1024 }
}
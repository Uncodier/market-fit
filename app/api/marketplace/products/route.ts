import { createServiceClient } from "@/lib/supabase/server"
import { attachSiteSettings } from "@/app/marketplace/attach-site-settings"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { loadVariantListingPreviews } from "@/app/catalog/variant-resolve"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind')
    const digitalSubtype = searchParams.get('digitalSubtype')
    const siteId = searchParams.get('siteId')
    const search = searchParams.get('search')
    const isRecurring = searchParams.get('is_recurring') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Public marketplace aggregation — same pattern as /shop
    const supabase = await createServiceClient(true)

    let query = applyStorefrontAvailability(
      supabase
        .from('catalog_items')
        .select('*, site:sites!inner(id, name, logo_url), raw_specs:catalog_item_specs(sort_order, item_spec:item_specs(*, category:item_spec_categories(*)))', { count: 'exact' })
        .eq('is_marketplace_listed', true)
        .eq('status', 'active')
        .is('parent_id', null)
    )

    if (kind && kind !== 'all') {
      query = query.eq('kind', kind)
    }

    if (digitalSubtype && digitalSubtype !== 'all') {
      query = query.eq('digital_subtype', digitalSubtype)
    }

    if (siteId) {
      query = query.eq('site_id', siteId)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (isRecurring) {
      query = query.eq('is_recurring', true)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('created_at', { ascending: false })

    const { data, count, error } = await query

    if (error) throw error

    const withSettings = await attachSiteSettings(supabase, data || [])
    const priced = await applyChannelPricesToItems(supabase, withSettings, "marketplace")
    const variantPreviews = await loadVariantListingPreviews(
      supabase,
      priced.map((item) => ({ id: item.id, name: item.name }))
    )
    const enrichedData = priced.map(item => {
      const preview = variantPreviews.get(item.id)
      return {
        ...item,
        item_specs: (item.raw_specs || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((cis: any) => cis.item_spec).filter(Boolean),
        _shop: {
          ...(item as any)._shop,
          hasVariants:
            Boolean(preview?.hasVariants) ||
            Boolean(item.metadata?.variant_axes?.length && item.is_purchasable === false),
          variantLabels: preview?.labels || [],
        },
      }
    })

    return NextResponse.json({
      data: enrichedData,
      count,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

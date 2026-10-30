import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveSiteInfoBySlug, toSiteSlug } from '@/app/book/site-by-slug'
import { isProcurementPortalDemo } from './demo-mode'
import { demoTenderSite } from '@/lib/demo-data/procurement-portal'

export type TenderSiteIdentity = { slug: string; name: string; portalSlug: string; logoUrl?: string | null }
type Portal = { slug: string; sites: { name: string; logo_url?: string | null; archived_at: string | null } | null }

function identity(portal: Portal | null): TenderSiteIdentity | null {
  if (!portal?.sites || portal.sites.archived_at !== null) return null
  const slug = toSiteSlug(portal.sites.name)
  return slug ? { slug, name: portal.sites.name, portalSlug: portal.slug, logoUrl: portal.sites.logo_url ?? null } : null
}

/** Public identity only; publication visibility remains enforced by the public RPC. */
export async function loadTenderSiteIdentity(slug: string): Promise<TenderSiteIdentity | null> {
  if (await isProcurementPortalDemo()) return slug === demoTenderSite.slug ? demoTenderSite : null
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) return null
  const supabase = await createServiceClient(true, { access: 'public' })
  const select = 'slug,sites!inner(name,logo_url,archived_at)'
  const legacy = await supabase.from('procurement_tender_portals').select(select)
    .eq('slug', slug).eq('enabled', true).maybeSingle()
  if (legacy.error) throw new Error('Tender publications are temporarily unavailable.')
  const existing = identity(legacy.data as Portal | null)
  if (existing) return existing
  const site = await resolveSiteInfoBySlug(slug)
  if (!site) return null
  const portal = await supabase.from('procurement_tender_portals').select(select)
    .eq('site_id', site.id).eq('enabled', true).maybeSingle()
  if (portal.error) throw new Error('Tender publications are temporarily unavailable.')
  return identity(portal.data as Portal | null)
}

export async function loadTenderSiteIdentities(slugs: string[]): Promise<Map<string, TenderSiteIdentity>> {
  if (await isProcurementPortalDemo()) return new Map(slugs.includes(demoTenderSite.slug) ? [[demoTenderSite.slug, demoTenderSite]] : [])
  if (!slugs.length) return new Map()
  const supabase = await createServiceClient(true, { access: 'public' })
  const result = await supabase.from('procurement_tender_portals').select('slug,sites!inner(name,logo_url,archived_at)')
    .in('slug', [...new Set(slugs)]).eq('enabled', true)
  if (result.error) throw new Error('Tender publications are temporarily unavailable.')
  const entries = (result.data as Portal[] ?? []).flatMap(portal => {
    const site = identity(portal)
    return site ? [[portal.slug, site] as const] : []
  })
  return new Map(entries)
}
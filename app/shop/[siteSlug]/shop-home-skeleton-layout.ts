export type ShopHomeSkeletonSite = {
  name?: string | null
  logo_url?: string | null
  settings?: {
    shop?: {
      hero_title?: string | null
      hero_subtitle?: string | null
      hero_image_url?: string | null
      hero_cta_label?: string | null
      hero_order_bar?: boolean | null
      trust_badges?: unknown[] | null
    } | null
  } | null
}

export type ShopHomeSkeletonLayout = {
  showHero: boolean
  showOrderBar: boolean
  showBadges: boolean
  badgeCount: number
  hasLogo: boolean
  hasCategories: boolean
  siteName: string
  logoUrl: string | null
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string | null
  heroCtaLabel: string
}

/**
 * Mirrors ShopHeroTrust / ShopCatalogMain visibility so the loading shell
 * does not paint optional chrome (order bar, trust strip, trending header)
 * that the loaded shop never shows.
 */
export function resolveShopHomeSkeletonLayout(
  site?: ShopHomeSkeletonSite | null,
  hasCategories?: boolean
): ShopHomeSkeletonLayout {
  const shop = site?.settings?.shop
  const badges = Array.isArray(shop?.trust_badges) ? shop.trust_badges : []
  const knownSite = Boolean(site)

  return {
    showHero: knownSite
      ? Boolean(shop?.hero_title || shop?.hero_image_url)
      : true,
    showOrderBar: shop?.hero_order_bar === true,
    showBadges: badges.length > 0,
    badgeCount: badges.length > 0 ? Math.min(badges.length, 3) : 3,
    hasLogo: Boolean(site?.logo_url),
    hasCategories: hasCategories ?? true,
    siteName: site?.name || "",
    logoUrl: site?.logo_url || null,
    heroTitle: shop?.hero_title || "",
    heroSubtitle: shop?.hero_subtitle || "",
    heroImageUrl: shop?.hero_image_url || null,
    heroCtaLabel: shop?.hero_cta_label || "",
  }
}

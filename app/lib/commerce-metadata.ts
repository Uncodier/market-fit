import type { Metadata } from "next"
import { resolveItemImage } from "@/app/lib/image-utils"

const DEFAULT_DESCRIPTION_MAX = 200

export type ShareImageSource =
  | { kind: "url"; url: string }
  | { kind: "data"; dataUrl: string }

export type ShopShareVisual = {
  source: ShareImageSource
  fit: "cover" | "contain"
  title: string
  subtitle?: string
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://makinari.com").replace(/\/$/, "")
}

function truncateText(text: string, max = DEFAULT_DESCRIPTION_MAX): string {
  const cleaned = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
}

/** Public http(s) or site-relative paths crawlers can fetch. */
export function isUsableShareImageUrl(url?: string | null): url is string {
  if (!url?.trim()) return false
  const value = url.trim()
  if (value.startsWith("data:") || value.startsWith("blob:")) return false
  return (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("/")
  )
}

export function toAbsoluteShareImageUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return new URL(url, `${appBaseUrl()}/`).toString()
}

function isDataImageUrl(url?: string | null): url is string {
  return !!url?.trim().startsWith("data:image/")
}

function firstShareImageSource(
  ...candidates: Array<string | null | undefined>
): ShareImageSource | undefined {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue
    if (isUsableShareImageUrl(candidate)) {
      return { kind: "url", url: toAbsoluteShareImageUrl(candidate) }
    }
    if (isDataImageUrl(candidate)) {
      return { kind: "data", dataUrl: candidate.trim() }
    }
  }
  return undefined
}

export function resolveShopShareVisual(site: {
  name: string
  logo_url?: string | null
  settings?: { shop?: {
    hero_title?: string
    hero_subtitle?: string
    hero_image_url?: string
  } }
}): ShopShareVisual {
  const shop = site.settings?.shop
  const subtitle = shop?.hero_subtitle || shop?.hero_title || undefined
  const hero = firstShareImageSource(shop?.hero_image_url)
  if (hero) {
    return { source: hero, fit: "cover", title: site.name, subtitle }
  }

  const logo = firstShareImageSource(site.logo_url)
  if (logo) {
    return { source: logo, fit: "contain", title: site.name, subtitle }
  }

  return {
    source: {
      kind: "url",
      url: resolveItemImage({ name: site.name, description: subtitle }),
    },
    fit: "cover",
    title: site.name,
    subtitle,
  }
}

export function resolveCatalogItemShareImageSource(item: {
  name: string
  description?: string | null
  image_url?: string | null
  metadata?: { gallery?: string[] } | null
}): ShareImageSource {
  return (
    firstShareImageSource(item.image_url, item.metadata?.gallery?.[0]) || {
      kind: "url",
      url: resolveItemImage({ name: item.name, description: item.description }),
    }
  )
}

export function buildShareMetadata(opts: {
  title: string
  description?: string | null
  imageUrl?: string | null
  url?: string
  siteName?: string
  icons?: Metadata["icons"]
}): Metadata {
  const description = opts.description
    ? truncateText(opts.description)
    : undefined
  const image = isUsableShareImageUrl(opts.imageUrl)
    ? toAbsoluteShareImageUrl(opts.imageUrl)
    : undefined
  const images = image
    ? [{ url: image, width: 1200, height: 630, alt: opts.title }]
    : undefined

  return {
    title: opts.title,
    description,
    ...(opts.icons ? { icons: opts.icons } : {}),
    openGraph: {
      type: "website",
      title: opts.title,
      description,
      siteName: opts.siteName || "Makinari",
      url: opts.url,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary_large_image",
      title: opts.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export function buildShopShareMetadata(
  site: {
    name: string
    logo_url?: string | null
    settings?: { shop?: {
      hero_title?: string
      hero_subtitle?: string
      hero_image_url?: string
    } }
  },
  path: string,
): Metadata {
  const shop = site.settings?.shop
  const title = `${site.name} | Shop`
  const description =
    shop?.hero_subtitle ||
    shop?.hero_title ||
    `Shop ${site.name} on Makinari.`

  // Image/icon bytes come from opengraph-image.tsx / icon.tsx (supports data: logos).
  // Do not put data: URLs or the global Makinari asset into og:image meta tags.
  return buildShareMetadata({
    title,
    description,
    url: path,
    siteName: site.name,
    icons: {
      icon: [{ url: `${path}/icon`, type: "image/png" }],
      apple: [{ url: `${path}/apple-icon`, type: "image/png" }],
    },
  })
}

export function buildCatalogItemShareMetadata(
  item: {
    name: string
    description?: string | null
    image_url?: string | null
    metadata?: { gallery?: string[] } | null
    site?: { name?: string | null } | null
  },
  path: string,
): Metadata {
  const siteName = item.site?.name || undefined
  const title = siteName ? `${item.name} | ${siteName}` : item.name
  const description =
    item.description ||
    (siteName
      ? `Buy ${item.name} from ${siteName} on Makinari.`
      : `Buy ${item.name} on Makinari.`)

  return buildShareMetadata({
    title,
    description,
    url: path,
    siteName: siteName || "Makinari",
    icons: {
      icon: [{ url: `${path}/icon`, type: "image/png" }],
      apple: [{ url: `${path}/apple-icon`, type: "image/png" }],
    },
  })
}

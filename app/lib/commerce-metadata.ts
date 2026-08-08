import type { Metadata } from "next"
import { resolveItemImage } from "@/app/lib/image-utils"

const DEFAULT_DESCRIPTION_MAX = 200

type ShareImageSource =
  | { kind: "url"; url: string }
  | { kind: "data"; dataUrl: string }

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

export function resolveShopShareImageSource(site: {
  name: string
  logo_url?: string | null
  settings?: { shop?: { hero_image_url?: string; hero_subtitle?: string; hero_title?: string } }
}): ShareImageSource {
  const shop = site.settings?.shop
  return (
    firstShareImageSource(shop?.hero_image_url, site.logo_url) || {
      kind: "url",
      url: resolveItemImage({
        name: site.name,
        description: shop?.hero_subtitle || shop?.hero_title || undefined,
      }),
    }
  )
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

/** Absolute URL for og:image meta tags (never data:). */
export function shareImageSourceToMetaUrl(
  source: ShareImageSource,
  openGraphImagePath?: string,
): string {
  if (source.kind === "url") return source.url
  // data: logos cannot be embedded in meta tags — point crawlers at the route image.
  return openGraphImagePath
    ? toAbsoluteShareImageUrl(openGraphImagePath)
    : toAbsoluteShareImageUrl("/opengraph-image.jpg")
}

export async function respondWithShareImageSource(
  source: ShareImageSource,
): Promise<Response> {
  if (source.kind === "data") {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(source.dataUrl)
    if (!match) {
      return new Response("Invalid data image", { status: 400 })
    }
    const buffer = Buffer.from(match[2], "base64")
    return new Response(buffer, {
      headers: {
        "Content-Type": match[1] || "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    })
  }

  const absoluteUrl = toAbsoluteShareImageUrl(source.url)
  const upstream = await fetch(absoluteUrl, {
    headers: { Accept: "image/*" },
    next: { revalidate: 3600 },
  })

  if (!upstream.ok || !upstream.body) {
    return new Response("Share image unavailable", { status: 404 })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}

export function buildShareMetadata(opts: {
  title: string
  description?: string | null
  imageUrl?: string | null
  url?: string
  siteName?: string
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
    openGraph: {
      type: "website",
      title: opts.title,
      description,
      siteName: opts.siteName || "Makinari",
      url: opts.url,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
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
  const source = resolveShopShareImageSource(site)

  return buildShareMetadata({
    title,
    description,
    imageUrl: shareImageSourceToMetaUrl(source, `${path}/opengraph-image`),
    url: path,
    siteName: site.name,
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
  const source = resolveCatalogItemShareImageSource(item)

  return buildShareMetadata({
    title,
    description,
    imageUrl: shareImageSourceToMetaUrl(source, `${path}/opengraph-image`),
    url: path,
    siteName: siteName || "Makinari",
  })
}

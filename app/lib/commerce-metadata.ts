import type { Metadata } from "next"
import { resolveItemImage } from "@/app/lib/image-utils"

const DEFAULT_DESCRIPTION_MAX = 200

function truncateText(text: string, max = DEFAULT_DESCRIPTION_MAX): string {
  const cleaned = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
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
  const image = opts.imageUrl?.trim() || undefined
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
  const imageUrl =
    shop?.hero_image_url ||
    site.logo_url ||
    resolveItemImage({ name: site.name, description })

  return buildShareMetadata({
    title,
    description,
    imageUrl,
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
  const imageUrl =
    item.image_url ||
    item.metadata?.gallery?.[0] ||
    resolveItemImage({ name: item.name, description: item.description })

  return buildShareMetadata({
    title,
    description,
    imageUrl,
    url: path,
    siteName: siteName || "Makinari",
  })
}

import {
  IMAGE_SIZE_PX,
  optimizeForPreset,
  type ImageSizePreset,
} from "@/app/lib/optimize-storage-image"

export type { ImageSizePreset } from "@/app/lib/optimize-storage-image"
export {
  IMAGE_SIZE_PX,
  IMAGE_SIZE_QUALITY,
  IMAGE_SIZE_RESIZE,
  optimizeStorageImageUrl,
  optimizeForPreset,
} from "@/app/lib/optimize-storage-image"

/** Max raw prompt length before URL-encoding (avoids backend 403s on long paths). */
const MAX_PROMPT_CHARS = 220

export type ItemImagePromptInput = {
  image_url?: string | null
  name: string
  description?: string | null
  category?: string | { name?: string | null } | null
  siteDescription?: string | null
  site?: { description?: string | null; name?: string | null } | null
  parent?: { name?: string | null; description?: string | null } | null
  /** How parent context is phrased in AI prompts. Defaults to variant. */
  parentRelation?: "variant" | "addon"
  _shop?: {
    categoryName?: string | null
    siteDescription?: string | null
    parentName?: string | null
    parentDescription?: string | null
  } | null
}

function publicPromptImageUrl(prompt: string, size = 1024): string {
  const apiServerUrl =
    process.env.NEXT_PUBLIC_API_SERVER_URL || "http://localhost:3001";
  return `${apiServerUrl}/api/public/image/prompt/${encodeURIComponent(
    prompt.trim(),
  )}?width=${size}&height=${size}`;
}

function cleanPromptPart(value?: string | null, max = 80): string {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function categoryLabel(item: ItemImagePromptInput): string | null {
  if (typeof item.category === "string" && item.category.trim()) {
    return item.category.trim()
  }
  if (item.category && typeof item.category === "object") {
    const name = item.category.name?.trim()
    if (name) return name
  }
  const fromShop = item._shop?.categoryName?.trim()
  return fromShop || null
}

function siteDescriptionOf(item: ItemImagePromptInput): string | null {
  return (
    cleanPromptPart(item.siteDescription, 120) ||
    cleanPromptPart(item._shop?.siteDescription, 120) ||
    cleanPromptPart(item.site?.description, 120) ||
    null
  )
}

function parentOf(
  item: ItemImagePromptInput,
): { name: string; description?: string | null } | null {
  const name =
    cleanPromptPart(item.parent?.name, 80) ||
    cleanPromptPart(item._shop?.parentName, 80)
  if (!name) return null
  return {
    name,
    description:
      item.parent?.description ?? item._shop?.parentDescription ?? null,
  }
}

/** Build a compact AI image prompt from catalog / shop context. */
export function buildItemImagePrompt(item: ItemImagePromptInput): string {
  const parts: string[] = []
  const name = cleanPromptPart(item.name, 80) || "Product"
  parts.push(name)

  const parent = parentOf(item)
  if (parent && parent.name.toLowerCase() !== name.toLowerCase()) {
    const parentDesc = cleanPromptPart(parent.description, 60)
    if (item.parentRelation === "addon") {
      parts.push(
        parentDesc
          ? `add-on for ${parent.name}: ${parentDesc}`
          : `add-on for ${parent.name}`,
      )
    } else {
      parts.push(
        parentDesc
          ? `variant of ${parent.name}: ${parentDesc}`
          : `variant of ${parent.name}`,
      )
    }
  }

  const siteName = cleanPromptPart(item.site?.name, 40)
  if (siteName) parts.push(`sold at ${siteName}`)

  const desc = cleanPromptPart(item.description, 90)
  if (desc) parts.push(desc)

  const cat = cleanPromptPart(categoryLabel(item), 40)
  if (cat) parts.push(`category ${cat}`)

  const siteDesc = siteDescriptionOf(item)
  if (siteDesc) parts.push(siteDesc)

  let prompt = parts.join(". ")
  if (prompt.length > MAX_PROMPT_CHARS) {
    prompt = prompt.slice(0, MAX_PROMPT_CHARS).trim()
  }
  return prompt
}

export function resolveItemImage(
  item: ItemImagePromptInput,
  size?: ImageSizePreset,
): string {
  const uploaded = realImageUrl(item.image_url)
  if (uploaded) {
    return size ? optimizeForPreset(uploaded, size) : uploaded
  }
  const px = size ? IMAGE_SIZE_PX[size] : 1024
  return publicPromptImageUrl(buildItemImagePrompt(item), px)
}

/** Real uploaded URLs only (skips AI prompt placeholders). */
export function realImageUrl(url?: string | null): string | null {
  const trimmed = typeof url === "string" ? url.trim() : ""
  return trimmed || null
}

export type PdpGalleryEntry = {
  url: string
  /** Child (or parent) catalog item this thumb represents; used to sync variant selection. */
  catalogItemId?: string
}

type GalleryParent = ItemImagePromptInput & {
  id: string
  metadata?: { gallery?: unknown } | null
}

type GalleryChild = {
  id: string
  name: string
  description?: string | null
  image_url?: string | null
}

/**
 * PDP gallery entries for thumbs + main image.
 * With variants: one thumb per child — uploaded image_url, else AI prompt image for the SKU
 * (includes parent name/description, category, and site description when available).
 * Parent real image is included when children exist and parent has its own photo.
 * Extra metadata.gallery URLs are appended (deduped).
 */
export function buildPdpGalleryEntries(params: {
  parent: GalleryParent
  children?: GalleryChild[]
  size?: ImageSizePreset
}): PdpGalleryEntry[] {
  const children = params.children || []
  const size = params.size
  const entries: PdpGalleryEntry[] = []
  const seen = new Set<string>()
  const parentContext = {
    parent: {
      name: params.parent.name,
      description: params.parent.description,
    },
    category: params.parent.category ?? params.parent._shop?.categoryName ?? null,
    siteDescription:
      params.parent.siteDescription ??
      params.parent._shop?.siteDescription ??
      params.parent.site?.description ??
      null,
    site: params.parent.site,
    _shop: params.parent._shop,
  }

  const sizedUrl = (url: string) =>
    size ? optimizeForPreset(url, size) : url

  const push = (url: string, catalogItemId?: string) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    entries.push(catalogItemId ? { url, catalogItemId } : { url })
  }

  if (children.length > 0) {
    // Parent photo first when it has a real upload (distinct from child AI thumbs).
    const parentReal = realImageUrl(params.parent.image_url)
    if (parentReal) push(sizedUrl(parentReal), params.parent.id)

    for (const child of children) {
      // Own upload, otherwise AI image for this variant with parent/site context.
      const url = resolveItemImage(
        {
          ...child,
          ...parentContext,
        },
        size,
      )
      // Allow same URL for multiple variants (shared upload) — key by item, not URL.
      if (!url) continue
      const alreadyForChild = entries.some((e) => e.catalogItemId === child.id)
      if (alreadyForChild) continue
      entries.push({ url, catalogItemId: child.id })
      seen.add(url)
    }
  } else {
    push(resolveItemImage(params.parent, size), params.parent.id)
  }

  const gallery = params.parent.metadata?.gallery
  if (Array.isArray(gallery)) {
    for (const entry of gallery) {
      if (typeof entry !== "string") continue
      const url = realImageUrl(entry)
      if (url) push(sizedUrl(url))
    }
  }

  return entries
}

/** Image URLs for gallery entries. */
export function buildPdpGalleryUrls(params: {
  parent: GalleryParent
  children?: GalleryChild[]
  size?: ImageSizePreset
}): string[] {
  return buildPdpGalleryEntries({
    parent: params.parent,
    children: params.children,
    size: params.size,
  }).map((e) => e.url)
}

/** Same dynamic AI image API as catalog when a promotion has no uploaded image. */
export function resolvePromotionImage(
  promo: {
    image_url?: string | null
    name?: string | null
  },
  size?: ImageSizePreset,
): string {
  const uploaded = realImageUrl(promo.image_url)
  if (uploaded) {
    return size ? optimizeForPreset(uploaded, size) : uploaded
  }
  const px = size ? IMAGE_SIZE_PX[size] : 1024
  return publicPromptImageUrl(promo.name?.trim() || "Promotion", px)
}

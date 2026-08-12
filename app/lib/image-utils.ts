function publicPromptImageUrl(prompt: string, size = 1024): string {
  const apiServerUrl =
    process.env.NEXT_PUBLIC_API_SERVER_URL || "http://localhost:3001";
  return `${apiServerUrl}/api/public/image/prompt/${encodeURIComponent(
    prompt.trim(),
  )}?width=${size}&height=${size}`;
}

export function resolveItemImage(item: {
  image_url?: string | null;
  name: string;
  description?: string | null;
}): string {
  const uploaded = realImageUrl(item.image_url);
  if (uploaded) {
    return uploaded;
  }
  // Use name only to avoid long URL 403s on backend
  return publicPromptImageUrl(item.name);
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

/**
 * PDP gallery entries for thumbs + main image.
 * With variants: one thumb per child — uploaded image_url, else AI prompt image for the SKU name.
 * Parent real image is included when children exist and parent has its own photo.
 * Extra metadata.gallery URLs are appended (deduped).
 */
export function buildPdpGalleryEntries(params: {
  parent: {
    id: string
    name: string
    image_url?: string | null
    metadata?: { gallery?: unknown } | null
  }
  children?: { id: string; name: string; image_url?: string | null }[]
}): PdpGalleryEntry[] {
  const children = params.children || []
  const entries: PdpGalleryEntry[] = []
  const seen = new Set<string>()

  const push = (url: string, catalogItemId?: string) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    entries.push(catalogItemId ? { url, catalogItemId } : { url })
  }

  if (children.length > 0) {
    // Parent photo first when it has a real upload (distinct from child AI thumbs).
    const parentReal = realImageUrl(params.parent.image_url)
    if (parentReal) push(parentReal, params.parent.id)

    for (const child of children) {
      // Own upload, otherwise AI image for this variant name.
      const url = resolveItemImage(child)
      // Allow same URL for multiple variants (shared upload) — key by item, not URL.
      if (!url) continue
      const alreadyForChild = entries.some((e) => e.catalogItemId === child.id)
      if (alreadyForChild) continue
      entries.push({ url, catalogItemId: child.id })
      seen.add(url)
    }
  } else {
    push(resolveItemImage(params.parent), params.parent.id)
  }

  const gallery = params.parent.metadata?.gallery
  if (Array.isArray(gallery)) {
    for (const entry of gallery) {
      if (typeof entry !== "string") continue
      const url = realImageUrl(entry)
      if (url) push(url)
    }
  }

  return entries
}

/** Image URLs for gallery entries. */
export function buildPdpGalleryUrls(params: {
  parent: {
    id: string
    name: string
    image_url?: string | null
    metadata?: { gallery?: unknown } | null
  }
  children?: { id: string; name: string; image_url?: string | null }[]
}): string[] {
  return buildPdpGalleryEntries({
    parent: params.parent,
    children: params.children,
  }).map((e) => e.url)
}

/** Same dynamic AI image API as catalog when a promotion has no uploaded image. */
export function resolvePromotionImage(promo: {
  image_url?: string | null;
  name?: string | null;
}): string {
  if (promo.image_url) return promo.image_url;
  return publicPromptImageUrl(promo.name?.trim() || "Promotion");
}

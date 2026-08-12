export type ImageSizePreset = "thumb" | "card" | "hero" | "full"

export const IMAGE_SIZE_PX: Record<ImageSizePreset, number> = {
  thumb: 128,
  card: 400,
  hero: 800,
  full: 1600,
}

export const IMAGE_SIZE_QUALITY: Record<ImageSizePreset, number> = {
  thumb: 70,
  card: 75,
  hero: 80,
  full: 80,
}

/** Square-ish slots crop; wide hero/PDP only scale down so CSS object-fit can frame. */
export const IMAGE_SIZE_RESIZE: Record<
  ImageSizePreset,
  "cover" | "contain"
> = {
  thumb: "cover",
  card: "cover",
  hero: "contain",
  full: "contain",
}

export type OptimizeStorageImageOpts = {
  width: number
  quality?: number
  resize?: "cover" | "contain" | "fill"
}

function isAllowedStorageHost(hostname: string): boolean {
  // Same-host rewrite only. Always allow Storage on *.supabase.co so a custom
  // API domain (e.g. db.makinari.com) does not skip transformation and leave
  // the browser to decode a multi-thousand-px original.
  if (hostname.endsWith(".supabase.co")) return true
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (configured) {
    try {
      return hostname === new URL(configured).hostname
    } catch {
      return false
    }
  }
  return false
}

/**
 * Rewrite a Supabase public Storage URL to the image render endpoint with size params.
 * Fail-open: returns the original URL when the host is not allowed or the path is not Storage.
 */
export function optimizeStorageImageUrl(
  url: string,
  opts: OptimizeStorageImageOpts,
): string {
  try {
    const parsed = new URL(url)
    if (!isAllowedStorageHost(parsed.hostname)) return url
    if (!parsed.pathname.includes("/storage/v1/")) return url

    const objectMarker = "/storage/v1/object/public/"
    const renderMarker = "/storage/v1/render/image/public/"

    if (parsed.pathname.includes(objectMarker)) {
      parsed.pathname = parsed.pathname.replace(objectMarker, renderMarker)
    } else if (!parsed.pathname.includes(renderMarker)) {
      return url
    }

    parsed.searchParams.set("width", String(opts.width))
    parsed.searchParams.set("resize", opts.resize || "cover")
    parsed.searchParams.set(
      "quality",
      String(opts.quality ?? 80),
    )
    return parsed.toString()
  } catch {
    return url
  }
}

export function optimizeForPreset(
  url: string,
  size: ImageSizePreset,
): string {
  return optimizeStorageImageUrl(url, {
    width: IMAGE_SIZE_PX[size],
    quality: IMAGE_SIZE_QUALITY[size],
    resize: IMAGE_SIZE_RESIZE[size],
  })
}

import "server-only"

const PUBLIC_BUCKETS = new Set(["assets", "generative_images", "generative_videos"])

function storageHosts(): Set<string> {
  // Match the existing API social-media attachment policy, not every Supabase tenant.
  const hosts = new Set(["db.makinari.com"])
  for (const value of [process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
        url.pathname === "/" && !url.search && !url.hash &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/.test(url.hostname)) {
        hosts.add(url.hostname)
      }
    } catch {
      // Invalid configuration must not widen the media allowlist.
    }
  }
  return hosts
}

export function isOutstandMediaUrl(value: string): boolean {
  try {
    if (!/^https:\/\//i.test(value) || /[\s\\]/.test(value) ||
      Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false
    // Inspect the original path before URL normalization removes traversal segments.
    const rawPath = value.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1] || ""
    const parts = rawPath.split("/").slice(1).map(decodeURIComponent)
    if (!parts.length || parts.some(part => !part || part === "." || part === ".." ||
      /[\\/%?#]/.test(part) || Array.from(part).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) {
      return false
    }
    return url.hostname === "media.outstand.so" ||
      (storageHosts().has(url.hostname) && parts.slice(0, 4).join("/") === "storage/v1/object/public" &&
        PUBLIC_BUCKETS.has(parts[4]) && parts.length >= 6)
  } catch {
    return false
  }
}
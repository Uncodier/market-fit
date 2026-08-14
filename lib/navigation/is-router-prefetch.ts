type HeaderReader = {
  get(name: string): string | null
}

export function isRouterPrefetchRequest(headers: HeaderReader): boolean {
  const prefetch = headers.get("next-router-prefetch")
  if (prefetch === "1" || prefetch === "true") return true

  const purpose = (headers.get("purpose") || headers.get("Purpose") || "").toLowerCase()
  if (purpose === "prefetch") return true

  const middlewarePrefetch = headers.get("x-middleware-prefetch")
  return middlewarePrefetch === "1" || middlewarePrefetch === "true"
}

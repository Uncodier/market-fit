export function rememberArtifactSession(): void {
  if (typeof window === "undefined") return
  ;(window as any)._isArtifactSession = true
}

export function shouldPreserveArtifact(): boolean {
  if (typeof window === "undefined") return false
  if ((window as any)._isArtifactSession) return true
  const currentUrlParams = new URLSearchParams(window.location.search)
  if (currentUrlParams.get("artifact") === "true") {
    rememberArtifactSession()
    return true
  }
  return false
}

export function appendArtifactIfNeeded(href: string | unknown): string {
  if (typeof href !== "string") return String(href ?? "")
  if (!shouldPreserveArtifact()) return href
  if (!(href.startsWith("/") || href.startsWith("?") || href.startsWith("#"))) return href

  const [pathAndSearch, hash] = href.split("#")
  const [path, search] = pathAndSearch.split("?")
  const params = new URLSearchParams(search || "")
  if (params.has("artifact")) return href
  params.set("artifact", "true")
  return `${path}?${params.toString()}${hash !== undefined ? `#${hash}` : ""}`
}

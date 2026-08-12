const STORAGE_KEY = "makinari:internal-prev-path"

const DOCUMENT_PATH_PREFIXES = [
  "/so/",
  "/i/",
  "/vb/",
  "/q/",
  "/order-pdf/",
  "/bill-pdf/",
  "/quote-pdf/",
  "/invoice-pdf/",
]

export function isDocumentViewPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return DOCUMENT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false
  if (path.startsWith("/auth")) return false
  return true
}

/** Remember the last non-document in-app path for back navigation. */
export function rememberInternalPath(pathname: string | null | undefined) {
  if (typeof window === "undefined") return
  if (!isSafeInternalPath(pathname)) return
  if (isDocumentViewPath(pathname)) return
  try {
    sessionStorage.setItem(STORAGE_KEY, pathname)
  } catch {
    // ignore quota / private mode
  }
}

export function readRememberedInternalPath(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return isSafeInternalPath(stored) ? stored : null
  } catch {
    return null
  }
}

/** Resolve a same-origin back target when the user arrived from Makinari. */
/** Append `?from=` so document pages can show a back button. */
export function withInternalFrom(
  path: string,
  from: string | null | undefined
): string {
  if (!isSafeInternalPath(from)) return path
  if (isDocumentViewPath(from.split("?")[0])) return path
  const sep = path.includes("?") ? "&" : "?"
  return `${path}${sep}from=${encodeURIComponent(from)}`
}

export function resolveInternalBackHref(currentPathname: string | null | undefined): string | null {
  if (typeof window === "undefined") return null

  try {
    const fromParam = new URLSearchParams(window.location.search).get("from")
    if (
      isSafeInternalPath(fromParam) &&
      fromParam.split("?")[0] !== currentPathname &&
      !isDocumentViewPath(fromParam.split("?")[0])
    ) {
      return fromParam
    }
  } catch {
    // ignore
  }

  try {
    const ref = document.referrer
    if (ref) {
      const url = new URL(ref)
      if (
        url.origin === window.location.origin &&
        url.pathname !== currentPathname &&
        isSafeInternalPath(url.pathname) &&
        !isDocumentViewPath(url.pathname)
      ) {
        return `${url.pathname}${url.search}`
      }
    }
  } catch {
    // ignore
  }

  const remembered = readRememberedInternalPath()
  if (
    remembered &&
    remembered.split("?")[0] !== currentPathname &&
    !isDocumentViewPath(remembered.split("?")[0])
  ) {
    return remembered
  }

  return null
}

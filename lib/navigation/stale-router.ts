const WATCHDOG_MS = 1200

function markUiNavigation(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem("uiNavTimestamp", Date.now().toString())
  } catch {
    // Ignore quota / private-mode failures; navigation still proceeds.
  }
}

export type AppRouterLike = {
  push: (href: string, options?: unknown) => void
  replace: (href: string, options?: unknown) => void
}

export type NavigateOrAssignOptions = {
  replace?: boolean
  markUI?: boolean
}

let clientRouterStale = false
let watchdogGeneration = 0

export function markClientRouterStale(): void {
  clientRouterStale = true
}

export function isClientRouterStale(): boolean {
  return clientRouterStale
}

export function clearClientRouterStale(): void {
  clientRouterStale = false
  watchdogGeneration += 1
}

export function hrefToString(href: unknown): string {
  if (typeof href === "string") return href
  if (href && typeof href === "object") {
    const record = href as {
      pathname?: string
      search?: string
      hash?: string
      query?: Record<string, string | string[] | undefined>
    }
    const pathname = record.pathname || ""
    let search = record.search || ""
    if (!search && record.query) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(record.query)) {
        if (Array.isArray(value)) {
          for (const item of value) params.append(key, item)
        } else if (value != null) {
          params.set(key, value)
        }
      }
      const encoded = params.toString()
      if (encoded) search = `?${encoded}`
    } else if (search && !search.startsWith("?")) {
      search = `?${search}`
    }
    const hash = record.hash || ""
    return `${pathname}${search}${hash}`
  }
  return String(href ?? "")
}

export function isSameDestination(
  href: string,
  location: Pick<Location, "pathname" | "search" | "origin"> = window.location
): boolean {
  try {
    const dest = new URL(href, location.origin || "http://localhost")
    return dest.pathname === location.pathname && dest.search === (location.search || "")
  } catch {
    return false
  }
}

function resolveHref(href: string): string {
  if (typeof window === "undefined") return href
  if (/^https?:\/\//i.test(href)) return href
  try {
    return new URL(href, window.location.origin).href
  } catch {
    return href
  }
}

export function assignLocation(href: string): void {
  clientRouterStale = false
  watchdogGeneration += 1
  if (typeof window === "undefined") return
  window.location.assign(resolveHref(href))
}

export function startNavigationWatchdog(href: string): void {
  if (typeof window === "undefined") return
  if (isSameDestination(href)) return
  const generation = ++watchdogGeneration
  const started = `${window.location.pathname}${window.location.search}`
  window.setTimeout(() => {
    if (generation !== watchdogGeneration) return
    const now = `${window.location.pathname}${window.location.search}`
    if (now !== started) return
    if (isSameDestination(href)) return
    assignLocation(href)
  }, WATCHDOG_MS)
}

export function navigateOrAssign(
  router: AppRouterLike,
  href: string,
  options: NavigateOrAssignOptions = {}
): void {
  if (options.markUI !== false) markUiNavigation()

  if (typeof window === "undefined") {
    if (options.replace) router.replace(href)
    else router.push(href)
    return
  }

  if (clientRouterStale) {
    assignLocation(href)
    return
  }

  if (isSameDestination(href)) {
    if (options.replace) router.replace(href)
    else router.push(href)
    return
  }

  if (options.replace) router.replace(href)
  else router.push(href)
  startNavigationWatchdog(href)
}

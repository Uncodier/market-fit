import { appendArtifactIfNeeded } from "./artifact-url"

export const NAVIGATION_PENDING_MS = 300
export const NAVIGATION_SLOW_MS = 10_000
const CHECK_INTERVAL_MS = 250

function markUiNavigation(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem("uiNavTimestamp", Date.now().toString())
  } catch {
    // Ignore quota / private-mode failures; navigation still proceeds.
  }
}

export type RouterNavigationOptions = {
  scroll?: boolean
  transitionTypes?: string[]
}

export type AppRouterLike = {
  push: (href: string, options?: RouterNavigationOptions) => void
  replace: (href: string, options?: RouterNavigationOptions) => void
}

export type NavigateOrAssignOptions = RouterNavigationOptions & {
  replace?: boolean
  markUI?: boolean
}

export type NavigationFeedback = {
  id: number
  status: "pending" | "slow"
}

let feedback: NavigationFeedback | null = null
const listeners = new Set<() => void>()
let watchdogGeneration = 0
let watchdogCleanup: (() => void) | undefined
let recoverNavigation: (() => void) | undefined

export function getNavigationFeedback(): NavigationFeedback | null {
  return feedback
}

export function subscribeNavigationFeedback(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function publishFeedback(next: NavigationFeedback | null): void {
  feedback = next
  listeners.forEach((listener) => listener())
}

export function cancelNavigationWatchdog(): void {
  watchdogGeneration += 1
  watchdogCleanup?.()
  watchdogCleanup = undefined
  recoverNavigation = undefined
  if (feedback) publishFeedback(null)
}

/** Only the explicit recovery action may replace the document. */
export function recoverPendingNavigation(id: number): void {
  if (feedback?.id === id && feedback.status === "slow") recoverNavigation?.()
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
    const dest = new URL(href, `${location.origin}${location.pathname}${location.search}`)
    return dest.origin === location.origin && dest.pathname === location.pathname && dest.search === (location.search || "")
  } catch {
    return false
  }
}

function resolveHref(href: string): URL {
  const url = new URL(href, window.location.href)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Navigation requires an HTTP or HTTPS URL")
  }
  return url
}

export function assignLocation(href: string, replace = false): void {
  cancelNavigationWatchdog()
  if (typeof window === "undefined") return
  const url = resolveHref(appendArtifactIfNeeded(href)).href
  if (replace) window.location.replace(url)
  else window.location.assign(url)
}

export function startNavigationWatchdog(href: string): void {
  // Every new intent supersedes the previous one, including the current URL.
  cancelNavigationWatchdog()
  if (typeof window === "undefined") return
  if (resolveHref(href).origin !== window.location.origin) return
  if (isSameDestination(href)) return
  const generation = ++watchdogGeneration
  const started = `${window.location.pathname}${window.location.search}`
  let visibleSince = Date.now()
  const isCurrent = () => `${window.location.pathname}${window.location.search}` === started
  // Observe progress, never infer that a slow server requires a document reload.
  const interval = window.setInterval(() => {
    if (generation !== watchdogGeneration) return
    if (!isCurrent()) {
      cancelNavigationWatchdog()
      return
    }
    if (document.visibilityState === "hidden") return
    const elapsed = Date.now() - visibleSince
    const status = elapsed >= NAVIGATION_SLOW_MS ? "slow" : elapsed >= NAVIGATION_PENDING_MS ? "pending" : null
    if (status && feedback?.status !== status) publishFeedback({ id: generation, status })
  }, CHECK_INTERVAL_MS)
  const onVisibilityChange = () => {
    visibleSince = Date.now()
    if (feedback) publishFeedback(null)
  }
  recoverNavigation = () => {
    if (generation !== watchdogGeneration || !isCurrent()) return
    // Some callers use Next's router directly. Do not replay an old destination
    // over a newer untracked intent; recovery only reloads the current document.
    cancelNavigationWatchdog()
    window.location.reload()
  }
  // Back/forward is a newer navigation, not evidence that the original one stalled.
  window.addEventListener("popstate", cancelNavigationWatchdog)
  document.addEventListener("visibilitychange", onVisibilityChange)
  watchdogCleanup = () => {
    window.clearInterval(interval)
    window.removeEventListener("popstate", cancelNavigationWatchdog)
    document.removeEventListener("visibilitychange", onVisibilityChange)
  }
}

export function navigateOrAssign(
  router: AppRouterLike,
  href: string,
  options: NavigateOrAssignOptions = {}
): void {
  const targetHref = appendArtifactIfNeeded(href)

  if (options.markUI !== false) markUiNavigation()

  if (typeof window !== "undefined" && resolveHref(targetHref).origin !== window.location.origin) {
    assignLocation(targetHref, options.replace)
    return
  }

  startNavigationWatchdog(targetHref)
  const { scroll, transitionTypes } = options
  const routerOptions = scroll === undefined && transitionTypes === undefined ? [] : [{ scroll, transitionTypes }]
  try {
    if (options.replace) router.replace(targetHref, ...routerOptions)
    else router.push(targetHref, ...routerOptions)
  } catch (error) {
    cancelNavigationWatchdog()
    throw error
  }
}

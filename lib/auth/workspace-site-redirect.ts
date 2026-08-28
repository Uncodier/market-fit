const COMMERCE_PREFIXES = [
  "/buyer",
  "/marketplace",
  "/shop",
  "/book",
  "/cart",
  "/q/",
  "/i/",
  "/so/",
  "/vb/",
]

const NO_REDIRECT_PREFIXES = ["/create-site", "/auth", "/projects", "/demo", "/profile"]

export type WorkspaceSiteRedirect = "/projects"

/**
 * Where to send a signed-in user that has no usable workspace site selected.
 * Demo accounts must stay on the page they loaded (robots iframe, etc.).
 */
export function getWorkspaceSiteRedirect(input: {
  pathname: string
  isDemoMode: boolean
  hasValidSession: boolean
  realSiteCount: number
  hasRealCurrentSite: boolean
}): WorkspaceSiteRedirect | null {
  if (input.isDemoMode) return null
  if (!input.hasValidSession) return null
  if (input.pathname === "/") return null
  if (NO_REDIRECT_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) return null
  if (COMMERCE_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) return null

  // If a user is on a workspace page without a site, bounce them to the picker.
  // We NEVER default to /create-site or /buyer from a workspace page.
  if (!input.hasRealCurrentSite) return "/projects"
  return null
}

export type UnauthorizedSitesLoadAction = "retry" | "finish" | "wait-for-session"

/**
 * After GET /api/sites 401: retry while a local session exists (cookie race),
 * then finish the load so the wrapper can bounce to /projects.
 */
export function unauthorizedSitesLoadAction(input: {
  hasLocalUser: boolean
  retriesSoFar: number
  maxRetries?: number
}): UnauthorizedSitesLoadAction {
  const maxRetries = input.maxRetries ?? 2
  if (input.hasLocalUser && input.retriesSoFar < maxRetries) return "retry"
  if (input.hasLocalUser) return "finish"
  return "wait-for-session"
}

/** Public storefronts should drop the demo cookie; /buyer must keep it. */
export function shouldClearDemoCookieOnPath(pathname: string): boolean {
  if (pathname.startsWith("/buyer")) return false
  return (
    pathname.startsWith("/shop") ||
    pathname.startsWith("/marketplace") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/q/") ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/so/") ||
    pathname.startsWith("/vb/")
  )
}

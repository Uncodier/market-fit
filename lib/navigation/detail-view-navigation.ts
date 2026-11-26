export const DETAIL_VIEW_PARAM = "detailView"
export const DETAIL_VIEW_LEAVE_EVENT = "workspace:detail-view-leave"
const STORAGE_KEY = "workspace:detail-view-navigation"
const ROUTE = /^\/(?:agents(?:\/tools)?|applications\/repositories|bills|campaigns|catalog(?:\/modifier-groups)?|companies|connectors|content|control-center|deals|experiments|inventory\/(?:minimums|movements)|leads|orders|price-lists|promotions|purchases\/(?:quotes|requests|tenders)|quotations|requirements|sales|segments|shipments|subscriptions|suppliers|transactions)\/(?!new$)[a-zA-Z0-9_-]+$/

type Snapshot = { key: string; siteId: string; paths: string[] }

export function isDetailViewRoute(pathname: string) {
  return ROUTE.test(pathname)
}

function readSnapshots(): Snapshot[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(value) ? value.filter(entry => entry && typeof entry.key === "string" &&
      typeof entry.siteId === "string" && Array.isArray(entry.paths) && entry.paths.every((path: unknown) => typeof path === "string")) : []
  } catch {
    return []
  }
}

function withView(href: string, key: string) {
  const url = new URL(href, "https://workspace.invalid")
  url.searchParams.set(DETAIL_VIEW_PARAM, key)
  return `${url.pathname}${url.search}${url.hash}`
}

export function openDetailFromView(siteId: string | undefined, href: string, orderedPaths: string[]) {
  const pathname = href.split(/[?#]/)[0]
  if (!siteId || !ROUTE.test(pathname)) return href
  const parent = pathname.slice(0, pathname.lastIndexOf("/"))
  const paths = [...new Set(orderedPaths.filter(path => ROUTE.test(path) && path.slice(0, path.lastIndexOf("/")) === parent))]
  if (paths.length < 2 || !paths.includes(pathname)) return href

  try {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("")
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([{ key, siteId, paths }, ...readSnapshots()].slice(0, 5)))
    return withView(href, key)
  } catch {
    return href
  }
}

export function detailViewHref(siteId: string | undefined, base: string, id: string, rows: readonly { id: string }[]) {
  return openDetailFromView(siteId, `${base}/${encodeURIComponent(id)}`, rows.map(row => `${base}/${encodeURIComponent(row.id)}`))
}

export function getDetailViewNeighbors(siteId: string, pathname: string, key: string) {
  if (!ROUTE.test(pathname)) return null
  const snapshot = readSnapshots().find(entry => entry.key === key && entry.siteId === siteId)
  const index = snapshot?.paths.indexOf(pathname) ?? -1
  if (!snapshot || index === -1) return null
  const sameCollection = (path: string | undefined) => typeof path === "string" && ROUTE.test(path) &&
    path.slice(0, path.lastIndexOf("/")) === pathname.slice(0, pathname.lastIndexOf("/"))
  const previous = snapshot.paths[index - 1]
  const next = snapshot.paths[index + 1]
  return { previous: sameCollection(previous) ? withView(previous, key) : null,
    next: sameCollection(next) ? withView(next, key) : null }
}
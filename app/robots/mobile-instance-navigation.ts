import { resolveInstanceIdParam } from "@/lib/navigation/robots-instance"

/** Explicit list navigation does not change the default auto-selected workspace. */
export function isInstanceListView(params: { get: (key: string) => string | null }) {
  return params.get("view") === "instances" && params.get("artifact") !== "true"
}

export function mobileInstanceListHref(search: string) {
  const source = new URLSearchParams(search)
  const params = new URLSearchParams()
  const mode = source.get("mode")
  for (const value of source.getAll('connector')) params.append('connector', value)
  if (mode === "workflow" || mode === "imprenta") params.set("mode", mode)
  params.set("view", "instances")
  return `/robots?${params}`
}

export function mobileInstanceDetailHref(search: string, id: string, name?: string) {
  const params = new URLSearchParams(search)
  for (const key of ["view", "instance_id", "instanceId", "artifact", "screen", "tab", "new", "query", "name"]) {
    params.delete(key)
  }
  params.set("instance", id)
  if (name) params.set("name", name)
  return `/robots?${params}`
}

export function shouldCanonicalizeMobileInstance(search: string, selectedId: string) {
  const params = new URLSearchParams(search)
  return !isInstanceListView(params) && params.get("artifact") !== "true" &&
    !resolveInstanceIdParam(params) && selectedId !== "new"
}

/** An agent breadcrumb root opens the list on mobile and a blank session on desktop. */
export function robotsBreadcrumbHref(target: string, current: string, isMobile: boolean) {
  const [currentPath, currentSearch] = current.split("?")
  const [targetPath, targetSearch] = target.split("?")
  const currentParams = new URLSearchParams(currentSearch)
  const targetParams = new URLSearchParams(targetSearch)
  if (!(currentPath === "/robots" || currentPath.startsWith("/robots/")) ||
    targetPath !== "/robots" || resolveInstanceIdParam(targetParams) ||
    currentParams.get("artifact") === "true" || targetParams.get("artifact") === "true") return target
  if (isInstanceListView(targetParams)) return target
  if (!isMobile) {
    const mode = targetParams.get("mode") ?? currentParams.get("mode")
    if (mode === "workflow" || mode === "imprenta") return target
    targetParams.set("instance", "new")
    return `/robots?${targetParams}`
  }
  return mobileInstanceListHref(targetParams.has("mode") ? targetParams.toString() : currentParams.toString())
}
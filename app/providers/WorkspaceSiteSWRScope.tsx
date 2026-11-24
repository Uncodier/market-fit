"use client"

import { useContext, useEffect, useRef, type ReactNode } from "react"
import { SWRConfig, unstable_serialize, useSWRConfig, type Middleware } from "swr"
import { useSite } from "@/app/context/SiteContext"
import { AuthContext } from "@/app/components/auth/auth-context"
import { isTerminalRequestError } from "@/lib/swr/retry-policy"
import { ConversationListReadScope, isConversationListKey } from './conversation-list-read-scope'

// Coordinate only a resumed read, within the SWR cache that owns it. No data,
// grants or settled promises are cached here; ordinary mutate() stays explicit.
const waking = new WeakMap<object, Set<string>>()
function wakeResource(cache: object, key: string, refresh: () => Promise<unknown>) {
  const pending = waking.get(cache) ?? new Set<string>()
  if (pending.has(key)) return
  waking.set(cache, pending)
  pending.add(key)
  const release = () => { pending.delete(key); if (!pending.size) waking.delete(cache) }
  void refresh().then(release, release)
}

const siteLoadingMiddleware: Middleware = next => (key, fetcher, config) => {
  const { isLoading: siteLoading, currentSite, requestScope } = useSite()
  const { cache } = useSWRConfig()
  const auth = useContext(AuthContext)
  const verified = useContext(ConversationListReadScope)
  const independent = verified && !auth?.isLoading && verified.actorId === auth?.user?.id &&
    verified.actorId === requestScope?.actorId && verified.siteId === requestScope.siteId &&
    isConversationListKey(key) && key[1] === verified.siteId && key[4] === verified.actorId
  const isLoading = siteLoading && !independent
  const scope = JSON.stringify([auth?.user?.id, currentSite?.id])
  const resource = unstable_serialize(key)
  // Never carry another resource or tenant's data through a key change.
  // Keep observing in-flight results (especially denials) while deferring new reads.
  const result = next(key, isLoading ? null : fetcher, { ...config, keepPreviousData: false })
  const { mutate } = result
  const previous = useRef<{ scope: string; resource: string; data: typeof result.data } | null>(null)
  const paused = useRef<{ resource: string; scope: string } | null>(null)
  useEffect(() => {
    const resume = !isLoading && paused.current?.resource === resource && paused.current.scope === scope
    paused.current = isLoading ? { resource, scope } : null
    // SWR already revalidates on a key change (including null -> key). Only a
    // previously subscribed, unchanged key needs a wakeup when its fetcher resumes.
    if (resume && resource && fetcher && !result.isValidating) {
      wakeResource(cache, JSON.stringify([scope, resource]), mutate)
    }
  }, [cache, isLoading, resource, scope, fetcher, mutate, result.isValidating])
  useEffect(() => {
    if (previous.current?.scope !== scope || previous.current?.resource !== resource ||
        isTerminalRequestError(result.error)) previous.current = null
    if (!isLoading && result.data !== undefined && !isTerminalRequestError(result.error)) {
      previous.current = { scope, resource, data: result.data }
    }
  }, [scope, resource, isLoading, result.data, result.error])
  if (isTerminalRequestError(result.error)) return { ...result, data: undefined, isLoading: false }
  if (!isLoading || !resource) return result
  const data = previous.current?.scope === scope && previous.current.resource === resource
    ? previous.current.data : undefined
  return { ...result, data, error: undefined, isLoading: data === undefined }
}

// Keep the shell mounted while deferring workspace reads, including child dialogs.
// Public storefronts and account-global providers remain outside this scope.
export function WorkspaceSiteSWRScope({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  // An account transition must retire both cached responses and mounted private
  // state. Ordinary refreshes keep this boundary and its cache intact.
  return <SWRConfig key={auth?.user?.id ?? "anonymous"}
    value={{ provider: () => new Map(), use: [siteLoadingMiddleware] }}>{children}</SWRConfig>
}
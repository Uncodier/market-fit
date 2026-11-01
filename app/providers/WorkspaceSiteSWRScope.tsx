"use client"

import { useContext, useEffect, useRef, type ReactNode } from "react"
import { SWRConfig, unstable_serialize, type Middleware } from "swr"
import { useSite } from "@/app/context/SiteContext"
import { AuthContext } from "@/app/components/auth/auth-context"
import { isTerminalRequestError } from "@/lib/swr/retry-policy"

const siteLoadingMiddleware: Middleware = next => (key, fetcher, config) => {
  const { isLoading, currentSite } = useSite()
  const auth = useContext(AuthContext)
  const scope = JSON.stringify([auth?.user?.id, currentSite?.id])
  const resource = unstable_serialize(key)
  // Never carry another resource or tenant's data through a key change.
  // Keep observing in-flight results (especially denials) while deferring new reads.
  const result = next(key, isLoading ? null : fetcher, { ...config, keepPreviousData: false })
  const { mutate } = result
  const previous = useRef<{ scope: string; resource: string; data: typeof result.data } | null>(null)
  const wasLoading = useRef(isLoading)
  useEffect(() => {
    const resume = wasLoading.current && !isLoading
    wasLoading.current = isLoading
    if (resume && resource && fetcher) void mutate()
  }, [isLoading, resource, fetcher, mutate])
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
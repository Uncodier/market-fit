"use client"

import type { ReactNode } from "react"
import { SWRConfig, type Middleware } from "swr"
import { useSite } from "@/app/context/SiteContext"

const siteLoadingMiddleware: Middleware = next => (key, fetcher, config) => {
  const { isLoading } = useSite()
  const result = next(isLoading ? null : key, fetcher, config)
  return isLoading && key
    ? { ...result, data: undefined, error: undefined, isLoading: true }
    : result
}

// Keep the shell mounted while deferring workspace reads, including child dialogs.
// Public storefronts and account-global providers remain outside this scope.
export function WorkspaceSiteSWRScope({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ use: [siteLoadingMiddleware] }}>{children}</SWRConfig>
}
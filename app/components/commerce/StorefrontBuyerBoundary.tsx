"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { scrubStorefrontCartPrices } from "./scrub-storefront-cart-prices"

/** Discard all client listing/PDP state when the verified account changes, not on token refresh. */
export function StorefrontBuyerBoundary({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthContext()
  const identity = `${user?.id || "guest"}:${user?.email || ""}`
  const [initial, setInitial] = useState<string | undefined>(isLoading ? undefined : identity)
  if (!isLoading && initial === undefined) setInitial(identity)
  const changed = !isLoading && initial !== undefined && initial !== identity
  useEffect(() => {
    if (changed) {
      scrubStorefrontCartPrices()
      window.location.reload()
    }
  }, [changed])
  // Do not expose another customer's prices during navigation.
  if (changed) return <div role="status" className="p-8">Refreshing prices…</div>
  return children
}
"use client"

import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  COMMERCE_LOCATION_CHANGE_EVENT,
  commerceSignInHref,
  commerceSignInHrefFromWindow,
} from "@/lib/auth/commerce-sign-in-href"

/** Current path+query as Sign In returnTo, including replaceState shop category. */
export function useCommerceSignInHref() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString()
  const fromRouter = commerceSignInHref(pathname, search ? `?${search}` : "")
  const [href, setHref] = useState(fromRouter)

  useEffect(() => {
    const sync = () => setHref(commerceSignInHrefFromWindow())
    sync()
    window.addEventListener("popstate", sync)
    window.addEventListener(COMMERCE_LOCATION_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener(COMMERCE_LOCATION_CHANGE_EVENT, sync)
    }
  }, [fromRouter])

  const onClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const live = commerceSignInHrefFromWindow()
    if (live === href) return
    event.preventDefault()
    window.location.assign(live)
  }, [href])

  return { href, onClick }
}

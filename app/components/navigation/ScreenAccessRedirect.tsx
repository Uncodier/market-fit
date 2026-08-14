"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"
import {
  firstAllowedNavHref,
  getNavKeyForPath,
  isAlwaysAllowedPath,
  isScreenBlocked,
} from "@/lib/auth/screen-access"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

export function ScreenAccessRedirect() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const access = useOptionalScreenAccess()

  useEffect(() => {
    if (!access?.isReady || access.isSiteAdmin) return
    if (isAlwaysAllowedPath(pathname)) return
    const navKey = getNavKeyForPath(pathname, new URLSearchParams(searchParams.toString()))
    if (!isScreenBlocked("collaborator", access.blockedScreens, navKey)) return
    const next = firstAllowedNavHref("collaborator", access.blockedScreens)
    if (next !== pathname) navigateOrAssign(router, next, { replace: true, markUI: false })
  }, [access, pathname, router, searchParams])

  return null
}

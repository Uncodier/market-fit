"use client"

import type { ComponentProps } from "react"
import { useRouter } from "next/navigation"
import { openDetailFromView } from "@/lib/navigation/detail-view-navigation"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import { NavigationLink } from "./NavigationLink"

export function DetailViewLink({ href, siteId, paths, ...props }: Omit<ComponentProps<typeof NavigationLink>, "href" | "onNavigate"> & {
  href: string
  siteId: string | undefined
  paths: () => string[]
}) {
  const router = useRouter()
  return <NavigationLink {...props} href={href} onNavigate={event => {
    const destination = openDetailFromView(siteId, href, paths())
    if (destination === href) return
    event.preventDefault()
    navigateOrAssign(router, destination)
  }} />
}
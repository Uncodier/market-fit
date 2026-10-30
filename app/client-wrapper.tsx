"use client"

import { lazy, Suspense, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import {
  shouldUseLayout,
  shouldWrapNoLayoutContentInMain,
} from "./config/routes"
import DemoBanner from "./components/DemoBanner"
import VersionCheck from "./components/VersionCheck"
import { rememberInternalPath } from "./documents/internal-back"
import { GuidedTour } from "./components/onboarding/GuidedTour"
import { PrivateTypography } from "./components/PrivateTypography"

// React Suspense retains SSR and route-scoped loading without next/dynamic's
// stale development react-loadable preloads for this shared workspace shell.
const LayoutClient = lazy(() => import("./layout-client"))
const ViewOnlyBanner = dynamic(
  () => import("./components/permissions/ViewOnlyBanner"),
  { ssr: false }
)

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const useLayout = shouldUseLayout(pathname)
  const wrapContentInMain = shouldWrapNoLayoutContentInMain(pathname)

  useEffect(() => {
    rememberInternalPath(pathname)
  }, [pathname])

  if (useLayout) {
    return (
      <PrivateTypography pathname={pathname}>
        <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
          <LayoutClient>
            {children}
            <DemoBanner />
            <ViewOnlyBanner />
            <VersionCheck />
          </LayoutClient>
        </Suspense>
      </PrivateTypography>
    )
  }

  return (
    <PrivateTypography pathname={pathname}>
      <GuidedTour />
      {wrapContentInMain ? <main>{children}</main> : children}
      <DemoBanner />
      <VersionCheck />
    </PrivateTypography>
  )
}

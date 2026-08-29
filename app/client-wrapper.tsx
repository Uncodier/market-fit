"use client"

import { Suspense, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { shouldUseLayout } from "./config/routes"
import DemoBanner from "./components/DemoBanner"
import VersionCheck from "./components/VersionCheck"
import { rememberInternalPath } from "./documents/internal-back"

const LayoutClient = dynamic(() => import("./layout-client"), { ssr: true })
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

  useEffect(() => {
    rememberInternalPath(pathname)
  }, [pathname])

  if (useLayout) {
    return (
      <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
        <LayoutClient>
          {children}
          <DemoBanner />
          <ViewOnlyBanner />
          <VersionCheck />
        </LayoutClient>
      </Suspense>
    )
  }

  return (
    <>
      {children}
      <DemoBanner />
      <VersionCheck />
    </>
  )
}

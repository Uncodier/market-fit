"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import LayoutClient from "./layout-client"
import { shouldUseLayout } from "./config/routes"
import DemoBanner from "./components/DemoBanner"
import { rememberInternalPath } from "./documents/internal-back"

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
      <LayoutClient>
        {children}
        <DemoBanner />
      </LayoutClient>
    )
  }

  return (
    <>
      {children}
      <DemoBanner />
    </>
  )
} 
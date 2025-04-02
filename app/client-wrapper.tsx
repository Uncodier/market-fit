"use client"

import { usePathname } from "next/navigation"
import LayoutClient from "./layout-client"
import { shouldUseLayout } from "./config/routes"

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const useLayout = shouldUseLayout(pathname)

  if (useLayout) {
    return <LayoutClient>{children}</LayoutClient>
  }

  return <>{children}</>
} 
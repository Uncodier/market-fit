import React from "react"
import Link from "next/link"
import Image from "next/image"

import { SiteHeader } from "@/app/components/navigation/SiteHeader"

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col dark:bg-black-paper bg-white-paper bg-white">
      <SiteHeader />
      
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}

"use client"

import React from "react"
import { BuyerShell } from "@/app/buyer/components/BuyerShell"

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <BuyerShell requireAuth>{children}</BuyerShell>
}

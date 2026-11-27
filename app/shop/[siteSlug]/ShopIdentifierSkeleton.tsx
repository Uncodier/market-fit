"use client"

import { useSelectedLayoutSegments } from "next/navigation"
import { PdpPageSkeleton } from "@/app/components/commerce/pdp/PdpPageSkeleton"
import { ShopHomeSkeleton } from "./ShopHomeSkeleton"

/** The layout shows this before it knows whether the identifier is a site or a location. */
export function ShopIdentifierSkeleton() {
  const [segment, child] = useSelectedLayoutSegments()
  if (!segment || segment === "(home)") return <ShopHomeSkeleton />
  if (!child && segment !== "privacy") return <PdpPageSkeleton />
  return null
}
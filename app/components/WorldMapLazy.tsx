"use client"

import dynamic from "next/dynamic"

const WorldMapLazy = dynamic(() => import("@/app/components/WorldMapComponent"), {
  ssr: false,
})

export default WorldMapLazy
export type { LocationData } from "@/app/components/WorldMapComponent"

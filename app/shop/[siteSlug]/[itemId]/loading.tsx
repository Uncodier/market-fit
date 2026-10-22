"use client"

import { PdpPageSkeleton } from "@/app/components/commerce/pdp/PdpPageSkeleton"
import { useOptionalSelfService } from "../self-service/SelfServiceProvider"

export default function ShopPdpLoading() {
  const selfService = useOptionalSelfService()
  if (selfService) return <div className="p-8" role="status">Loading product…</div>
  return <PdpPageSkeleton />
}

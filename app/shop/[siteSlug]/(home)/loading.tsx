"use client"

import { ShopHomeSkeleton } from "../ShopHomeSkeleton"
import { useOptionalSelfService } from "../self-service/SelfServiceProvider"

export default function ShopLoading() {
  const selfService = useOptionalSelfService()
  if (selfService) return <div className="p-8" role="status">Loading menu…</div>
  return <ShopHomeSkeleton />
}

"use client"

import { ShopHomeSkeleton } from "../ShopHomeSkeleton"
import { useOptionalSelfService } from "../self-service/SelfServiceProvider"
import { SelfServiceShopSkeleton } from "../self-service/SelfServiceShopSkeleton"

export default function ShopLoading() {
  const selfService = useOptionalSelfService()
  if (selfService) return <SelfServiceShopSkeleton />
  return <ShopHomeSkeleton />
}

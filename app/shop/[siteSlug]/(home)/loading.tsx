"use client"

import { ShopHomeSkeleton } from "../ShopHomeSkeleton"
import { useOptionalSelfService } from "../self-service/SelfServiceProvider"

export default function ShopLoading() {
  const selfService = useOptionalSelfService()
  return <ShopHomeSkeleton selfService={!!selfService} site={selfService?.context.site} />
}

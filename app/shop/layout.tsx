import type { ReactNode } from "react"
import { PublicImageLayout } from "@/app/components/commerce/PublicImageLayout"
import { StorefrontBuyerBoundary } from "@/app/components/commerce/StorefrontBuyerBoundary"

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <PublicImageLayout><StorefrontBuyerBoundary>{children}</StorefrontBuyerBoundary></PublicImageLayout>
}
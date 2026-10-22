import type { ReactNode } from "react"
import { getShopRouteContext } from "./shop-route-context"
import { SelfServiceProvider } from "./self-service/SelfServiceProvider"

export default async function ShopIdentifierLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = await params
  const context = await getShopRouteContext(siteSlug)
  if (!context?.selfService) return children
  return <SelfServiceProvider context={context.selfService}>{children}</SelfServiceProvider>
}
import { Suspense, type ReactNode } from "react"
import { getShopRouteContext } from "./shop-route-context"
import { SelfServiceProvider } from "./self-service/SelfServiceProvider"
import { ShopIdentifierSkeleton } from "./ShopIdentifierSkeleton"

type LayoutProps = {
  children: ReactNode
  params: Promise<{ siteSlug: string }>
}

export default function ShopIdentifierLayout(props: LayoutProps) {
  return (
    <Suspense fallback={<ShopIdentifierSkeleton />}>
      <ShopLocationSession {...props} />
    </Suspense>
  )
}

async function ShopLocationSession({ children, params }: LayoutProps) {
  const { siteSlug } = await params
  const context = await getShopRouteContext(siteSlug)
  if (!context?.selfService) return children
  return <SelfServiceProvider context={context.selfService}>{children}</SelfServiceProvider>
}
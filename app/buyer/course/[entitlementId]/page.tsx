import { getEntitlementById } from "@/app/buyer/entitlement-queries"
import { notFound } from "next/navigation"
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { CourseExperienceClient } from "./CourseExperienceClient"

export default async function BuyerCoursePage(props: {
  params: Promise<{ entitlementId: string }>
}) {
  const params = await props.params
  const entitlement = await getEntitlementById(params.entitlementId)

  if (!entitlement?.catalog_item_id) {
    return notFound()
  }

  const item =
    (await getPdpCatalogItem(entitlement.catalog_item_id, { siteId: entitlement.site_id })) ||
    entitlement.catalog_item

  if (item && entitlement.subscription?.catalog_item?.item_specs) {
    const parentSpecs = entitlement.subscription.catalog_item.item_specs
    if (parentSpecs.length > 0) {
      const childSlugs = new Set((item.item_specs || []).map((s: any) => s.category?.slug).filter(Boolean))
      const missingSpecs = parentSpecs.filter((s: any) => s.category?.slug && !childSlugs.has(s.category.slug))
      item.item_specs = [...(item.item_specs || []), ...missingSpecs]
    }
  }

  if (!item) return notFound()

  return (
    <CourseExperienceClient
      item={item}
      entitlement={entitlement}
      backUrl="/buyer/library?subtype=course"
    />
  )
}

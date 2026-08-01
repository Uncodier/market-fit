import { getEntitlementById } from "@/app/buyer/entitlement-queries"
import { notFound } from "next/navigation"
import { TicketPdpLayout } from "@/app/components/commerce/pdp/TicketPdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"

export default async function BuyerTicketPage(props: {
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

  const backUrl = "/buyer/library?subtype=ticket"
  const experience: PdpExperience = {
    kind: "entitlement",
    backUrl,
    entitlement,
  }

  return (
    <BuyerExperienceShell backUrl={backUrl}>
      <TicketPdpLayout item={item} backUrl={backUrl} experience={experience} />
    </BuyerExperienceShell>
  )
}

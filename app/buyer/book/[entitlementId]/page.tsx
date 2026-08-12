import { getEntitlementById } from "@/app/buyer/entitlement-queries"
import { notFound } from "next/navigation"
import { PassPdpLayout } from "@/app/components/commerce/pdp/PassPdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"
import { getPassRedeemableItems } from "@/app/catalog/pass-actions"
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"

export default async function BuyerBookPage(props: {
  params: Promise<{ entitlementId: string }>
  searchParams: Promise<{ serviceId?: string }>
}) {
  const params = await props.params
  const searchParams = await props.searchParams
  const entitlement = await getEntitlementById(params.entitlementId)

  if (!entitlement?.catalog_item_id) {
    return notFound()
  }

  const passItem =
    (await getPdpCatalogItem(entitlement.catalog_item_id, { siteId: entitlement.site_id })) ||
    entitlement.catalog_item

  if (passItem && entitlement.subscription?.catalog_item?.item_specs) {
    const parentSpecs = entitlement.subscription.catalog_item.item_specs
    if (parentSpecs.length > 0) {
      const childSlugs = new Set((passItem.item_specs || []).map((s: any) => s.category?.slug).filter(Boolean))
      const missingSpecs = parentSpecs.filter((s: any) => s.category?.slug && !childSlugs.has(s.category.slug))
      passItem.item_specs = [...(passItem.item_specs || []), ...missingSpecs]
    }
  }

  if (!passItem) return notFound()

  const ids = await getPassRedeemableItems(entitlement.catalog_item_id)
  const results = await Promise.all(
    ids.map((id: string) => getPdpCatalogItem(id, { siteId: entitlement.site_id }))
  )
  const loadedServices = results.filter(Boolean)

  const backUrl = "/buyer/library?subtype=pass"
  const experience: PdpExperience = {
    kind: "entitlement",
    backUrl,
    entitlement,
    extras: {
      services: loadedServices,
      initialServiceId: searchParams.serviceId,
    },
  }

  return (
    <BuyerExperienceShell backUrl={backUrl} variant="book">
      <PassPdpLayout item={passItem} backUrl={backUrl} experience={experience} />
    </BuyerExperienceShell>
  )
}

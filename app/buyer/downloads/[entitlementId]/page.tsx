import { getEntitlementById } from "@/app/buyer/entitlement-queries"
import { notFound } from "next/navigation"
import { DigitalPdpLayout } from "@/app/components/commerce/pdp/DigitalPdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import {
  listDownloadableFilesForBuyer,
  createDigitalFileDownloadUrl,
} from "@/app/catalog/digital-file-actions"

export default async function BuyerDownloadsPage(props: {
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

  const { data: files } = await listDownloadableFilesForBuyer(entitlement.catalog_item_id)
  const filesWithUrls = await Promise.all(
    (files || []).map(async (file: any) => {
      const { data: downloadUrl } = await createDigitalFileDownloadUrl(file.id)
      return { ...file, downloadUrl }
    })
  )

  const backUrl = "/buyer/library?subtype=file"
  const experience: PdpExperience = {
    kind: "entitlement",
    backUrl,
    entitlement,
    extras: { files: filesWithUrls },
  }

  return (
    <BuyerExperienceShell backUrl={backUrl}>
      <DigitalPdpLayout item={item} backUrl={backUrl} experience={experience} />
    </BuyerExperienceShell>
  )
}

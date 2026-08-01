import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { findOrCreateLead } from "@/app/leads/actions"
import { findOrCreateSegment } from "@/app/segments/actions"
import { findOrCreateCompany } from "@/app/companies/actions"
import { findOrCreateCampaign } from "@/app/campaigns/actions/campaigns/create"
import { findOrCreateCatalogCategory, findOrCreateCatalogItem } from "@/app/catalog/actions"
import { findOrCreateLocation } from "@/app/inventory/actions"
import { findOrCreateItemSpec } from "@/app/catalog/item-spec-actions"

export function isPendingCreate(value: RelationSelectValue): boolean {
  return value?.mode === "create"
}

export async function resolveRelationId(
  entity: "lead" | "segment" | "company" | "campaign" | "catalog_category" | "catalog_item" | "location" | "item_spec",
  value: RelationSelectValue,
  siteId: string,
  createDefaults?: Record<string, any>
): Promise<{ id: string | null; error: string | null }> {
  if (!value) {
    return { id: null, error: null }
  }

  if (value.mode === "existing") {
    return { id: value.id, error: null }
  }

  // mode === "create"
  const name = value.label.trim()
  if (!name) {
    return { id: null, error: "Name is required for creation" }
  }

  switch (entity) {
    case "lead":
      const leadRes = await findOrCreateLead(siteId, name)
      return { id: leadRes.lead?.id || null, error: leadRes.error || null }
      
    case "segment":
      const segmentRes = await findOrCreateSegment(siteId, name)
      return { id: segmentRes.segment?.id || null, error: segmentRes.error || null }
      
    case "company":
      // findOrCreateCompany today doesn't take siteId but it should probably if it's tenant-isolated,
      // currently it looks like findOrCreateCompany(name)
      const companyRes = await findOrCreateCompany(name)
      return { id: companyRes.company?.id || null, error: companyRes.error || null }
      
    case "campaign":
      const campaignRes = await findOrCreateCampaign(siteId, name)
      return { id: campaignRes.campaign?.id || null, error: campaignRes.error || null }
      
    case "catalog_category":
      const categoryRes = await findOrCreateCatalogCategory(siteId, name)
      return { id: categoryRes.category?.id || null, error: categoryRes.error || null }
      
    case "catalog_item":
      const itemRes = await findOrCreateCatalogItem(siteId, name, createDefaults)
      return { id: itemRes.item?.id || null, error: itemRes.error || null }
      
    case "location":
      const locationRes = await findOrCreateLocation(siteId, name)
      return { id: locationRes.location?.id || null, error: locationRes.error || null }

    case "item_spec":
      if (!createDefaults?.categoryId) {
        return { id: null, error: "categoryId is required for item_spec creation" };
      }
      const specRes = await findOrCreateItemSpec(siteId, createDefaults.categoryId, name)
      return { id: specRes.data?.id || null, error: specRes.error || null }
      
    default:
      return { id: null, error: `Unknown entity type: ${entity}` }
  }
}

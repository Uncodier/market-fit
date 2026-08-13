"use client"

import { Label } from "@/app/components/ui/label"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { CatalogItem, CatalogCategory, Location } from "@/app/types"
import { Lead } from "@/app/leads/types"
import { suggestExpenseCategory } from "@/app/accounting/expense-category"
import { useLocalization } from "@/app/context/LocalizationContext"

export type ExpenseFormDims = {
  campaignValue: RelationSelectValue
  locationValue: RelationSelectValue
  catalogItemValue: RelationSelectValue
  catalogCategoryValue: RelationSelectValue
  leadValue: RelationSelectValue
  category: string
}

type Props = {
  formData: ExpenseFormDims
  setFormData: React.Dispatch<React.SetStateAction<any>>
  campaigns: { id: string; title: string }[]
  locations: Location[]
  catalogItems: CatalogItem[]
  catalogCategories: CatalogCategory[]
  leads: Lead[]
  campaignPlaceholder?: string
  campaignEmpty?: string
}

function dimsFrom(
  next: Partial<ExpenseFormDims>,
  prev: ExpenseFormDims
) {
  const merged = { ...prev, ...next }
  return {
    catalogItemId: merged.catalogItemValue?.mode === 'existing' ? merged.catalogItemValue.id : (merged.catalogItemValue ? 'new' : null),
    catalogCategoryId: merged.catalogCategoryValue?.mode === 'existing' ? merged.catalogCategoryValue.id : (merged.catalogCategoryValue ? 'new' : null),
    leadId: merged.leadValue?.mode === 'existing' ? merged.leadValue.id : (merged.leadValue ? 'new' : null),
    campaignId: merged.campaignValue?.mode === 'existing' ? merged.campaignValue.id : (merged.campaignValue ? 'new' : null),
    locationId: merged.locationValue?.mode === 'existing' ? merged.locationValue.id : (merged.locationValue ? 'new' : null),
  }
}

function withSuggestedCategory(prev: ExpenseFormDims, patch: Partial<ExpenseFormDims>) {
  const next = { ...prev, ...patch }
  return {
    ...next,
    category: suggestExpenseCategory(dimsFrom(patch, prev)) || prev.category,
  }
}

export function ExpenseAttributionFields({
  formData,
  setFormData,
  campaigns,
  locations,
  catalogItems,
  catalogCategories,
  leads,
  campaignPlaceholder,
  campaignEmpty,
}: Props) {
  const { t } = useLocalization()

  return (
    <>
      <div className="text-xs font-semibold text-muted-foreground border-b pb-1">
        {t('expenses.field.attribution') || "Attribution (optional)"}
      </div>

      <div className="grid gap-2">
        <Label>{t('expenses.field.client') || "Client"}</Label>
        <RelationSelect
          options={leads.map(l => ({ id: l.id, label: l.name || l.email || l.id }))}
          value={formData.leadValue}
          onValueChange={(val) => setFormData((prev: ExpenseFormDims) => withSuggestedCategory(prev, { leadValue: val }))}
          placeholder={t('expenses.placeholder.client') || "Select client (optional)"}
          emptyMessage={t('expenses.empty.clients') || "No clients found"}
          allowCreate={false}
        />
      </div>

      <div className="grid gap-2">
        <Label>{t('expenses.field.catalogItem') || "Product / Service"}</Label>
        <RelationSelect
          options={catalogItems.map(i => ({ id: i.id, label: i.name }))}
          value={formData.catalogItemValue}
          onValueChange={(val) => {
            const item = val?.mode === 'existing' ? catalogItems.find(i => i.id === val.id) : null
            const cat = item?.category_id
              ? catalogCategories.find(c => c.id === item.category_id)
              : null
            setFormData((prev: ExpenseFormDims) => withSuggestedCategory(prev, {
              catalogItemValue: val,
              catalogCategoryValue: cat
                ? { mode: "existing", id: cat.id, label: cat.name }
                : prev.catalogCategoryValue,
            }))
          }}
          placeholder={t('expenses.placeholder.catalogItem') || "Select product or service (optional)"}
          emptyMessage={t('expenses.empty.items') || "No items found"}
          allowCreate={false}
        />
      </div>

      <div className="grid gap-2">
        <Label>{t('expenses.field.catalogCategory') || "Item Category"}</Label>
        <RelationSelect
          options={catalogCategories.map(c => ({ id: c.id, label: c.name }))}
          value={formData.catalogCategoryValue}
          onValueChange={(val) => setFormData((prev: ExpenseFormDims) => withSuggestedCategory(prev, { catalogCategoryValue: val }))}
          placeholder={t('expenses.placeholder.catalogCategory') || "Select category (optional)"}
          emptyMessage={t('expenses.empty.categories') || "No categories found"}
          allowCreate={false}
        />
      </div>

      <div className="grid gap-2">
        <Label>{t('expenses.field.campaign') || "Campaign"}</Label>
        <RelationSelect
          options={campaigns.map(c => ({ id: c.id, label: c.title }))}
          value={formData.campaignValue}
          onValueChange={(val) => setFormData((prev: ExpenseFormDims) => withSuggestedCategory(prev, { campaignValue: val }))}
          placeholder={campaignPlaceholder || t('expenses.placeholder.campaign') || "Select campaign (optional)"}
          emptyMessage={campaignEmpty || t('expenses.empty.campaign') || "No campaigns found"}
        />
      </div>

      {(locations.length > 1 || formData.locationValue) && (
        <div className="grid gap-2">
          <Label>{t('expenses.field.location') || "Location"}</Label>
          <RelationSelect
            options={locations.map(loc => ({ id: loc.id, label: loc.name }))}
            value={formData.locationValue}
            onValueChange={(val) => setFormData((prev: ExpenseFormDims) => withSuggestedCategory(prev, { locationValue: val }))}
            placeholder={t('expenses.placeholder.location') || "Select location (optional)"}
            emptyMessage={t('expenses.empty.locations') || "No locations found"}
          />
        </div>
      )}
    </>
  )
}

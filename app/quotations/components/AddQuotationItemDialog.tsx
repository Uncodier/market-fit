"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { addQuotationItem, getQuotation } from "../actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { CatalogItem } from "@/app/types"
import { hasDynamicQuoteFields, isDynamicPricedItem } from "@/app/catalog/dynamic-pricing"
import { DynamicQuoteFieldsModal } from "@/app/components/commerce/DynamicQuoteFieldsModal"
import { requestDynamicQuote } from "../dynamic-quote-actions"

interface AddQuotationItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotationId: string
  onSuccess?: () => void
}

type FormData = {
  catalog_item_value: RelationSelectValue
  quantity: string
  unitPrice: string
}

export function AddQuotationItemDialog({ open, onOpenChange, quotationId, onSuccess }: AddQuotationItemDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dynamicItem, setDynamicItem] = useState<CatalogItem | null>(null)
  const [dynamicLoading, setDynamicLoading] = useState(false)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      catalog_item_value: null,
      quantity: '1',
      unitPrice: '0'
    }
  })

  const catalogItemValue = watch('catalog_item_value')

  const { data: catalogData } = useSWR(
    open && currentSite ? ['catalog', currentSite.id, 'all'] : null,
    () => listCatalogItems({ siteId: currentSite!.id, pageSize: 100 })
  )

  const items = (catalogData?.data || []) as CatalogItem[]

  const handleItemSelect = (val: RelationSelectValue) => {
    setValue('catalog_item_value', val, { shouldValidate: true })
    if (val?.mode === 'existing') {
      const selected = items.find((i) => i.id === val.id)
      if (selected && hasDynamicQuoteFields(selected)) {
        setDynamicItem(selected)
        return
      }
      if (selected && selected.target_sale_price !== undefined && selected.target_sale_price !== null) {
        setValue('unitPrice', selected.target_sale_price.toString())
      }
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      const { id: resolvedCatalogItemId, error: catalogError } = await resolveRelationId(
        "catalog_item", 
        data.catalog_item_value, 
        currentSite.id
      )
      
      if (catalogError || !resolvedCatalogItemId) {
        throw new Error(`Catalog error: ${catalogError || 'Failed to select or create item'}`)
      }

      const selected = items.find((i) => i.id === resolvedCatalogItemId)
      if (selected && hasDynamicQuoteFields(selected)) {
        setDynamicItem(selected)
        setIsSubmitting(false)
        return
      }

      if (selected && isDynamicPricedItem(selected)) {
        const qRes = await getQuotation(quotationId)
        const leadId = qRes.data?.lead_id
        if (!leadId) throw new Error("Quotation lead missing")
        const res = await requestDynamicQuote({
          siteId: currentSite.id,
          catalogItemId: resolvedCatalogItemId,
          leadId,
          quantity: parseInt(data.quantity) || 1,
          fieldValues: {},
          quotationId,
          dealId: qRes.data?.deal_id || undefined,
        })
        if (res.error && !res.data?.quotationId) throw new Error(res.error)
        toast.success(t('quotations.dynamicQuote.requested') || 'Dynamic quote requested')
        reset()
        onSuccess?.()
        onOpenChange(false)
        return
      }

      const res = await addQuotationItem({
        quotationId,
        catalogItemId: resolvedCatalogItemId,
        name: data.catalog_item_value?.label || 'Item',
        quantity: parseInt(data.quantity) || 1,
        unitPrice: parseFloat(data.unitPrice) || 0,
      })

      if (res.error) throw new Error(res.error)

      toast.success(t('quotations.detail.itemAdded') || 'Item added successfully')
      reset()
      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <Dialog open={open && !dynamicItem} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('quotations.detail.addItem') || 'Add Item'}</DialogTitle>
          <DialogDescription>
            {t('quotations.detail.addItemDesc') || 'Select a catalog item to add to this quotation.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="catalog_item_value">{t('quotations.detail.table.item') || 'Item'}</Label>
            <RelationSelect 
              options={items.map((i) => ({ id: i.id, label: i.name }))}
              value={catalogItemValue} 
              onValueChange={handleItemSelect}
              placeholder={t('quotations.detail.selectItem') || 'Select or create item...'}
              emptyMessage="No items found"
            />
            {errors.catalog_item_value && <p className="text-xs text-red-500">Item is required</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">{t('quotations.detail.table.qty') || 'Quantity'}</Label>
              <Input 
                type="number" 
                id="quantity" 
                min="1"
                {...register("quantity", { required: true, min: 1 })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">{t('quotations.detail.table.price') || 'Unit Price'}</Label>
              <Input 
                type="number" 
                step="0.01" 
                id="unitPrice" 
                {...register("unitPrice", { required: true })} 
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="submit" disabled={isSubmitting || !catalogItemValue}>
              {isSubmitting ? (t('common.saving') || "Saving...") : (t('common.add') || "Add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DynamicQuoteFieldsModal
      item={dynamicItem}
      open={!!dynamicItem}
      onOpenChange={(o) => {
        if (!o) setDynamicItem(null)
      }}
      confirming={dynamicLoading}
      onConfirm={async ({ fieldValues, quantity }) => {
        if (!currentSite || !dynamicItem) return
        setDynamicLoading(true)
        try {
          const qRes = await getQuotation(quotationId)
          const leadId = qRes.data?.lead_id
          if (!leadId) throw new Error("Quotation lead missing")

          const res = await requestDynamicQuote({
            siteId: currentSite.id,
            catalogItemId: dynamicItem.id,
            leadId,
            quantity,
            fieldValues,
            quotationId,
            dealId: qRes.data?.deal_id || undefined,
          })
          if (res.error && !res.data?.quotationId) throw new Error(res.error)

          toast.success(t('quotations.dynamicQuote.requested') || 'Dynamic quote requested')
          setDynamicItem(null)
          reset()
          onSuccess?.()
          onOpenChange(false)
        } catch (err: any) {
          toast.error(err?.message || 'Failed to request quote')
        } finally {
          setDynamicLoading(false)
        }
      }}
    />
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createQuotationFromDeal } from "../actions"
import { createDeal } from "@/app/deals/actions"
import { findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"
import { BuyerUserEmailField, BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId, isPendingCreate } from "@/app/commerce/resolve-relation"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { addQuotationItem } from "../actions"
import { useRouter } from "next/navigation"

type FormData = {
  name: string
  lead_value: RelationSelectValue
  catalog_item_value: RelationSelectValue
  clientEmail: string
  amount: string
}

export function CreateQuotationDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [buyerUser, setBuyerUser] = useState<BuyerUser | null>(null)
  
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: '',
      lead_value: null,
      catalog_item_value: null,
      clientEmail: '',
      amount: ''
    }
  })

  const leadValue = watch("lead_value")
  const catalogItemValue = watch("catalog_item_value")
  const isCreateLead = isPendingCreate(leadValue)

  const { data: leadsData } = useSWR(
    open && currentSite ? ['leads', currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData } = useSWR(
    open && currentSite ? ['catalog', currentSite.id] : null,
    () => listCatalogItems({ siteId: currentSite!.id, pageSize: 100 })
  )

  const leadOptions = (leadsData?.leads || leadsData || []).map((l: any) => ({
    id: l.id,
    label: l.name || l.email
  }))

  const catalogOptions = (catalogData?.data || []).map((i: any) => ({
    id: i.id,
    label: i.name
  }))

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      let finalLeadId: string | null = null

      if (buyerUser) {
        const leadRes = await findOrCreateLeadForBuyer({
          siteId: currentSite.id,
          email: buyerUser.email,
          name: buyerUser.name,
          buyerUserId: buyerUser.buyerUserId || null,
        })
        if (leadRes.error || !leadRes.lead) {
          throw new Error(leadRes.error || 'Failed to create lead for quotation')
        }
        finalLeadId = leadRes.lead.id
      } else {
        if (!data.lead_value) {
          throw new Error(t('quotations.create.errors.clientNameRequired') || "Client name is required")
        }
        
        // If creating a new lead, we need to pass the email since findOrCreateLead doesn't take email directly.
        // We can just use the findOrCreateLeadForBuyer since it handles email and name
        if (isPendingCreate(data.lead_value)) {
          if (!data.clientEmail) throw new Error(t('quotations.create.errors.clientEmailRequired') || "Client email is required")
          const leadRes = await findOrCreateLeadForBuyer({
            siteId: currentSite.id,
            email: data.clientEmail,
            name: data.lead_value.label,
            buyerUserId: null,
          })
          if (leadRes.error || !leadRes.lead) {
            throw new Error(leadRes.error || 'Failed to create lead for quotation')
          }
          finalLeadId = leadRes.lead.id
        } else {
          // Use existing lead
          const { id, error } = await resolveRelationId("lead", data.lead_value, currentSite.id)
          if (error || !id) throw new Error(error || 'Failed to resolve lead')
          finalLeadId = id
        }
      }

      // 1. Create a deal first
      const dealRes = await createDeal({
        site_id: currentSite.id,
        name: data.name,
        amount: data.amount ? parseFloat(data.amount) : 0,
        stage: 'prospecting'
      })

      if (dealRes.error || !dealRes.deal) {
        throw new Error(dealRes.error || t('quotations.create.errorDeal') || 'Failed to create associated deal')
      }

      // 2. Create the quotation
      const quoteRes = await createQuotationFromDeal(currentSite.id, dealRes.deal.id, finalLeadId!)
      
      if (quoteRes.error || !quoteRes.data) {
        throw new Error(quoteRes.error || t('quotations.create.errorQuote') || 'Failed to create quotation')
      }

      // Add item if selected
      if (data.catalog_item_value) {
        const { id: catalogItemId, error: catalogError } = await resolveRelationId("catalog_item", data.catalog_item_value, currentSite.id)
        if (catalogItemId && !catalogError) {
          let unitPrice = 0
          if (data.catalog_item_value.mode === 'existing') {
            const selectedItem = catalogData?.data?.find(i => i.id === catalogItemId)
            if (selectedItem && selectedItem.base_price !== undefined) {
              unitPrice = selectedItem.base_price
            }
          }
          await addQuotationItem({
            quotationId: quoteRes.data.id,
            catalogItemId,
            name: data.catalog_item_value.label,
            quantity: 1,
            unitPrice: unitPrice
          })
        }
      }

      toast.success(t('quotations.create.success') || 'Quotation created successfully')
      reset()
      setBuyerUser(null)
      setOpen(false)
      router.push(`/quotations/${quoteRes.data.id}`)
    } catch (error: any) {
      toast.error(error.message || t('quotations.create.errorQuote') || 'Failed to create quotation')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('quotations.create.title') || 'Create New Quotation'}</DialogTitle>
          <DialogDescription>
            {t('quotations.create.desc') || 'This will create a new quotation and its associated deal.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <BuyerUserEmailField 
              value={buyerUser}
              onChange={setBuyerUser}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{t('quotations.create.fields.name') || 'Quotation / Project Name'}</Label>
            <Input 
              id="name" 
              placeholder={t('quotations.create.fields.namePlaceholder') || "e.g. Website Redesign"} 
              {...register("name", { required: t('quotations.create.errors.nameRequired') || "Name is required" })} 
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead_value">{t('quotations.create.fields.clientName') || 'Client Name'}</Label>
            <RelationSelect
              options={leadOptions}
              value={leadValue}
              onValueChange={(val) => setValue('lead_value', val, { shouldValidate: true })}
              placeholder={t('quotations.create.fields.clientNamePlaceholder') || "Select or create client..."}
              disabled={!!buyerUser}
              emptyMessage="No clients found"
            />
            {errors.lead_value && <p className="text-xs text-red-500">{(errors.lead_value as any).message}</p>}
          </div>

          {(!buyerUser && (isCreateLead || !leadValue)) && (
            <div className="space-y-2">
              <Label htmlFor="clientEmail">{t('quotations.create.fields.clientEmail') || 'Client Email'}</Label>
              <Input 
                id="clientEmail" 
                type="email"
                placeholder={t('quotations.create.fields.clientEmailPlaceholder') || "e.g. john@example.com"} 
                {...register("clientEmail", { required: (isCreateLead && !buyerUser) ? (t('quotations.create.errors.clientEmailRequired') || "Client email is required") : false })} 
                disabled={!!buyerUser}
              />
              {errors.clientEmail && <p className="text-xs text-red-500">{errors.clientEmail.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="catalog_item_value">{t('quotations.create.fields.item') || 'Product / Service (Optional)'}</Label>
            <RelationSelect
              options={catalogOptions}
              value={catalogItemValue}
              onValueChange={(val) => setValue('catalog_item_value', val, { shouldValidate: true })}
              placeholder={t('quotations.create.fields.itemPlaceholder') || "Select or create an item..."}
              emptyMessage="No items found"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t('quotations.create.fields.amount') || 'Estimated Amount (Optional)'}</Label>
            <Input 
              id="amount" 
              type="number"
              step="0.01"
              placeholder="0.00" 
              {...register("amount")} 
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (t('quotations.create.creating') || "Creating...") : (t('quotations.create.submit') || "Create Quotation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

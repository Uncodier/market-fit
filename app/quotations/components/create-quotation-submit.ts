import { CatalogItem } from "@/app/types"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId, isPendingCreate } from "@/app/commerce/resolve-relation"
import { findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"
import { BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { createDeal } from "@/app/deals/actions"
import {
  createQuotationFromDeal,
  addQuotationItem,
  updateQuotationBasics,
} from "../actions"
import { requestDynamicQuote } from "../dynamic-quote-actions"
import { isDynamicPricedItem } from "@/app/catalog/dynamic-pricing"
import { QuoteFieldDraft } from "./CreateQuotationQuoteStep"

export type CreateQuotationFormData = {
  name: string
  lead_value: RelationSelectValue
  clientEmail: string
  amount: string
}

export type CreateQuotationLine = {
  key: string
  value: RelationSelectValue
}

export async function resolveCreateQuotationLeadId(params: {
  siteId: string
  data: CreateQuotationFormData
  buyerUser: BuyerUser | null
  clientNameRequired: string
  clientEmailRequired: string
}): Promise<string> {
  const { siteId, data, buyerUser } = params

  if (buyerUser) {
    const leadRes = await findOrCreateLeadForBuyer({
      siteId,
      email: buyerUser.email,
      name: buyerUser.name,
      buyerUserId: buyerUser.buyerUserId || null,
    })
    if (leadRes.error || !leadRes.lead) {
      throw new Error(leadRes.error || "Failed to create lead for quotation")
    }
    return leadRes.lead.id
  }

  if (!data.lead_value) {
    throw new Error(params.clientNameRequired)
  }

  if (isPendingCreate(data.lead_value)) {
    if (!data.clientEmail) {
      throw new Error(params.clientEmailRequired)
    }
    const leadRes = await findOrCreateLeadForBuyer({
      siteId,
      email: data.clientEmail,
      name: data.lead_value.label,
      buyerUserId: null,
    })
    if (leadRes.error || !leadRes.lead) {
      throw new Error(leadRes.error || "Failed to create lead for quotation")
    }
    return leadRes.lead.id
  }

  const { id, error } = await resolveRelationId("lead", data.lead_value, siteId)
  if (error || !id) throw new Error(error || "Failed to resolve lead")
  return id
}

export async function submitCreateQuotation(params: {
  siteId: string
  data: CreateQuotationFormData
  buyerUser: BuyerUser | null
  lineItems: CreateQuotationLine[]
  catalogItems: CatalogItem[]
  fieldDrafts: Record<string, QuoteFieldDraft>
  messages: {
    clientNameRequired: string
    clientEmailRequired: string
    errorDeal: string
    errorQuote: string
  }
}): Promise<string> {
  const finalLeadId = await resolveCreateQuotationLeadId({
    siteId: params.siteId,
    data: params.data,
    buyerUser: params.buyerUser,
    clientNameRequired: params.messages.clientNameRequired,
    clientEmailRequired: params.messages.clientEmailRequired,
  })

  const dealRes = await createDeal({
    site_id: params.siteId,
    name: params.data.name,
    amount: params.data.amount ? parseFloat(params.data.amount) : 0,
    stage: "prospecting",
  })

  if (dealRes.error || !dealRes.deal) {
    throw new Error(dealRes.error || params.messages.errorDeal)
  }

  const quoteRes = await createQuotationFromDeal(
    params.siteId,
    dealRes.deal.id,
    finalLeadId
  )

  if (quoteRes.error || !quoteRes.data) {
    throw new Error(quoteRes.error || params.messages.errorQuote)
  }

  const quotationId = quoteRes.data.id

  for (const row of params.lineItems) {
    if (!row.value) continue

    const { id: catalogItemId, error: catalogError } = await resolveRelationId(
      "catalog_item",
      row.value,
      params.siteId
    )
    if (!catalogItemId || catalogError) continue

    const selectedItem = params.catalogItems.find((i) => i.id === catalogItemId)

    if (selectedItem && isDynamicPricedItem(selectedItem)) {
      const draft = params.fieldDrafts[row.key] || { values: {}, quantity: 1 }
      const res = await requestDynamicQuote({
        siteId: params.siteId,
        catalogItemId,
        leadId: finalLeadId,
        quantity: draft.quantity,
        fieldValues: draft.values,
        quotationId,
        dealId: dealRes.deal.id,
      })
      if (res.error && !res.data?.quotationId) throw new Error(res.error)
      continue
    }

    let unitPrice = 0
    if (row.value.mode === "existing" && selectedItem?.base_price !== undefined) {
      unitPrice = selectedItem.base_price
    } else if (selectedItem?.target_sale_price != null) {
      unitPrice = Number(selectedItem.target_sale_price)
    }

    await addQuotationItem({
      quotationId,
      catalogItemId,
      name: row.value.label,
      quantity: 1,
      unitPrice,
    })
  }

  return quotationId
}

export async function submitUpdateQuotation(params: {
  quotationId: string
  siteId: string
  data: CreateQuotationFormData
  buyerUser: BuyerUser | null
  messages: {
    clientNameRequired: string
    clientEmailRequired: string
    errorQuote: string
  }
}): Promise<void> {
  const finalLeadId = await resolveCreateQuotationLeadId({
    siteId: params.siteId,
    data: params.data,
    buyerUser: params.buyerUser,
    clientNameRequired: params.messages.clientNameRequired,
    clientEmailRequired: params.messages.clientEmailRequired,
  })

  const res = await updateQuotationBasics(params.quotationId, {
    leadId: finalLeadId,
    buyerUserId: params.buyerUser?.buyerUserId || null,
    dealName: params.data.name,
    dealAmount: params.data.amount ? parseFloat(params.data.amount) : 0,
  })

  if (res.error) {
    throw new Error(res.error || params.messages.errorQuote)
  }
}

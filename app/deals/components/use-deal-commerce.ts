"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Deal } from "@/app/deals/types"
import { createSale } from "@/app/sales/actions"
import { updateDeal } from "@/app/deals/actions"
import { createQuotationFromDeal } from "@/app/quotations/actions"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function useDealCommerce(deal: Deal, onUpdate: (deal: Deal) => void) {
  const router = useRouter()
  const [isCreatingSale, setIsCreatingSale] = useState(false)
  const [isCreatingQuote, setIsCreatingQuote] = useState(false)

  const handleCreateSale = async () => {
    setIsCreatingSale(true)
    try {
      const result = await createSale({
        siteId: deal.site_id,
        title: deal.name,
        amount: deal.amount || 0,
        amount_due: deal.amount || 0,
        status: "pending",
        source: "retail",
        saleDate: new Date().toISOString(),
      })

      if (result.error) {
        toast.error(result.error)
        return
      }
      if (!result.sale) return

      const updateResult = await updateDeal({
        id: deal.id,
        sales_order_id: result.sale.id,
      })
      if (updateResult.error) {
        toast.error(updateResult.error)
        return
      }
      if (updateResult.deal) {
        toast.success("Sales order created successfully")
        onUpdate(updateResult.deal)
      }
    } catch {
      toast.error("Failed to create sales order")
    } finally {
      setIsCreatingSale(false)
    }
  }

  const handleCreateQuotation = async () => {
    setIsCreatingQuote(true)
    try {
      const supabase = createClient()
      let leadId: string | null = deal.contacts?.find((contact) => contact.is_primary)?.lead_id
        || deal.contacts?.[0]?.lead_id
        || null

      if (!leadId && deal.company_id) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id")
          .eq("company_id", deal.company_id)
          .limit(1)
        if (leads && leads.length > 0) leadId = leads[0].id
      }

      if (!leadId) {
        toast.error("Add a contact to this deal before creating a quote.")
        return
      }

      const result = await createQuotationFromDeal(deal.site_id, deal.id, leadId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        toast.success("Quotation created successfully")
        router.push(`/quotations/${result.data.id}`)
      }
    } catch {
      toast.error("Failed to create quotation")
    } finally {
      setIsCreatingQuote(false)
    }
  }

  return {
    isCreatingSale,
    isCreatingQuote,
    handleCreateSale,
    handleCreateQuotation,
  }
}

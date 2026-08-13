"use client"

import { useState, useEffect } from "react"
import { Deal } from "@/app/deals/types"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { CreditCard, ExternalLink, FileText, Plus } from "@/app/components/ui/icons"
import { getSaleById } from "@/app/sales/actions"
import { Sale } from "@/app/types"
import { useRouter } from "next/navigation"
import { navigateToSale } from "@/app/hooks/use-navigation-history"
import { RegisterPaymentDialog } from "@/app/sales/components/RegisterPaymentDialog"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { formatDealCurrency } from "./deal-format"
import { useDealCommerce } from "./use-deal-commerce"

interface DealSalesOrderProps {
  deal: Deal
  onUpdate: (deal: Deal) => void
}

export function DealSalesOrder({ deal, onUpdate }: DealSalesOrderProps) {
  const router = useRouter()
  const commerce = useDealCommerce(deal, onUpdate)
  const [sale, setSale] = useState<Sale | null>(null)
  const [quotations, setQuotations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const promises: Promise<any>[] = [
        supabase.from("quotations").select("*").eq("deal_id", deal.id).order("created_at", { ascending: false }),
      ]
      if (deal.sales_order_id) {
        promises.push(getSaleById(deal.site_id, deal.sales_order_id))
      }
      const [quoteRes, saleRes] = await Promise.all(promises)
      if (!quoteRes.error && quoteRes.data) setQuotations(quoteRes.data)
      if (saleRes && saleRes.sale) setSale(saleRes.sale)
      else setSale(null)
    } catch (error) {
      console.error("Failed to load deal sales data", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [deal.sales_order_id, deal.site_id, deal.id])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between py-3 border-b border-border/40">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">Quotations</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => void commerce.handleCreateQuotation()}
            disabled={commerce.isCreatingQuote}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {commerce.isCreatingQuote ? "Creating..." : "Create Quote"}
          </Button>
        </div>
        {quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No quotations yet.</p>
        ) : (
          quotations.map((quote) => (
            <button
              key={quote.id}
              type="button"
              className="flex w-full items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-muted/40 -mx-1 px-1 rounded-md text-left"
              onClick={() => router.push(`/quotations/${quote.id}`)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">Quote {quote.id.substring(0, 8)}</span>
                  {deal.accepted_quotation_id === quote.id && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                      Accepted
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(quote.created_at), "MMM d, yyyy")}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-medium">{formatDealCurrency(quote.total, quote.currency) || "-"}</p>
                <p className="text-xs text-muted-foreground uppercase">{quote.status}</p>
              </div>
            </button>
          ))
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">Sales order</h3>
          {sale ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() =>
                navigateToSale({
                  saleId: sale.id,
                  saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
                  router,
                })
              }
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Order
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => void commerce.handleCreateSale()}
              disabled={commerce.isCreatingSale}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {commerce.isCreatingSale ? "Creating..." : "Create Sale"}
            </Button>
          )}
        </div>
        {sale ? (
          <div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/40">
              <span className="text-xs text-muted-foreground">Title</span>
              <span className="text-sm truncate ml-4">{sale.title}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/40">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant="outline" className="text-xs capitalize">
                {sale.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/40">
              <span className="text-xs text-muted-foreground">Amount</span>
              <span className="text-sm">{formatDealCurrency(sale.amount, sale.currency) || "-"}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-muted-foreground">Amount due</span>
              <span className={`text-sm font-medium ${sale.amount_due > 0 ? "text-red-500" : "text-green-600"}`}>
                {formatDealCurrency(sale.amount_due, sale.currency) || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Payments
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setIsPaymentOpen(true)}
                disabled={sale.amount_due <= 0}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Register Payment
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-3">No sales order yet.</p>
        )}
      </section>

      {sale && isPaymentOpen && (
        <RegisterPaymentDialog
          sale={sale}
          open={isPaymentOpen}
          onOpenChange={setIsPaymentOpen}
          onSuccess={() => {
            void loadData()
            setIsPaymentOpen(false)
          }}
        />
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Deal } from "@/app/deals/types"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ShoppingCart, CreditCard, ExternalLink, PlusCircle, FileText, DollarSign, Calendar } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { createSale, getSaleById } from "@/app/sales/actions"
import { updateDeal } from "@/app/deals/actions"
import { createQuotationFromDeal } from "@/app/quotations/actions"
import { Sale } from "@/app/types"
import { useRouter } from "next/navigation"
import { RegisterPaymentDialog } from "@/app/sales/components/RegisterPaymentDialog"
import { format } from "date-fns"

interface DealSalesOrderProps {
  deal: Deal
  onUpdate: (deal: Deal) => void
}

export function DealSalesOrder({ deal, onUpdate }: DealSalesOrderProps) {
  const router = useRouter()
  const [sale, setSale] = useState<Sale | null>(null)
  const [quotations, setQuotations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreatingSale, setIsCreatingSale] = useState(false)
  const [isCreatingQuote, setIsCreatingQuote] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const supabase = (await import("@/lib/supabase/client")).createClient()
      
      const promises: any[] = [
        supabase.from('quotations').select('*').eq('deal_id', deal.id).order('created_at', { ascending: false })
      ]

      if (deal.sales_order_id) {
        promises.push(getSaleById(deal.site_id, deal.sales_order_id))
      }

      const [quoteRes, saleRes] = await Promise.all(promises)
      
      if (!quoteRes.error && quoteRes.data) setQuotations(quoteRes.data)
      if (saleRes && saleRes.sale) setSale(saleRes.sale)

    } catch (e) {
      console.error("Failed to load deal sales data", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [deal.sales_order_id, deal.site_id, deal.id])

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
        saleDate: new Date().toISOString()
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.sale) {
        const updateResult = await updateDeal({
          id: deal.id,
          sales_order_id: result.sale.id
        })

        if (updateResult.error) {
          toast.error(updateResult.error)
        } else if (updateResult.deal) {
          toast.success("Sales order created successfully")
          onUpdate(updateResult.deal)
        }
      }
    } catch (e) {
      toast.error("Failed to create sales order")
    } finally {
      setIsCreatingSale(false)
    }
  }

  const handleCreateQuotation = async () => {
    setIsCreatingQuote(true)
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient()
      let leadId = null
      
      if (deal.company_id) {
        const { data: leads } = await supabase.from('leads').select('id').eq('company_id', deal.company_id).limit(1)
        if (leads && leads.length > 0) leadId = leads[0].id
      }
      
      if (!leadId) {
        toast.error("Please ensure the deal's company has at least one lead (contact) before creating a quote.")
        setIsCreatingQuote(false)
        return
      }

      const result = await createQuotationFromDeal(deal.site_id, deal.id, leadId)

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        toast.success("Quotation created successfully")
        router.push(`/quotations/${result.data.id}`)
      }
    } catch (e) {
      toast.error("Failed to create quotation")
    } finally {
      setIsCreatingQuote(false)
    }
  }

  const formatCurrency = (amount: number | string | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined || amount === "") return "-"
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(numAmount)) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numAmount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set"
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-8 animate-pulse">
        <div className="h-64 bg-muted/20 rounded-xl border"></div>
        <div className="h-64 bg-muted/20 rounded-xl border"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-12">
      {/* Quotations Card */}
      <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" /> Quotations
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleCreateQuotation} disabled={isCreatingQuote}>
            <PlusCircle className="mr-2 h-4 w-4" /> {isCreatingQuote ? "Creating..." : "Create Quote"}
          </Button>
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-8">
          {quotations.length === 0 ? (
            <EmptyCard
              variant="fancy"
              icon={<FileText />}
              title="No Quotations"
              description="Create a quotation to send pricing details to your prospect."
              className="min-h-[200px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          ) : (
            <div className="space-y-3">
              {quotations.map(q => (
                <div 
                  key={q.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer ${deal.accepted_quotation_id === q.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : ''}`}
                  onClick={() => router.push(`/quotations/${q.id}`)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold flex items-center gap-2">
                      Quote {q.id.substring(0, 8)}
                      {deal.accepted_quotation_id === q.id && <Badge variant="default" className="text-[10px]">Accepted</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(q.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="font-bold">{formatCurrency(q.total, q.currency)}</div>
                    <Badge variant="outline" className="text-xs uppercase">{q.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Order Card */}
      <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Sales Order
          </CardTitle>
          {sale ? (
            <Button variant="outline" size="sm" onClick={() => router.push(`/sales/${sale.id}`)}>
              <ExternalLink className="mr-2 h-4 w-4" /> View Order
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleCreateSale} disabled={isCreatingSale}>
              <PlusCircle className="mr-2 h-4 w-4" /> {isCreatingSale ? "Creating..." : "Create Sales Order"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-8">
          {sale ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Title</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-12 text-base bg-muted/10 border-transparent focus-visible:ring-0 cursor-default"
                    value={sale.title}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Status</label>
                <div className="relative flex items-center h-12 px-4 rounded-md bg-muted/10">
                  <Badge 
                    variant="outline" 
                    className={
                      sale.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200 px-3 py-1 text-sm' :
                      sale.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 px-3 py-1 text-sm' :
                      sale.status === 'refunded' ? 'bg-purple-100 text-purple-800 border-purple-200 px-3 py-1 text-sm' :
                      'bg-red-100 text-red-800 border-red-200 px-3 py-1 text-sm'
                    }
                  >
                    {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-12 text-base bg-muted/10 border-transparent focus-visible:ring-0 cursor-default"
                    value={formatCurrency(sale.amount, sale.currency)}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Amount Due</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className={`pl-12 h-12 text-base bg-muted/10 border-transparent focus-visible:ring-0 cursor-default font-semibold ${sale.amount_due > 0 ? "text-red-500" : "text-green-500"}`}
                    value={formatCurrency(sale.amount_due, sale.currency)}
                    readOnly
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyCard
              variant="fancy"
              icon={<ShoppingCart />}
              title="No Sales Order"
              description="Create a sales order for this deal to track revenue, products and payments."
              className="min-h-[200px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Sales Payments Card */}
      {sale && (
        <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Sales Payments
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsPaymentOpen(true)} disabled={sale.amount_due <= 0}>
              <PlusCircle className="mr-2 h-4 w-4" /> Register Payment
            </Button>
          </CardHeader>
        </Card>
      )}

      {sale && isPaymentOpen && (
        <RegisterPaymentDialog
          sale={sale}
          open={isPaymentOpen}
          onOpenChange={setIsPaymentOpen}
          onSuccess={() => {
            loadData()
            setIsPaymentOpen(false)
          }}
        />
      )}
    </div>
  )
}

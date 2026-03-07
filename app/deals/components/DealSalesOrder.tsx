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
import { Sale } from "@/app/types"
import { useRouter } from "next/navigation"
import { RegisterPaymentDialog } from "@/app/sales/components/RegisterPaymentDialog"

interface DealSalesOrderProps {
  deal: Deal
  onUpdate: (deal: Deal) => void
}

export function DealSalesOrder({ deal, onUpdate }: DealSalesOrderProps) {
  const router = useRouter()
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const loadSale = async () => {
    if (!deal.sales_order_id) {
      setSale(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await getSaleById(deal.site_id, deal.sales_order_id)
      if (result.sale) {
        setSale(result.sale)
      } else {
        setSale(null)
      }
    } catch (e) {
      console.error("Failed to load sale", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSale()
  }, [deal.sales_order_id, deal.site_id])

  const handleCreateSale = async () => {
    setIsCreating(true)
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
        // Link sale to deal
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
      setIsCreating(false)
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

  const formatPaymentMethod = (method: string) => {
    return method
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
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
            <Button variant="outline" size="sm" onClick={handleCreateSale} disabled={isCreating}>
              <PlusCircle className="mr-2 h-4 w-4" /> {isCreating ? "Creating..." : "Create Sales Order"}
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

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-12 text-base bg-muted/10 border-transparent focus-visible:ring-0 cursor-default"
                    value={formatDate(sale.saleDate)}
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
              className="min-h-[300px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Sales Payments Card */}
      <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Sales Payments
          </CardTitle>
          {sale && (
            <Button variant="outline" size="sm" onClick={() => setIsPaymentOpen(true)} disabled={sale.amount_due <= 0}>
              <PlusCircle className="mr-2 h-4 w-4" /> Register Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-8">
          {!sale ? (
            <EmptyCard
              variant="fancy"
              icon={<CreditCard />}
              title="No Sales Order"
              description="You need a sales order before you can track payments."
              className="min-h-[300px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          ) : sale.payments && sale.payments.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-6 py-4 text-sm font-semibold text-left">Date</th>
                    <th className="px-6 py-4 text-sm font-semibold text-left">Amount</th>
                    <th className="px-6 py-4 text-sm font-semibold text-left">Method</th>
                    <th className="px-6 py-4 text-sm font-semibold text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.payments.map((payment, index) => (
                    <tr key={payment.id || index} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">{formatDate(payment.date)}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-semibold">{formatCurrency(payment.amount, sale.currency)}</td>
                      <td className="px-6 py-4 text-sm">{formatPaymentMethod(payment.method)}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{payment.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCard
              variant="fancy"
              icon={<CreditCard />}
              title="No Payments"
              description="No payments have been registered for this sales order yet."
              className="min-h-[300px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          )}
        </CardContent>
      </Card>

      <RegisterPaymentDialog 
        sale={sale} 
        open={isPaymentOpen} 
        onOpenChange={setIsPaymentOpen} 
        onSuccess={() => loadSale()} 
      />
    </div>
  )
}

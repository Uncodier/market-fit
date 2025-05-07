import React, { useState, useEffect } from "react"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Send, Printer, CreditCard, ShoppingCart } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { format } from "date-fns"
import { toast } from "sonner"
import { Sale } from "@/app/types"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { getSales } from "@/app/sales/actions"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"

// Status styles for sales
const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200"
}

interface SalesViewProps {
  leadId: string
}

export function SalesView({ leadId }: SalesViewProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const { currentSite } = useSite()
  const router = useRouter()

  // Load sales
  useEffect(() => {
    const loadSales = async () => {
      if (!currentSite?.id || !leadId) return

      setLoading(true)
      try {
        // Try to use the action to get sales data
        const result = await getSales(currentSite.id)
        
        if (result.error || !result.sales) {
          // If no sales or error, use Supabase directly as fallback
          const supabase = createClient()
          
          const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('lead_id', leadId)
            .order('sale_date', { ascending: false })
          
          if (error || !data || data.length === 0) {
            // No data found
            setSales([])
          } else {
            // Format the supabase data
            const formattedSales = data.map((item: any) => ({
              id: item.id,
              title: item.title || 'Unnamed Sale',
              productName: item.product_name || '',
              productType: item.product_type || '',
              amount: item.amount || 0,
              amount_due: item.amount_due || 0,
              currency: item.currency || 'USD',
              status: item.status || 'pending',
              source: item.source || 'online',
              saleDate: item.sale_date,
              leadId: item.lead_id,
              leadName: item.lead_name || 'Client',
              campaignId: item.campaign_id,
              segmentId: item.segment_id,
              paymentMethod: item.payment_method,
              paymentDetails: null,
              channel: item.channel || '',
              notes: item.notes || '',
              tags: item.tags || [],
              siteId: item.site_id,
              userId: item.user_id,
              createdAt: item.created_at,
              updatedAt: item.updated_at
            }))
            
            setSales(formattedSales)
          }
        } else {
          // Filter sales by leadId
          const filteredSales = result.sales.filter(sale => sale.leadId === leadId)
          if (filteredSales.length === 0) {
            setSales([])
          } else {
            setSales(filteredSales)
          }
        }
        
        setLoading(false)
      } catch (error) {
        console.error("Error loading sales:", error)
        toast.error("Failed to load sales")
        setSales([])
        setLoading(false)
      }
    }

    loadSales()
  }, [leadId, currentSite?.id])

  // Function to format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'MMM d, yyyy')
    } catch (error) {
      return dateString
    }
  }

  // View sale handler - Navigate to sale detail page
  const handleViewSale = (sale: Sale) => {
    router.push(`/sales/${sale.id}`)
  }

  // Register payment handler
  const handleRegisterPayment = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/sales/${sale.id}?action=payment`)
  }

  // Send sale handler
  const handleSendSale = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/sales/${sale.id}?action=send`)
  }

  // Print sale handler
  const handlePrintSale = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/sales/${sale.id}?action=print`)
  }

  // Calculate totals
  const totalAmount = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0)
  const totalAmountDue = sales.reduce((sum, sale) => sum + (sale.amount_due || 0), 0)

  // Show empty state if no sales and not loading
  if (!loading && sales.length === 0) {
    return (
      <EmptyCard
        title="No Sales Found"
        description="This lead doesn't have any sales yet."
        icon={<ShoppingCart className="h-12 w-12 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className="w-full">
      {/* Sales table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead className="w-[250px]">Product</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Skeleton loader
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : sales.length > 0 ? (
              // Sales data
              sales.map((sale) => (
                <TableRow 
                  key={sale.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleViewSale(sale)}
                >
                  <TableCell className="font-medium">
                    {formatDate(sale.saleDate)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">{String(sale.title || '')}</p>
                      <p className="text-xs text-muted-foreground">{String(sale.productName || '')}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(sale.amount)}
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {formatCurrency(sale.amount_due)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_STYLES[sale.status]}`}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {sale.amount_due > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleRegisterPayment(sale, e)}
                        >
                          <CreditCard className="h-4 w-4" />
                          <span className="sr-only">Register Payment</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleSendSale(sale, e)}
                      >
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Send</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handlePrintSale(sale, e)}
                      >
                        <Printer className="h-4 w-4" />
                        <span className="sr-only">Print</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              // This should never show as we use EmptyCard above, but keeping as fallback
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No sales found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {sales.length > 0 && (
            <tfoot className="border-t">
              <tr>
                <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                <TableCell className="font-semibold">{formatCurrency(totalAmount)}</TableCell>
                <TableCell className="font-semibold text-primary">{formatCurrency(totalAmountDue)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>
    </div>
  )
} 
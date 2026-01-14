"use client"

import { useSite } from "@/app/context/SiteContext"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Download, FileText } from "../ui/icons"
import { Button } from "../ui/button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { EmptyState } from "../ui/empty-state"

export interface PaymentTransaction {
  id: string
  transaction_id: string
  transaction_type: 'subscription' | 'credit_purchase' | 'refund'
  amount: number
  status: 'success' | 'pending' | 'failed'
  details?: any
  credits?: number
  invoice_url?: string
  created_at: string
}

interface PaymentHistoryProps {
  className?: string
}

export function PaymentHistory({ className }: PaymentHistoryProps) {
  const { currentSite } = useSite()
  const [isDownloading, setIsDownloading] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false)
  const [lastLoadedSiteId, setLastLoadedSiteId] = useState<string | null>(null)
  
  // Función para cargar el historial de pagos
  const loadPaymentHistory = async () => {
    if (!currentSite) return
    
    // Avoid loading if we've already loaded for this site
    if (lastLoadedSiteId === currentSite.id && paymentHistory.length > 0) {
      setIsLoading(false)
      return
    }
    
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Consultamos directamente la tabla
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('site_id', currentSite.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error("Error fetching payments:", error)
        // Si hay error, mostrar lista vacía
        setPaymentHistory([])
      } else if (!data || data.length === 0) {
        // Si no hay datos, mostrar lista vacía
        console.log("No payment history found")
        setPaymentHistory([])
      } else {
        // Mapear los datos de la base de datos al formato esperado
        const formattedData: PaymentTransaction[] = data.map((payment: any) => ({
          id: payment.id,
          transaction_id: payment.transaction_id || `tx_${payment.id.substring(0, 8)}`,
          transaction_type: payment.transaction_type,
          amount: payment.amount,
          status: payment.status,
          details: payment.details || { description: getDefaultDescription({ transaction_type: payment.transaction_type } as PaymentTransaction) },
          credits: payment.credits,
          invoice_url: payment.invoice_url,
          created_at: payment.created_at
        }))
        
        setPaymentHistory(formattedData)
        console.log("Loaded payment history:", formattedData.length)
      }
      
      // Update the last loaded site ID
      setLastLoadedSiteId(currentSite.id)
    } catch (error) {
      console.error("Error loading payment history:", error)
      toast.error("Failed to load payment history")
      // On error, show empty list
      setPaymentHistory([])
    } finally {
      setIsLoading(false)
    }
  }
  
  // Load payment history from database only when site actually changes
  useEffect(() => {
    if (!currentSite) {
      setIsLoading(false)
      return
    }
    
    // Only load if site ID has actually changed
    if (currentSite.id !== lastLoadedSiteId) {
      loadPaymentHistory()
    } else {
      setIsLoading(false)
    }
  }, [currentSite?.id]) // Only depend on the site ID, not the entire currentSite object
  
  // Format date as "Month Day, Year"
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }
  
  const handleDownloadInvoice = async (transaction: PaymentTransaction) => {
    setIsDownloading(true)
    
    try {
      // Check if there's an actual invoice URL
      if (transaction.invoice_url) {
        window.open(transaction.invoice_url, '_blank')
        toast.success('Invoice opened in new tab')
      } else {
        // Try to resolve URL from Stripe using stored details
        const stripeInvoiceId = transaction.details?.stripe_invoice_id
        const stripePaymentIntentId = transaction.details?.stripe_payment_intent_id

        if (!stripeInvoiceId && !stripePaymentIntentId) {
          toast.error('No Stripe reference to fetch invoice')
          return
        }

        const response = await fetch('/api/stripe/invoice-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripe_invoice_id: stripeInvoiceId,
            stripe_payment_intent_id: stripePaymentIntentId
          })
        })

        const data = await response.json()
        if (!response.ok || !data?.url) {
          toast.error(data?.error || 'Invoice not available yet')
          return
        }

        window.open(data.url, '_blank')
        toast.success('Invoice opened in new tab')
      }
    } catch (error) {
      toast.error('Failed to download invoice')
    } finally {
      setIsDownloading(false)
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'subscription': return 'Subscription'
      case 'credit_purchase': return 'Credit Purchase'
      case 'refund': return 'Refund'
      default: return type
    }
  }

  // Function to refresh payment history manually
  const refreshPaymentHistory = async () => {
    if (!currentSite) return
    
    // Reset cache and reload
    setLastLoadedSiteId(null)
    await loadPaymentHistory()
  }

  // Función para generar datos de prueba
  const generateTestData = async () => {
    if (!currentSite) return
    
    try {
      setIsGeneratingTestData(true)
      const supabase = createClient()
      
      // Llamar a la función RPC para generar datos de prueba
      const { data, error } = await supabase.rpc('generate_test_payment_history', {
        site_id: currentSite.id
      })
      
      if (error) {
        console.error("Error generating test data:", error)
        toast.error("Could not generate test data")
        return
      }
      
      toast.success("Test payment history generated successfully")
      
      // Recargar los datos forzando un refresh
      await refreshPaymentHistory()
    } catch (error) {
      console.error("Error generating test data:", error)
      toast.error("Failed to generate test data")
    } finally {
      setIsGeneratingTestData(false)
    }
  }

  return (
    <div className={className}>
      {isLoading ? (
        <Card className="border border-border shadow-sm">
          <CardHeader className="px-8 py-6">
            <CardTitle className="text-xl font-semibold">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                View your payment history and download invoices for your records.
              </p>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading payment history...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : paymentHistory.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-primary" />}
          title="No payment history"
          description="You haven't made any payments yet. Once you make a purchase, your payment history will appear here."
          className="h-[600px]"
        />
      ) : (
        <Card id="payment-history" className="border border-border shadow-sm">
          <CardHeader className="px-8 py-6">
            <CardTitle className="text-xl font-semibold">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                View your payment history and download invoices for your records.
              </p>
              <div className="mt-6 overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Amount</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Details</th>
                      <th className="px-4 py-3 text-right font-medium">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paymentHistory.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">{formatDate(transaction.created_at)}</td>
                        <td className="px-4 py-3">{getTypeLabel(transaction.transaction_type)}</td>
                        <td className="px-4 py-3">${transaction.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge className={`${getStatusColor(transaction.status)}`}>
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {transaction.details?.description || getDefaultDescription(transaction)}
                          {transaction.credits && ` (${transaction.credits} credits)`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={isDownloading}
                            onClick={() => handleDownloadInvoice(transaction)}
                          >
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Download Invoice</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper functions
function getDefaultDescription(transaction: PaymentTransaction) {
  switch (transaction.transaction_type) {
    case 'subscription': return 'Subscription Payment'
    case 'credit_purchase': return 'Credit Purchase'
    case 'refund': return 'Refund'
    default: return 'Transaction'
  }
} 
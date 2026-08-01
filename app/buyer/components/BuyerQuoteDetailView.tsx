"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getQuotation } from "@/app/quotations/actions"
import { acceptQuotation } from "@/app/quotations/buyer-actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { FileText, CheckCircle2, ChevronLeft, CreditCard } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"

export interface BuyerQuoteDetailViewProps {
  quoteId: string
  backHref?: string
  returnUrl?: string
  defaultOwnerSiteId?: string | null
  lockDestination?: boolean
}

export function BuyerQuoteDetailView({ 
  quoteId, 
  backHref = "/buyer/quotes",
  returnUrl = "/buyer",
  defaultOwnerSiteId = null,
  lockDestination = false
}: BuyerQuoteDetailViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLocalization()
  const session = user ? { user } : null
  
  const [quotation, setQuotation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(defaultOwnerSiteId)

  const loadQuotation = async () => {
    setLoading(true)
    const res = await getQuotation(quoteId)
    if (res.error) {
      toast.error(res.error)
      router.push(backHref)
    } else {
      setQuotation(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadQuotation()
  }, [quoteId])

  const handleAccept = async () => {
    if (!quotation) return
    setAccepting(true)
    
    const res = await acceptQuotation(quotation.id, ownerSiteId)
    
    if (res.error) {
      toast.error(res.error)
      setAccepting(false)
    } else {
      // If amount > 0, redirect to stripe
      if (quotation.total > 0) {
        try {
          const stripeRes = await fetch('/api/stripe/checkout/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: res.orderId,
              siteId: quotation.site_id,
              returnUrl: window.location.origin + returnUrl
            })
          })
          const stripeData = await stripeRes.json()
          if (stripeData.url) {
            window.location.href = stripeData.url
            return
          } else {
            toast.error(stripeData.error || t('buyer.quotes.detail.paymentError') || "Failed to initiate payment")
          }
        } catch (e) {
          toast.error(t('buyer.quotes.detail.gatewayError') || "Failed to connect to payment gateway")
        }
      } else {
        toast.success(t('buyer.quotes.detail.accepted') || "Quotation accepted!")
        router.push(returnUrl)
      }
      setAccepting(false)
    }
  }

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  if (!quotation) return null

  const isExpired = quotation.valid_until && new Date(quotation.valid_until) < new Date()
  const canAccept = quotation.status === 'sent' && !isExpired

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <StickyHeader>
        <div className="flex w-full items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg leading-tight">{t('buyer.quotes.detail.quote') || 'Quote'} {quotation.id.substring(0,8)}</h1>
            <p className="text-xs text-muted-foreground">{t('buyer.quotes.detail.from') || 'From'} {quotation.site?.name}</p>
          </div>
          <Badge variant="outline" className="uppercase ml-auto">{quotation.status ? (t(`status.${quotation.status.toLowerCase()}`) || quotation.status) : ''}</Badge>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-card rounded-xl border p-6 flex flex-col md:flex-row gap-6 justify-between md:items-center">
            <div className="flex items-center gap-4">
              {quotation.site?.logo_url ? (
                <img src={quotation.site.logo_url} className="w-16 h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold">{quotation.title}</h2>
                <div className="text-muted-foreground text-sm flex gap-2">
                  <span>{format(new Date(quotation.created_at), 'MMM d, yyyy')}</span>
                  {quotation.valid_until && (
                    <>
                      <span>•</span>
                      <span className={isExpired ? "text-red-500" : ""}>{t('buyer.quotes.detail.validUntil') || 'Valid until'} {quotation.valid_until && !isNaN(new Date(quotation.valid_until).getTime()) ? format(new Date(quotation.valid_until), 'MMM d, yyyy') : '-'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(quotation.total)}</div>
              {canAccept && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {t('buyer.quotes.detail.ready') || 'Ready to accept'}
                </div>
              )}
            </div>
          </div>

          {quotation.description && (
            <Card>
              <CardContent className="pt-6">
                <div className="whitespace-pre-wrap text-sm">{quotation.description}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">{t('buyer.quotes.detail.orderDetails') || 'Order Details'}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('buyer.quotes.detail.item') || 'Item'}</TableHead>
                    <TableHead className="text-center">{t('buyer.quotes.detail.qty') || 'Qty'}</TableHead>
                    <TableHead className="text-right">{t('buyer.quotes.detail.price') || 'Price'}</TableHead>
                    <TableHead className="text-right">{t('buyer.quotes.detail.total') || 'Total'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items?.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-6 border-t bg-muted/10 flex justify-end">
                <div className="w-full max-w-[300px] space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('buyer.quotes.detail.subtotal') || 'Subtotal'}</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(quotation.subtotal)}</span>
                  </div>
                  {quotation.tax_total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('buyer.quotes.detail.tax') || 'Tax'}</span>
                      <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(quotation.tax_total)}</span>
                    </div>
                  )}
                  {quotation.discount_total > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{t('buyer.quotes.detail.discount') || 'Discount'}</span>
                      <span>-{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(quotation.discount_total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>{t('buyer.quotes.detail.total') || 'Total'}</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(quotation.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {canAccept && (
            <Card className="border-primary/50 shadow-md">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-2">{t('buyer.quotes.detail.accept') || 'Accept & Pay'}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('buyer.quotes.detail.acceptDesc') || 'By accepting this quote, an order will be generated and you will be redirected to complete the payment securely.'}
                  </p>
                </div>
                
                {session?.user && (
                  <DestinationSelector 
                    value={ownerSiteId} 
                    onChange={setOwnerSiteId} 
                    label={t('buyer.quotes.detail.whereToFile') || "Where should we file this purchase?"} 
                    locked={lockDestination}
                  />
                )}

                <Button 
                  size="lg" 
                  className="w-full text-base h-14" 
                  onClick={handleAccept} 
                  disabled={accepting}
                >
                  {accepting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                      {t('buyer.quotes.detail.processing') || 'Processing...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      {quotation.total > 0 ? (t('buyer.quotes.detail.payNow') || 'Pay Now') : (t('buyer.quotes.detail.acceptQuote') || 'Accept Quote')}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {isExpired && quotation.status === 'sent' && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-center dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
              {t('buyer.quotes.detail.expiredDesc') || 'This quote has expired and can no longer be accepted. Please contact the seller for a new quote.'}
            </div>
          )}
          
          {quotation.status === 'accepted' && (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-center flex items-center justify-center gap-2 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20">
              <CheckCircle2 className="w-5 h-5" />
              {t('buyer.quotes.detail.alreadyAccepted') || 'This quote has already been accepted.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

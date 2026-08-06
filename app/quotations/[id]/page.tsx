"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { getQuotation, updateQuotationStatus, removeQuotationItem } from "../actions"
import { authorizeDynamicQuote, retryDynamicQuoteItem } from "../dynamic-quote-actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { toast } from "sonner"
import { Skeleton } from "@/app/components/ui/skeleton"
import { FileText, Send, CheckCircle2, Ban, Plus, Trash2 } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { useLocalization } from "@/app/context/LocalizationContext"
import { AddQuotationItemDialog } from "../components/AddQuotationItemDialog"

export default function QuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const { currentSite } = useSite()
  const router = useRouter()
  const { t } = useLocalization()
  
  const [quotation, setQuotation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)

  const loadQuotation = async () => {
    setLoading(true)
    const res = await getQuotation(resolvedParams.id)
    if (res.error) {
      toast.error(res.error)
      router.push('/quotations')
    } else {
      setQuotation(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadQuotation()
  }, [resolvedParams.id])

  useEffect(() => {
    if (quotation) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: `${t('quotations.detail.breadcrumbQuote') || 'Quote'} ${quotation.id.substring(0,8)}`,
          parent: { title: t('quotations.detail.breadcrumbParent') || 'Quotations', path: '/quotations' }
        }
      });
      window.dispatchEvent(event);
    }
  }, [quotation, t])

  const handleUpdateStatus = async (status: string) => {
    setUpdating(true)
    const res = await updateQuotationStatus(quotation.id, status)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t('quotations.detail.statusUpdated', { status }) || `Quotation marked as ${status}`)
      setQuotation(res.data)
    }
    setUpdating(false)
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm(t('common.confirmDelete') || 'Are you sure you want to delete this?')) return
    setUpdating(true)
    const res = await removeQuotationItem(itemId)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t('quotations.detail.itemRemoved') || 'Item removed successfully')
      loadQuotation()
    }
    setUpdating(false)
  }

  const awaitingAuthorization = (quotation?.items || []).some(
    (item: any) => item.metadata?.dynamic_quote?.status === 'awaiting_authorization'
  )
  const hasProcessing = (quotation?.items || []).some(
    (item: any) => item.metadata?.dynamic_quote?.status === 'processing'
  )

  const handleAuthorize = async () => {
    setUpdating(true)
    const res = await authorizeDynamicQuote(quotation.id)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t('quotations.dynamicQuote.authorized') || 'Quote authorized — you can send it now')
      loadQuotation()
    }
    setUpdating(false)
  }

  const handleRetry = async (itemId: string) => {
    setUpdating(true)
    const res = await retryDynamicQuoteItem(itemId)
    if (res.error && !res.data?.quotationId) toast.error(res.error)
    else {
      toast.success(t('quotations.dynamicQuote.retrying') || 'Retrying quote calculation')
      loadQuotation()
    }
    setUpdating(false)
  }

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  if (!quotation) return null

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg">{t('quotations.detail.title') || 'Quote Details'}</h1>
            <Badge variant="outline" className="uppercase">{quotation.status ? (t(`status.${quotation.status.toLowerCase()}`) || quotation.status) : ''}</Badge>
          </div>
          <div className="flex gap-2">
            {quotation.status === 'draft' && awaitingAuthorization && (
              <Button variant="secondary" onClick={handleAuthorize} disabled={updating || hasProcessing}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {t('quotations.dynamicQuote.authorize') || 'Authorize'}
              </Button>
            )}
            {quotation.status === 'draft' && (
              <Button
                onClick={() => handleUpdateStatus('sent')}
                disabled={updating || hasProcessing || awaitingAuthorization}
              >
                <Send className="w-4 h-4 mr-2" /> {t('quotations.detail.markAsSent') || 'Mark as Sent'}
              </Button>
            )}
            {quotation.status === 'sent' && (
              <>
                <Button variant="outline" className="text-red-500" onClick={() => handleUpdateStatus('rejected')} disabled={updating}>
                  <Ban className="w-4 h-4 mr-2" /> {t('quotations.detail.reject') || 'Reject'}
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleUpdateStatus('accepted')} disabled={updating}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> {t('quotations.detail.acceptManually') || 'Accept Manually'}
                </Button>
              </>
            )}
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  {t('quotations.detail.generalInfo') || 'General Information'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('quotations.detail.client') || 'Client'}</div>
                  <div className="font-medium">{quotation.lead?.name || t('quotations.detail.unknown') || 'Unknown'}</div>
                  <div className="text-sm text-muted-foreground">{quotation.lead?.email}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('quotations.detail.created') || 'Created'}</div>
                  <div>{format(new Date(quotation.created_at), 'PPP')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('quotations.detail.validUntil') || 'Valid Until'}</div>
                  <div>{quotation.valid_until && !isNaN(new Date(quotation.valid_until).getTime()) ? format(new Date(quotation.valid_until), 'PPP') : (t('quotations.detail.notSpecified') || 'Not specified')}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('quotations.detail.clientLink') || 'Client Link'}</CardTitle>
                <CardDescription>{t('quotations.detail.clientLinkDesc') || 'Share this link with your client so they can review and accept the quotation.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-md text-sm break-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/buyer/quotes/${quotation.id}` : ''}
                </div>
                <Button 
                  variant="secondary" 
                  className="w-full mt-4"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/buyer/quotes/${quotation.id}`)
                    toast.success(t('quotations.detail.linkCopied') || "Link copied to clipboard")
                  }}
                >
                  {t('quotations.detail.copyLink') || 'Copy Link'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('quotations.detail.items') || 'Items'}</CardTitle>
              {quotation.status === 'draft' && (
                <Button size="sm" variant="outline" onClick={() => setIsAddItemOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('quotations.detail.addItem') || 'Add Item'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('quotations.detail.table.item') || 'Item'}</TableHead>
                    <TableHead className="text-right">{t('quotations.detail.table.qty') || 'Qty'}</TableHead>
                    <TableHead className="text-right">{t('quotations.detail.table.price') || 'Price'}</TableHead>
                    <TableHead className="text-right">{t('quotations.detail.table.subtotal') || 'Subtotal'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items?.map((item: any) => {
                    const dq = item.metadata?.dynamic_quote
                    const dqStatus = dq?.status as string | undefined
                    return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div>{item.name}</div>
                          {dqStatus && (
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {dqStatus.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {dq?.field_values && Object.keys(dq.field_values).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {Object.entries(dq.field_values).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                            </div>
                          )}
                          {dq?.rationale && (
                            <div className="text-xs text-muted-foreground">{dq.rationale}</div>
                          )}
                          {dq?.error && (
                            <div className="text-xs text-destructive">{dq.error}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency }).format(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency }).format(item.subtotal)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {quotation.status === 'draft' && (dqStatus === 'failed' || dqStatus === 'processing') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(item.id)}
                              disabled={updating}
                            >
                              Retry
                            </Button>
                          )}
                          {quotation.status === 'draft' && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleRemoveItem(item.id)} disabled={updating}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                  {(!quotation.items || quotation.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t('quotations.detail.emptyItems') || 'No items in this quotation yet.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="p-6 border-t bg-muted/10 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('quotations.detail.subtotal') || 'Subtotal'}</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency }).format(quotation.subtotal)}</span>
                  </div>
                  {quotation.discount_total > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{t('quotations.detail.discount') || 'Discount'}</span>
                      <span>-{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency }).format(quotation.discount_total)}</span>
                    </div>
                  )}
                  {(quotation.tax_total || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('quotations.detail.tax') || 'Tax'}</span>
                      <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency }).format(quotation.tax_total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>{t('quotations.detail.total') || 'Total'}</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency }).format(quotation.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <AddQuotationItemDialog 
        open={isAddItemOpen} 
        onOpenChange={setIsAddItemOpen} 
        quotationId={quotation.id}
        onSuccess={loadQuotation}
      />
    </div>
  )
}

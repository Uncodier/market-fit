"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getOrder, updateOrderStatus, updateOrderNotes, updateOrderItemStatus } from "../actions"
import { createShipment } from "@/app/shipments/actions"
import { listLocations } from "@/app/inventory/actions"
import { OrderWithRelations } from "../types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { toast } from "sonner"
import { Save, ExternalLink, CheckCircle2, FileText, Send, Loader2, Mail, Link, Printer } from "@/app/components/ui/icons"
import {
  ensureOrderPublicAccessToken,
  sendSaleOrder,
} from "@/app/orders/send-actions"
import { buildPublicDocPath } from "@/app/documents/public-token"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { navigateToShipment } from "@/lib/navigation/navigation-helpers"
import { OrderInvoiceDocument } from "../components/OrderInvoiceDocument"
import { OrderStatusBar } from "../components/OrderStatusBar"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

export default function OrderDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [isCreatingShipment, setIsCreatingShipment] = useState(false)
  const [modifiedLines, setModifiedLines] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await getOrder(params.id)
      if (error) {
        toast.error(t('orders.error.loadFailed') || "Failed to load order")
      } else if (data) {
        setOrder(data)
        setNotes(data.notes || "")
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite || !order) return
    setUpdatingStatus(true)
    const { data, error } = await updateOrderStatus(currentSite.id, order.id, newStatus)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t('orders.success.statusUpdated') || `Status updated to ${newStatus}`)
      setOrder(prev => prev ? { 
        ...prev, 
        status: newStatus as any,
        sale_order_items: newStatus === 'completed'
          ? prev.sale_order_items?.map((item: any) => ({ ...item, status: 'completed' }))
          : prev.sale_order_items
      } : null)
    }
    setUpdatingStatus(false)
  }

  const handleLineStatusChange = (itemId: string, newStatus: string) => {
    setModifiedLines(prev => ({ ...prev, [itemId]: newStatus }))
    setOrder(prev => prev ? { 
      ...prev, 
      sale_order_items: prev.sale_order_items?.map((item: any) => 
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    } : null)
  }

  const handleSaveLineItems = async () => {
    if (!order || !currentSite) return
    const idsToUpdate = Object.keys(modifiedLines)
    if (idsToUpdate.length === 0) return

    setSavingLines(true)
    try {
      // Loop over the updates and perform them
      // Alternatively we can use Promise.all to run them concurrently
      await Promise.all(
        idsToUpdate.map(itemId => 
          updateOrderItemStatus(currentSite.id, itemId, order.id, modifiedLines[itemId])
        )
      )
      
      toast.success(t('orders.success.lineItemsUpdated') || "Line items updated")
      setModifiedLines({})
    } catch (e: any) {
      toast.error(e.message || t('orders.error.lineItemsUpdateFailed') || "Failed to save line items")
    } finally {
      setSavingLines(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!currentSite || !order) return
    setSavingNotes(true)
    const { data, error } = await updateOrderNotes(currentSite.id, order.id, notes)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t('orders.success.notesUpdated') || "Notes updated")
      setOrder(prev => prev ? { ...prev, notes: data.notes } : null)
    }
    setSavingNotes(false)
  }

  const handleCreateShipment = async () => {
    if (!order || !currentSite) {
      toast.error(t('orders.error.missingInfo') || "Required order info missing")
      return
    }

    setIsCreatingShipment(true)
    try {
      const locationsRes = await listLocations(currentSite.id)
      const locations = locationsRes.data || []
      const defaultLocation =
        locations.find((l) => l.is_default) || locations[0]

      if (!defaultLocation?.id) {
        toast.error(t('orders.error.noLocation') || "No valid location found to ship from. Add one in Settings.")
        setIsCreatingShipment(false)
        return
      }

      const res = await createShipment({
        siteId: currentSite.id,
        saleOrderId: order.id,
        saleId: order.sale_id || undefined,
        leadId: order.leads?.id || (order.sales as any)?.lead_id || undefined,
        originLocationId: defaultLocation.id,
        userId: order.user_id,
      })
      if (res.error) throw new Error(res.error)
      if (res.data) {
        toast.success(t('orders.success.shipmentCreated') || "Shipment created")
        router.push(`/shipments/${res.data.id}`)
      }
    } catch (e: any) {
      toast.error(e.message || t('orders.error.shipmentCreateFailed') || "Failed to create shipment")
      setIsCreatingShipment(false)
    }
  }

  // Trigger breadcrumb update
  useEffect(() => {
    if (order) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: order.order_number,
          parent: {
            title: t('layout.sidebar.orders') || 'Orders',
            path: '/orders'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [order, t]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  if (!order) return <div className="p-8">{t('orders.detail.notFound') || "Order not found"}</div>

  const hasShipments = order.shipments && order.shipments.length > 0;
  // Fallback to jsonb items if no normalized sale_order_items found
  const items = order.sale_order_items && order.sale_order_items.length > 0 ? order.sale_order_items : (order.items || []);
  const lastEmailedAt = (order as any).last_emailed_at as string | null | undefined

  const handlePrint = () => {
    window.open(`/order-pdf/${order.id}`, "_blank")
  }

  const handleSendEmail = async () => {
    if (!(order as any).leads?.email) {
      toast.error(
        t("orders.detail.sendMissingEmail") ||
          "Add a client email before sending this order"
      )
      return
    }
    setSending(true)
    try {
      const res = await sendSaleOrder(order.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success(
          t("orders.detail.sentEmail") || "Order emailed with PDF attached"
        )
        if (res.data) {
          setOrder({
            ...order,
            ...(res.data as any),
            leads: (res.data as any).leads || (order as any).leads,
          })
        }
      }
    } finally {
      setSending(false)
    }
  }

  const handleCopyClientLink = async () => {
    setSending(true)
    try {
      const tokenRes = await ensureOrderPublicAccessToken(order.id)
      if (tokenRes.error || !tokenRes.token) {
        toast.error(tokenRes.error || "Failed to create public link")
        return
      }
      const link = `${window.location.origin}${buildPublicDocPath("so", tokenRes.token)}`
      await navigator.clipboard.writeText(link)
      toast.success(t("orders.detail.linkCopied") || "Link copied to clipboard")
      setOrder({ ...order, public_access_token: tokenRes.token } as any)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center gap-3 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <TabsList>
                <TabsTrigger value="details">{t('orders.detail.tabs.details') || 'Details'}</TabsTrigger>
                <TabsTrigger value="shipments">{t('orders.detail.tabs.shipments') || 'Shipments'}</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1">
                {order.status !== "cancelled" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSendEmail}
                      disabled={sending}
                      className="flex items-center gap-1"
                    >
                      <Mail className="h-4 w-4" />
                      {lastEmailedAt
                        ? t("orders.detail.resendEmail") || "Resend"
                        : t("orders.detail.sendEmail") || "Email"}
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyClientLink}
                  disabled={sending}
                  className="flex items-center gap-1"
                >
                  <Link className="h-4 w-4" />
                  {t("orders.detail.clientLink") || "Client Link"}
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrint}
                  className="flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  {t("common.print") || "Print"}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-end flex-shrink-0">
              <OrderStatusBar
                currentStatus={order.status}
                onStatusChange={handleStatusChange}
                disabled={updatingStatus}
              />
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <TabsContent value="details" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              <OrderInvoiceDocument
                order={order}
                items={items}
                savingLines={savingLines}
                hasModifiedLines={Object.keys(modifiedLines).length > 0}
                onLineStatusChange={handleLineStatusChange}
                onSaveLineItems={handleSaveLineItems}
              />

              {hasShipments && (
                <SectionCard>
                  <SectionCardHeader>
                    <SectionCardTitle className="flex items-center gap-2">
                      <Send className="h-4 w-4" /> {t('orders.detail.shipments') || 'Shipments'}
                    </SectionCardTitle>
                  </SectionCardHeader>
                  <SectionCardContent className="space-y-3">
                    <div className="text-sm font-medium">
                      {order.shipments!.length} {t('orders.detail.shipmentsAssociated') || 'shipment(s) associated'}
                    </div>
                    <div className="space-y-2">
                      {order.shipments!.slice(0, 3).map((s: any) => (
                        <div key={s.id} className="text-sm border-l-2 pl-2 border-border">
                          <div>{t(`shipments.status.${s.status}`) || s.status.replace('_', ' ')}</div>
                          {s.tracking_number && (
                            <div className="text-muted-foreground text-xs font-mono">{s.tracking_number}</div>
                          )}
                          <button
                            type="button"
                            onClick={() => navigateToShipment({ shipmentId: s.id, router })}
                            className="text-primary hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer font-medium"
                          >
                            {t('orders.detail.view') || 'View'} <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </SectionCardContent>
                </SectionCard>
              )}

              <SectionCard>
                <SectionCardHeader>
                  <SectionCardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" /> {t('orders.detail.notes') || 'Notes'}
                  </SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent>
                  <Textarea
                    placeholder={t('orders.detail.notesPlaceholder') || "Add internal notes about this order..."}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[72px]"
                  />
                </SectionCardContent>
                <ActionFooter>
                  <Button variant="outline"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || notes === (order.notes || "")} size="sm">
                    <Save className="h-4 w-4 mr-2" /> {t('orders.detail.saveNotes') || 'Save Notes'}
                  </Button>
                </ActionFooter>
              </SectionCard>

              {order.status === 'pending' && (
                <div className="rounded-lg border-destructive/50 border bg-destructive/5 p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-destructive mb-1">
                        {t('orders.detail.dangerZone') || 'Danger Zone'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('orders.detail.irreversibleActions') || 'Actions in this section cannot be undone'}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="font-medium mb-1">{t('orders.detail.cancelOrder') || 'Cancel Order'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t('orders.detail.cancelDescription') || 'Cancel this order. This will not automatically reverse related sales or shipments.'}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        type="button"
                        onClick={() => handleStatusChange('cancelled')}
                        disabled={updatingStatus}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {t('orders.detail.cancelOrder') || 'Cancel Order'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="shipments" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{t('orders.detail.associatedShipments') || 'Associated Shipments'}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateShipment}
                  disabled={isCreatingShipment}
                >
                  {isCreatingShipment ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {t('orders.detail.createShipment') || 'Create Shipment'}
                </Button>
              </div>
              {(!order.shipments || order.shipments.length === 0) ? (
                <div className="rounded-xl border border-border/70 bg-card py-10 text-center text-sm text-muted-foreground">
                  <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  {t('orders.detail.noShipments') || 'No shipments created for this order yet.'}
                </div>
              ) : (
                <div className={documentListShellClassName()}>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <DocumentListHead className="w-[48%]">{t('orders.detail.trackingCarrier') || 'Tracking / Carrier'}</DocumentListHead>
                        <DocumentListHead className="w-[32%]">{t('orders.detail.status') || 'Status'}</DocumentListHead>
                        <DocumentListHead className="w-[20%]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.shipments.map((shipment: any) => {
                        const hasTracking = Boolean(shipment.tracking_number)
                        const cancelled = shipment.status === "cancelled" || shipment.status === "failed"
                        const accent =
                          cancelled
                            ? "cancelled"
                            : shipment.status === "pending" || shipment.status === "preparing" || ((shipment.status === "shipped" || shipment.status === "in_transit") && !hasTracking)
                              ? "due"
                              : "none"
                        const statusLabel =
                          t(`orders.status.${shipment.status}`) ||
                          t(`shipments.status.${shipment.status}`) ||
                          String(shipment.status).replace(/_/g, " ")

                        return (
                          <DocumentListRow
                            key={shipment.id}
                            onClick={() => navigateToShipment({ shipmentId: shipment.id, router })}
                            accent={accent}
                          >
                            <TableCell className="py-3.5">
                              <EntityCell
                                name={shipment.carrier || (t('orders.detail.notAssigned') || "Not assigned")}
                                secondary={hasTracking ? shipment.tracking_number : null}
                              />
                            </TableCell>
                            <TableCell className="py-3.5">
                              <StatusDot status={shipment.status} label={statusLabel} />
                            </TableCell>
                            <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => navigateToShipment({ shipmentId: shipment.id, router })}
                                className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">{t("common.open") || "Open"}</span>
                              </button>
                            </TableCell>
                          </DocumentListRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

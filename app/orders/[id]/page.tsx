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
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Badge } from "@/app/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { toast } from "sonner"
import { Save, ExternalLink, CheckCircle2, FileText, Send } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { navigateToShipment } from "@/app/hooks/use-navigation-history"
import { OrderInvoiceDocument } from "../components/OrderInvoiceDocument"
import { OrderStatusBar } from "../components/OrderStatusBar"

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
  const [modifiedLines, setModifiedLines] = useState<Record<string, string>>({})

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

    try {
      const locationsRes = await listLocations(currentSite.id)
      const locations = locationsRes.data || []
      const defaultLocation =
        locations.find((l) => l.is_default) || locations[0]

      if (!defaultLocation?.id) {
        toast.error(t('orders.error.noLocation') || "No valid location found to ship from. Add one in Settings.")
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
  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <StickyHeader>
          <div className="w-full pt-0 flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="details">{t('orders.detail.tabs.details') || 'Details'}</TabsTrigger>
              <TabsTrigger value="shipments">{t('orders.detail.tabs.shipments') || 'Shipments'}</TabsTrigger>
            </TabsList>
            <div className="flex items-center justify-end">
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
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-4 w-4" /> {t('orders.detail.shipments') || 'Shipments'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" /> {t('orders.detail.notes') || 'Notes'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={t('orders.detail.notesPlaceholder') || "Add internal notes about this order..."}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[120px]"
                  />
                </CardContent>
                <ActionFooter>
                  <Button
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || notes === (order.notes || "")}
                  >
                    <Save className="h-4 w-4 mr-2" /> {t('orders.detail.saveNotes') || 'Save Notes'}
                  </Button>
                </ActionFooter>
              </Card>

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
                <Button onClick={handleCreateShipment} size="sm" variant="outline">
                  <Send className="h-4 w-4 mr-2" /> {t('orders.detail.createShipment') || 'Create Shipment'}
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('orders.detail.trackingCarrier') || 'Tracking / Carrier'}</TableHead>
                        <TableHead>{t('orders.detail.status') || 'Status'}</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!order.shipments || order.shipments.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            <Send className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            {t('orders.detail.noShipments') || 'No shipments created for this order yet.'}
                          </TableCell>
                        </TableRow>
                      ) : order.shipments.map((shipment: any) => (
                        <TableRow key={shipment.id}>
                          <TableCell>
                            {shipment.tracking_number ? (
                              <div>
                                <div className="font-mono">{shipment.tracking_number}</div>
                                <div className="text-xs text-muted-foreground">{shipment.carrier || 'Unknown'}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{t('orders.detail.notAssigned') || 'Not assigned'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t(`orders.status.${shipment.status}`) || shipment.status.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>
                            <button 
                              onClick={() => navigateToShipment({ shipmentId: shipment.id, router })} 
                              className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
